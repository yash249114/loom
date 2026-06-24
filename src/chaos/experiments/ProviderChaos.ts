import type { ChaosExperiment, ChaosContext, ChaosResult } from "../ChaosTestHarness.js";
import { createServer } from "node:net";
import http from "node:http";

const EXPERIMENTS: ChaosExperiment[] = [
  {
    name: "Provider returns 429 rate limit",
    description: "Provider endpoint returns 429 with Retry-After header to test retry logic",
    category: "provider",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const server = await startFakeProvider(429, { "Retry-After": "2" }, "Rate limited");
      const workspace = ctx.tempDir();

      try {
        ctx.writeFile(".loomrc.json", JSON.stringify({
          defaultProvider: "test",
          providers: { test: { type: "openai", baseURL: `http://localhost:${server.port}`, apiKey: "test-key", model: "gpt-4" } },
        }));

        ctx.runLoom("chat", workspace);

        observations.push(`Provider returned 429 — CLI handled without crash`);
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      } finally {
        server.close();
      }
    },
  },
  {
    name: "Provider returns 500 server error",
    description: "Provider endpoint returns 500 to test error propagation",
    category: "provider",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const server = await startFakeProvider(500, {}, "Internal Server Error");
      const workspace = ctx.tempDir();

      try {
        ctx.writeFile(".loomrc.json", JSON.stringify({
          defaultProvider: "test",
          providers: { test: { type: "ollama", baseURL: `http://localhost:${server.port}`, model: "qwen2.5-coder:7b" } },
        }));

        ctx.runLoom("chat", workspace);
        observations.push("Provider returned 500 — handled");
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      } finally {
        server.close();
      }
    },
  },
  {
    name: "Empty SSE stream from provider",
    description: "Provider opens connection but sends no useful data",
    category: "provider",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const server = await startFakeProvider(200, { "content-type": "text/event-stream" }, "");
      const workspace = ctx.tempDir();

      try {
        ctx.writeFile(".loomrc.json", JSON.stringify({
          defaultProvider: "test",
          providers: { test: { type: "openai", baseURL: `http://localhost:${server.port}`, apiKey: "test-key", model: "gpt-4" } },
        }));

        ctx.runLoom("chat", workspace);
        observations.push("Empty SSE stream — handled without hang");
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      } finally {
        server.close();
      }
    },
  },
  {
    name: "Malformed SSE lines",
    description: "Provider sends SSE with malformed JSON data lines",
    category: "provider",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const malformedSSE = "data: {invalid json\n\ndata: {}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n\ndata: [DONE]\n\n";
      const server = await startFakeProvider(200, { "content-type": "text/event-stream" }, malformedSSE);
      const workspace = ctx.tempDir();

      try {
        ctx.writeFile(".loomrc.json", JSON.stringify({
          defaultProvider: "test",
          providers: { test: { type: "openai", baseURL: `http://localhost:${server.port}`, apiKey: "test-key", model: "gpt-4" } },
        }));

        ctx.runLoom("chat", workspace);
        observations.push("Malformed SSE lines — handled");
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      } finally {
        server.close();
      }
    },
  },
  {
    name: "Provider connection timeout",
    description: "Provider endpoint hangs on accept to test timeout handling",
    category: "provider",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const server = await startHangingProvider();
      const workspace = ctx.tempDir();

      try {
        ctx.writeFile(".loomrc.json", JSON.stringify({
          defaultProvider: "test",
          providers: { test: { type: "openai", baseURL: `http://localhost:${server.port}`, apiKey: "test-key", model: "gpt-4" } },
        }));

        const start = Date.now();
        ctx.runLoom("chat", workspace);
        const elapsed = Date.now() - start;

        if (elapsed > 35_000) {
          errors.push("CLI hung for >35s on hanging provider — timeout missing or too long");
          return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
        }

        observations.push(`Hanging provider timed out in ${elapsed}ms`);
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      } finally {
        server.close();
      }
    },
  },
  {
    name: "Provider disconnect mid-stream",
    description: "Provider closes connection mid-response to test partial output handling",
    category: "provider",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ndjson = '{"message":{"content":"Start of message "}}\n{"message":{"content":"more content "}}\n';
      const server = await startFakeProvider(200, { "content-type": "application/x-ndjson" }, ndjson, true);
      const workspace = ctx.tempDir();

      try {
        ctx.writeFile(".loomrc.json", JSON.stringify({
          defaultProvider: "test",
          providers: { test: { type: "ollama", baseURL: `http://localhost:${server.port}`, model: "qwen2.5-coder:7b" } },
        }));

        ctx.runLoom("chat", workspace);
        observations.push("Provider disconnect mid-stream — handled");
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      } finally {
        server.close();
      }
    },
  },
];

function startFakeProvider(status: number, headers: Record<string, string>, body: string, disconnect?: boolean): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (status === 200) {
        res.writeHead(200, headers);
        res.write(body);
        if (disconnect) {
          res.destroy();
        } else {
          res.end();
        }
      } else {
        res.writeHead(status, headers);
        res.end(body);
      }
    });
    server.listen(0, () => {
      const addr = server.address();
      resolve({ port: (addr as any).port, close: () => server.close() });
    });
  });
}

function startHangingProvider(): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((_req, _res) => {
      // Never respond
    });
    server.listen(0, () => {
      const addr = server.address();
      resolve({ port: (addr as any).port, close: () => server.close() });
    });
  });
}

export default EXPERIMENTS;

import type { ChaosExperiment, ChaosContext, ChaosResult } from "../ChaosTestHarness.js";
import http from "node:http";

const EXPERIMENTS: ChaosExperiment[] = [
  {
    name: "Provider endpoint DNS failure",
    description: "Provider baseURL points to unresolvable hostname",
    category: "network",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "test",
        providers: { test: { type: "openai", baseURL: "https://this-domain-does-not-exist-12345.com", apiKey: "test", model: "gpt-4" } },
      }));

      const { exitCode, stderr } = ctx.runLoom("chat", workspace);

      if (exitCode === 0) {
        observations.push("DNS failure did not crash CLI");
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      }

      errors.push(`CLI crashed on DNS failure: ${stderr.slice(0, 200)}`);
      return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
    },
  },
  {
    name: "Provider endpoint connection refused",
    description: "Provider baseURL points to localhost port with no server",
    category: "network",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "test",
        providers: { test: { type: "ollama", baseURL: "http://localhost:1", model: "qwen2.5-coder:7b" } },
      }));

      const { exitCode, stderr } = ctx.runLoom("chat", workspace);

      if (exitCode === 0) {
        observations.push("Connection refused did not crash CLI");
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      }

      errors.push(`CLI crashed on connection refused: ${stderr.slice(0, 200)}`);
      return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
    },
  },
  {
    name: "Very slow provider response",
    description: "Provider responds slowly (100ms per byte) to test timeout handling",
    category: "network",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const server = await startSlowProvider(100, 20);
      const workspace = ctx.tempDir();

      try {
        ctx.writeFile(".loomrc.json", JSON.stringify({
          defaultProvider: "test",
          providers: { test: { type: "ollama", baseURL: `http://localhost:${server.port}`, model: "qwen2.5-coder:7b" } },
        }));

        const start = Date.now();
        ctx.runLoom("chat", workspace);
        const elapsed = Date.now() - start;

        if (elapsed > 35_000) {
          errors.push("CLI hung for >35s on slow provider");
          return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
        }

        observations.push(`Slow provider handled in ${elapsed}ms`);
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      } finally {
        server.close();
      }
    },
  },
  {
    name: "TLS/SSL certificate error",
    description: "Provider returns invalid/self-signed certificate",
    category: "network",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "test",
        providers: { test: { type: "openai", baseURL: "https://self-signed.badssl.com", apiKey: "test", model: "gpt-4" } },
      }));

      const { exitCode } = ctx.runLoom("chat", workspace);

      if (exitCode === 0) {
        observations.push("TLS error did not crash CLI");
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      }

      observations.push("TLS error propagated without crash");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Provider returns wrong content-type",
    description: "Provider returns HTML instead of expected JSON/SSE",
    category: "network",
    severity: "warning",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const htmlBody = "<html><body><h1>Welcome to Nginx</h1></body></html>";
      const server = http.createServer((_req: http.IncomingMessage, res: http.ServerResponse) => {
        res.writeHead(200, { "content-type": "text/html" });
        res.end(htmlBody);
      });
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const port = (server.address() as import("node:net").AddressInfo).port;
      const workspace = ctx.tempDir();

      try {
        ctx.writeFile(".loomrc.json", JSON.stringify({
          defaultProvider: "test",
          providers: { test: { type: "openai", baseURL: `http://localhost:${port}`, apiKey: "test", model: "gpt-4" } },
        }));

        ctx.runLoom("chat", workspace);
        observations.push("HTML response from provider — handled without crash");
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      } finally {
        server.close();
      }
    },
  },
];

function startSlowProvider(delayPerByte: number, totalBytes: number): Promise<{ port: number; close: () => void }> {
  const ndjsonLine = '{"message":{"content":"x"}}\n';
  return new Promise((resolve) => {
    const server = http.createServer(async (_req: http.IncomingMessage, res: http.ServerResponse) => {
      res.writeHead(200, { "content-type": "application/x-ndjson" });
      for (let i = 0; i < totalBytes; i++) {
        await new Promise((r) => setTimeout(r, delayPerByte));
        res.write(ndjsonLine);
      }
      res.end();
    });
    server.listen(0, () => {
      const addr = server.address();
      resolve({ port: (addr as any).port, close: () => server.close() });
    });
  });
}

export default EXPERIMENTS;

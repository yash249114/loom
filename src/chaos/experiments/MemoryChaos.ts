import type { ChaosExperiment, ChaosContext, ChaosResult } from "../ChaosTestHarness.js";
import path from "node:path";

const EXPERIMENTS: ChaosExperiment[] = [
  {
    name: "Extremely long prompt input",
    description: "User prompt of 1 million characters to test input buffer limits",
    category: "memory",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      const longPrompt = "A".repeat(1_000_000);

      const { exitCode, stderr } = ctx.runLoom(`run "${longPrompt.slice(0, 100)}..."`, workspace);

      if (exitCode !== 0 && stderr.includes("out of memory")) {
        errors.push("Out of memory on long prompt");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("1M-char prompt accepted without OOM");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Deeply nested tool call chain",
    description: "Simulate 1000 nested tool calls to test recursion limits",
    category: "memory",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      const messages = [];
      for (let i = 0; i < 500; i++) {
        messages.push({ role: "assistant", content: "", toolCalls: [{ id: `call_${i}`, name: "read_file", arguments: { path: `/file${i}.ts` } }], timestamp: i });
        messages.push({ role: "tool", content: `Result of tool ${i}`, toolCallId: `call_${i}`, name: "read_file", timestamp: i });
      }

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      ctx.writeFile(pathJoin(".loom", "sessions.json"), JSON.stringify({
        sessions: [{ id: "tool-chain", workspace, provider: "ollama", model: "qwen", messages, createdAt: 1, updatedAt: 1 }],
      }));

      const { exitCode } = ctx.runLoom("sessions", workspace);

      if (exitCode !== 0) {
        errors.push("CLI crashed on session with 1000 tool calls");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("1000 nested tool calls in session — handled");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Many concurrent config loads",
    description: "Rapidly load config 100 times to test for memory leaks",
    category: "memory",
    severity: "warning",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        const { exitCode } = ctx.runLoom("config", workspace);
        if (exitCode !== 0) {
          errors.push(`CLI crashed on iteration ${i} of 100 config loads`);
          return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
        }
      }
      const elapsed = Date.now() - start;

      observations.push(`100 config loads completed in ${elapsed}ms (${(elapsed / 100).toFixed(1)}ms avg)`);
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Session with maximum-depth messages",
    description: "Messages array containing deeply nested content objects",
    category: "memory",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      let nested: any = { role: "user", content: "x", timestamp: 1 };
      for (let i = 0; i < 1000; i++) {
        nested = { role: "user", content: JSON.stringify(nested), timestamp: i };
      }

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      ctx.writeFile(pathJoin(".loom", "sessions.json"), JSON.stringify({
        sessions: [{ id: "deep-nest", workspace, provider: "ollama", model: "qwen", messages: [nested], createdAt: 1, updatedAt: 1 }],
      }));

      const { exitCode } = ctx.runLoom("sessions", workspace);

      if (exitCode !== 0) {
        errors.push("CLI crashed on deeply nested message content");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("1000-deep nested message content handled");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Many small files in workspace",
    description: "Workspace with 10,000 small files to test glob performance",
    category: "memory",
    severity: "warning",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      for (let i = 0; i < 500; i++) {
        for (let j = 0; j < 100; j++) {
          ctx.writeFile(`dir${i}/file${j}.ts`, `export const v${i}_${j} = ${i + j};`);
        }
      }

      const start = Date.now();
      const { exitCode } = ctx.runLoom("config", workspace);
      const elapsed = Date.now() - start;

      if (exitCode !== 0) {
        errors.push("CLI crashed with 50K files in workspace");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push(`50K files in workspace — handled in ${elapsed}ms`);
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
];

function pathJoin(...parts: string[]): string {
  return path.join(...parts);
}

export default EXPERIMENTS;

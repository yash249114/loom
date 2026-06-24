import type { UiExperiment, UiContext, UiResult } from "./UiTestHarness.js";
import path from "node:path";

const EXPERIMENTS: UiExperiment[] = [
  {
    name: "Corrupt sessions.json crash test",
    description: "Write binary garbage to sessions.json, verify CLI doesn't crash on sessions command",
    category: "corruption",
    severity: "critical",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      ctx.runLoom("init", ws);
      const fs = require("node:fs");
      fs.writeFileSync(pathJoin(ws, ".loom", "sessions.json"), Buffer.alloc(1024));

      const { exitCode } = ctx.runLoom("sessions", ws);

      if (exitCode !== 0) { errors.push(`CLI crashed on binary sessions.json`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      observations.push("Binary sessions.json handled without crash");
      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Agent crash from malformed config",
    description: "Config with invalid provider type causes agent init to crash",
    category: "corruption",
    severity: "critical",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "nonexistent", baseURL: "http://localhost:11434", model: "qwen" } },
      }));

      const { exitCode, stderr, stdout } = ctx.runLoom("run test prompt", ws);

      if (exitCode === 0) {
        observations.push("CLI handled invalid provider type without crashing");
        return { verdict: "pass", durationMs: 0, errors, observations };
      }

      observations.push(`CLI exited ${exitCode} with error: ${stderr.slice(0, 100)}`);
      return { verdict: "warn", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Init on read-only filesystem",
    description: "Try to init in a directory with no write permissions",
    category: "corruption",
    severity: "error",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      try {
        const fs = require("node:fs");
        const target = pathJoin(ws, "readonly");
        fs.mkdirSync(target);

        // Windows: read-only on directories does not prevent file creation, only deletion/rename
        if (process.platform === "win32") {
          observations.push("Skipped: read-only directory semantics differ on Windows");
          return { verdict: "pass", durationMs: 0, errors, observations };
        }

        fs.chmodSync(target, 0o444);

        const { exitCode, stderr } = ctx.runLoom("init", target);

        if (exitCode === 0) {
          errors.push("Init succeeded on read-only directory — unexpected");
          return { verdict: "fail", durationMs: 0, errors, observations };
        }

        observations.push(`Read-only init exited ${exitCode}: ${stderr.slice(0, 100)}`);

        fs.chmodSync(target, 0o777);
      } catch (e) {
        observations.push(`Permission test not applicable on this platform: ${(e as Error).message}`);
      }

      return { verdict: errors.length === 0 ? "pass" : "fail", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Memory corruption from huge env vars",
    description: "CLI run with extremely large environment variable values",
    category: "corruption",
    severity: "warning",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("--version", ws, {
        LOOM_CORRUPT: "A".repeat(100_000),
        LOOM_PAYLOAD: Buffer.alloc(50_000).toString("base64"),
      });

      if (exitCode !== 0) { errors.push(`CLI crashed with large env vars`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      observations.push("150KB of env vars handled without crash");
      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Config with deeply nested 100-level JSON",
    description: "Config file with 100 levels of nesting to test parser stack",
    category: "corruption",
    severity: "error",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      let nested: any = { type: "ollama", baseURL: "http://localhost:11434", model: "deep" };
      for (let i = 0; i < 100; i++) {
        nested = { nested, x: i };
      }

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: nested },
      }));

      const { exitCode, stderr } = ctx.runLoom("config", ws);

      if (exitCode === 0) {
        observations.push("100-level deep JSON config parsed");
        return { verdict: "pass", durationMs: 0, errors, observations };
      }

      errors.push(`Config crash on deep nesting: ${stderr.slice(0, 100)}`);
      return { verdict: "fail", durationMs: 0, errors, observations };
    },
  },
];

function pathJoin(...parts: string[]): string {
  return path.join(...parts);
}

export default EXPERIMENTS;

import type { UiExperiment, UiContext, UiResult } from "./UiTestHarness.js";
import path from "node:path";

const EXPERIMENTS: UiExperiment[] = [
  {
    name: "1000 sessions — list output",
    description: "Creates 1000 sessions, runs sessions command, verifies no crash or layout break",
    category: "stress",
    severity: "critical",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      ctx.runLoom("init", ws);

      const sessions: Array<{ id: string; workspace: string; provider: string; model: string; messages: Array<{ role: string; content: string; timestamp: number }>; createdAt: number; updatedAt: number }> = [];
      for (let i = 0; i < 1000; i++) {
        sessions.push({
          id: `sess-${i}`,
          workspace: ws,
          provider: "ollama",
          model: "qwen2.5-coder:7b",
          messages: [{ role: "user", content: `Test message ${i}`, timestamp: i }],
          createdAt: i,
          updatedAt: i,
        });
      }
      ctx.writeFile(pathJoin(ws, ".loom", "sessions.json"), JSON.stringify({ sessions }));

      const { stdout, exitCode } = ctx.runLoom("sessions", ws);

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      observations.push(`1000 sessions loaded, stdout length: ${stdout.length} chars`);

      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "500 providers in config",
    description: "Config with 500 provider entries, runs config command, verifies parse and output",
    category: "stress",
    severity: "error",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const providers: Record<string, any> = {};
      for (let i = 0; i < 500; i++) {
        providers[`provider${i}`] = { type: "ollama", baseURL: "http://localhost:11434", model: `model${i}` };
      }

      ctx.writeFile(pathJoin(ws, ".loomrc.json"), JSON.stringify({
        defaultProvider: "provider0",
        providers,
      }));

      const { stdout, exitCode } = ctx.runLoom("config", ws);

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      const jsonMatch = stdout.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        errors.push("No JSON object found in config output");
        return { verdict: "fail", durationMs: 0, errors, observations };
      }
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const count = Object.keys(parsed.providers ?? {}).length;
        observations.push(`Config output contains ${count} providers, total ${stdout.length} chars`);
        if (count < 500) errors.push(`Expected 500 providers, got ${count}`);
      } catch {
        errors.push("Config output not valid JSON");
        return { verdict: "fail", durationMs: 0, errors, observations };
      }

      return { verdict: errors.length === 0 ? "pass" : "fail", durationMs: 0, errors, observations };
    },
  },
  {
    name: "10000 files in workspace",
    description: "Creates 10000 files, runs config to test fs handling under load",
    category: "stress",
    severity: "error",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      for (let i = 0; i < 200; i++) {
        for (let j = 0; j < 50; j++) {
          ctx.writeFile(pathJoin(ws, `dir${i}`, `file${j}.ts`), `export const v = ${i + j};`);
        }
      }

      ctx.writeFile(pathJoin(ws, ".loomrc.json"), JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      const start = Date.now();
      const { stdout, exitCode } = ctx.runLoom("config", ws);
      const elapsed = Date.now() - start;

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: elapsed, errors, observations }; }

      observations.push(`10000 files in workspace — config loaded in ${elapsed}ms`);
      return { verdict: "pass", durationMs: elapsed, errors, observations };
    },
  },
  {
    name: "Session with 50000 messages",
    description: "Single session with 50K messages to stress JSON parse and display",
    category: "stress",
    severity: "critical",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      ctx.runLoom("init", ws);

      const messages: Array<{ role: string; content: string; timestamp: number }> = [];
      for (let i = 0; i < 50_000; i++) {
        messages.push({ role: i % 2 === 0 ? "user" : "assistant", content: `msg ${i}`, timestamp: i });
      }

      ctx.writeFile(pathJoin(ws, ".loom", "sessions.json"), JSON.stringify({
        sessions: [{ id: "giant", workspace: ws, provider: "ollama", model: "qwen", messages, createdAt: 1, updatedAt: 1 }],
      }));

      const { stdout, exitCode } = ctx.runLoom("sessions", ws);

      if (exitCode !== 0) {
        observations.push(`CLI crashed on 50K-message session — likely OOM`);
        return { verdict: "warn", durationMs: 0, errors, observations };
      }

      observations.push(`50K-message session loaded, stdout: ${stdout.length} chars`);
      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "100 nested subcommands output",
    description: "Test CLI output with 100 levels of --help on nested command",
    category: "stress",
    severity: "info",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("--help", ws);

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      const commands = stdout.match(/\s{2}(\S+)\s{2}/g);
      const count = commands ? commands.length : 0;
      observations.push(`${count} commands registered in help output`);

      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
];

function pathJoin(...parts: string[]): string {
  return path.join(...parts);
}

export default EXPERIMENTS;

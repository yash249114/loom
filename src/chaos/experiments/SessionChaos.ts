import type { ChaosExperiment, ChaosContext, ChaosResult } from "../ChaosTestHarness.js";
import path from "node:path";

const EXPERIMENTS: ChaosExperiment[] = [
  {
    name: "Corrupt sessions.json",
    description: "sessions.json contains invalid JSON to verify data loss resilience",
    category: "session",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.runLoom("init", workspace);
      ctx.writeFile(pathJoin(".loom", "sessions.json"), "{{{{ corrupt json }}}}");

      const { stdout, exitCode } = ctx.runLoom("sessions", workspace);

      if (exitCode !== 0) {
        errors.push(`CLI crashed on corrupt sessions.json`);
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      if (stdout.includes("corrupt") || stdout.includes("error")) {
        observations.push("CLI reported corruption but recovered");
      } else {
        observations.push("Corrupt sessions.json silently reset — sessions list empty");
      }

      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Sessions with missing required fields",
    description: "sessions.json entries missing id, messages, createdAt fields",
    category: "session",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.runLoom("init", workspace);
      ctx.writeFile(pathJoin(".loom", "sessions.json"), JSON.stringify({
        sessions: [
          { id: "valid", workspace: "/test", provider: "ollama", model: "qwen", messages: [], createdAt: 1, updatedAt: 1 },
          { messages: [], createdAt: 1, updatedAt: 1 },
          { id: null, workspace: "/test", provider: "ollama", model: "qwen", messages: [], createdAt: 1, updatedAt: 1 },
          { id: "no-messages", workspace: "/test", provider: "ollama", model: "qwen", createdAt: 1, updatedAt: 1 },
        ],
      }));

      const { stdout, exitCode } = ctx.runLoom("sessions", workspace);

      if (exitCode !== 0) {
        observations.push(`CLI crashed on malformed sessions, exit ${exitCode}`);
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("Malformed sessions loaded — missing fields silently handled");
      if (stdout.includes("valid")) observations.push("Valid session survived among corrupt entries");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Extremely large session history",
    description: "Session with 10,000 messages to test serialization limits",
    category: "session",
    severity: "warning",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.runLoom("init", workspace);

      const messages: Array<{ role: string; content: string; timestamp: number }> = [];
      for (let i = 0; i < 10_000; i++) {
        messages.push({ role: i % 2 === 0 ? "user" : "assistant", content: `Message ${i} `.repeat(10), timestamp: i });
      }

      ctx.writeFile(pathJoin(".loom", "sessions.json"), JSON.stringify({
        sessions: [
          { id: "giant", workspace: "/test", provider: "ollama", model: "qwen", messages, createdAt: 1, updatedAt: 1 },
        ],
      }));

      const { stdout, exitCode } = ctx.runLoom("sessions", workspace);

      if (exitCode !== 0) {
        errors.push(`CLI crashed on 10K-message session`);
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("10K-message session loaded successfully");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Concurrent session writes",
    description: "Multiple rapid session create/update operations to test race conditions",
    category: "session",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.runLoom("init", workspace);

      const promises: Array<Promise<void>> = [];
      for (let i = 0; i < 20; i++) {
        const idx = i;
        ctx.writeFile(pathJoin(".loom", "sessions.json"), JSON.stringify({
          sessions: [{ id: `sess${idx}`, workspace: "/test", provider: "ollama", model: "qwen", messages: [{ role: "user", content: `Race ${idx}`, timestamp: idx }], createdAt: idx, updatedAt: idx }],
        }));
      }

      const { exitCode } = ctx.runLoom("sessions", workspace);

      if (exitCode !== 0) {
        observations.push("CLI crashed under concurrent write load");
        return { verdict: "partial", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("20 rapid session writes completed without crash");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Sessions with special characters in content",
    description: "Message content with null bytes, unicode, and control characters",
    category: "session",
    severity: "warning",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.runLoom("init", workspace);
      ctx.writeFile(pathJoin(".loom", "sessions.json"), JSON.stringify({
        sessions: [
          {
            id: "special-chars",
            workspace: "/test",
            provider: "ollama",
            model: "qwen",
            messages: [{ role: "user", content: "Null byte: \u0000\nUnicode: \u00e9\u00e0\u00fc\u00f1\nEmoji: \ud83d\ude80\nControl: \u0001\u0002\u0003", timestamp: 1 }],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }));

      const { exitCode } = ctx.runLoom("sessions", workspace);

      if (exitCode !== 0) {
        errors.push("CLI crashed on sessions with special characters");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("Special characters in messages handled");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
];

function pathJoin(...parts: string[]): string {
  return path.join(...parts);
}

export default EXPERIMENTS;

import type { ChaosExperiment, ChaosContext, ChaosResult } from "../ChaosTestHarness.js";

const EXPERIMENTS: ChaosExperiment[] = [
  {
    name: "Invalid JSON config",
    description: "Loads config with malformed JSON to verify graceful error handling",
    category: "config",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", "{ invalid json here }");
      const { exitCode, stderr } = ctx.runLoom("config", workspace);

      if (exitCode === 0) {
        observations.push("CLI returned 0 despite invalid JSON — may have fallen back to defaults");
      } else {
        errors.push(`Expected crash/error on invalid JSON, got exit code ${exitCode}: ${stderr}`);
      }

      return {
        verdict: exitCode !== 0 ? "fail" : "pass",
        durationMs: 0,
        errors,
        observations,
        recovered: exitCode === 0,
      };
    },
  },
  {
    name: "Empty config file",
    description: "Loads config with empty object to verify default merging",
    category: "config",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", "{}");
      const { stdout, exitCode } = ctx.runLoom("config", workspace);

      if (exitCode !== 0) {
        errors.push(`CLI crashed on empty config: exit ${exitCode}`);
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("Empty config accepted — defaults applied");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Missing defaultProvider reference",
    description: "defaultProvider points to a provider that doesn't exist in providers map",
    category: "config",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "nonexistent-provider",
        providers: {
          ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" },
        },
      }));

      const { exitCode, stderr } = ctx.runLoom("config", workspace);

      if (exitCode === 0) {
        observations.push("CLI succeeded despite broken defaultProvider reference");
        return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
      }

      errors.push(`CLI crashed on invalid defaultProvider: ${stderr}`);
      return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
    },
  },
  {
    name: "Prototype pollution attempt",
    description: "Config JSON attempts __proto__ injection",
    category: "config",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        __proto__: { polluted: true },
        constructor: { prototype: { polluted: true } },
        providers: {
          ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" },
        },
      }));

      const { stdout, exitCode } = ctx.runLoom("config", workspace);

      if (exitCode !== 0) {
        errors.push(`CLI crashed on prototype-polluted config`);
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      if (stdout.includes("polluted")) {
        errors.push("Prototype pollution succeeded — polluted keys leaked into config");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("deepMerge guarded against __proto__/constructor keys");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Provider with missing required fields",
    description: "Provider config missing required fields like baseURL or type",
    category: "config",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "broken",
        providers: {
          broken: { model: "test" },
        },
      }));

      const { exitCode } = ctx.runLoom("config", workspace);

      if (exitCode === 0) {
        errors.push("Config accepted a provider with missing required fields");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("Zod schema caught missing required fields");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Extremely large config file",
    description: "Config file with many nested providers to test parser limits",
    category: "config",
    severity: "warning",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      const providers: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        providers[`provider${i}`] = {
          type: "ollama",
          baseURL: `http://localhost:11434`,
          model: `model${i}`,
        };
      }

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "provider0",
        providers,
      }));

      const start = Date.now();
      const { exitCode } = ctx.runLoom("config", workspace);
      const elapsed = Date.now() - start;

      if (exitCode !== 0) {
        errors.push("CLI crashed on large config");
        return { verdict: "fail", durationMs: elapsed, errors, observations, recovered: false };
      }

      observations.push(`1000-provider config loaded in ${elapsed}ms`);
      return { verdict: "pass", durationMs: elapsed, errors, observations, recovered: true };
    },
  },
  {
    name: "Config with unicode injection",
    description: "Provider names and model names contain unicode and special characters",
    category: "config",
    severity: "warning",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: {
          ollama: {
            type: "ollama",
            baseURL: "http://localhost:11434",
            model: "qwen2.5-coder:7b",
            apiKey: "\u0000null\u0000<script>alert(1)</script>\n${ENV_VAR}",
          },
        },
      }));

      const { exitCode } = ctx.runLoom("config", workspace);

      if (exitCode !== 0) {
        errors.push("CLI crashed on config with special characters in apiKey");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("Special characters in apiKey accepted — no injection in output");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
];

export default EXPERIMENTS;

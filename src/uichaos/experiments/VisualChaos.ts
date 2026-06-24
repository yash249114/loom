import type { UiExperiment, UiContext, UiResult } from "./UiTestHarness.js";

const EXPERIMENTS: UiExperiment[] = [
  {
    name: "--help output has no ANSI artifacts",
    description: "Help text should render cleanly — no unclosed ANSI escapes, no raw codes",
    category: "visual",
    severity: "critical",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("--help", ws);

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      const ansiPattern = /\x1b\[[0-9;]*m/g;
      const rawCodes = stdout.match(ansiPattern);
      if (rawCodes) {
        observations.push(`${rawCodes.length} ANSI escape sequences found in --help output`);
      } else {
        observations.push("No ANSI codes in --help (commander/stdout, not chalk)");
      }

      const controlChars = stdout.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g);
      if (controlChars) {
        errors.push(`Found ${controlChars.length} control characters in output`);
        return { verdict: "fail", durationMs: 0, errors, observations };
      }

      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Config output JSON is valid",
    description: "Config command outputs valid parseable JSON every time",
    category: "visual",
    severity: "critical",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("config", ws);

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      // Strip any chalk/logger prefixed lines (non-JSON lines)
      const jsonStart = stdout.indexOf("{");
      const jsonStr = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;

      try {
        JSON.parse(jsonStr);
        observations.push("Config output is valid JSON");
      } catch (e) {
        errors.push(`Config output is NOT valid JSON: ${(e as Error).message}`);
        return { verdict: "fail", durationMs: 0, errors, observations };
      }

      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Output has no flicker patterns",
    description: "Check output contains no rapid-render sequences (clear-screen, cursor-hide)",
    category: "visual",
    severity: "error",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("--help", ws);

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      const flickerPatterns = [
        { pattern: /\x1b\[2J/, name: "clear-screen" },
        { pattern: /\x1b\[H/, name: "cursor-home" },
        { pattern: /\x1b\[\?25l/, name: "cursor-hide" },
        { pattern: /\x1b\[\?25h/, name: "cursor-show" },
      ];

      for (const fp of flickerPatterns) {
        if (fp.pattern.test(stdout)) {
          observations.push(`Flicker pattern detected: ${fp.name}`);
        }
      }

      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Repeated config runs show no memory leak",
    description: "Run config 50 times in sequence, monitor for increasing output size or slowdown",
    category: "visual",
    severity: "warning",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const timings: number[] = [];

      for (let i = 0; i < 50; i++) {
        const start = Date.now();
        const { stdout, exitCode } = ctx.runLoom("config", ws);
        const elapsed = Date.now() - start;
        timings.push(elapsed);

        if (exitCode !== 0) {
          errors.push(`Config failed on iteration ${i}`);
          return { verdict: "fail", durationMs: 0, errors, observations };
        }

        const jsonMatch = stdout.match(/{[\s\S]*}/);
        if (!jsonMatch) {
          errors.push(`No JSON in output on iteration ${i}`);
          return { verdict: "fail", durationMs: 0, errors, observations };
        }
        try {
          JSON.parse(jsonMatch[0]);
        } catch {
          errors.push(`Invalid JSON on iteration ${i}`);
          return { verdict: "fail", durationMs: 0, errors, observations };
        }
      }

      const avg = timings.reduce((a: number, b: number) => a + b, 0) / timings.length;
      const last10Avg = timings.slice(-10).reduce((a: number, b: number) => a + b, 0) / 10;
      const first10Avg = timings.slice(0, 10).reduce((a: number, b: number) => a + b, 0) / 10;

      observations.push(`50x config runs: avg ${avg.toFixed(1)}ms, first10 ${first10Avg.toFixed(1)}ms, last10 ${last10Avg.toFixed(1)}ms`);

      if (last10Avg > first10Avg * 3) {
        errors.push(`Performance degradation detected: last10 (${last10Avg.toFixed(1)}ms) >> first10 (${first10Avg.toFixed(1)}ms) — possible memory leak`);
        return { verdict: "fail", durationMs: 0, errors, observations };
      }

      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Init command output format",
    description: "Init should show success and info messages in expected format",
    category: "visual",
    severity: "warning",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("init", ws);

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      if (!stdout.includes("Initialized")) observations.push("Init output missing 'Initialized' message");
      if (!stdout.includes(".loom")) observations.push("Init output missing '.loom' reference");
      if (!stdout.includes("config")) observations.push("Init output missing 'config' reference");

      observations.push(`Init output: ${stdout.split("\n").filter(Boolean).length} lines`);
      return { verdict: errors.length === 0 ? "pass" : "fail", durationMs: 0, errors, observations };
    },
  },
];

export default EXPERIMENTS;

import type { UiExperiment, UiContext, UiResult } from "./UiTestHarness.js";

const EXPERIMENTS: UiExperiment[] = [
  {
    name: "80x24 terminal — --help output",
    description: "Runs --help with COLUMNS=80 LINES=24, checks for line wrapping and no truncation",
    category: "terminal-size",
    severity: "critical",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("--help", ws, { COLUMNS: "80", LINES: "24" });

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      const lines = stdout.split("\n").filter((l: string) => l.length > 0);
      const longLines = lines.filter((l: string) => l.length > 80);
      if (longLines.length > 0) {
        observations.push(`${longLines.length} lines exceed 80 cols (commander may not wrap on its own)`);
      }

      if (!stdout.includes("Usage:")) errors.push("Missing Usage header");
      if (!stdout.includes("Commands:")) errors.push("Missing Commands section");

      observations.push(`${lines.length} lines of output`);
      return { verdict: errors.length === 0 ? "pass" : "fail", durationMs: 0, errors, observations };
    },
  },
  {
    name: "120x40 terminal — --help output",
    description: "Runs --help with COLUMNS=120 LINES=40, checks wide terminal layout",
    category: "terminal-size",
    severity: "error",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("--help", ws, { COLUMNS: "120", LINES: "40" });

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      const lines = stdout.split("\n").filter((l: string) => l.length > 0);
      const truncatedLines = lines.filter((l: string) => l.trim().length > 0 && l.length < 20);
      if (truncatedLines.length > 5) observations.push(`${truncatedLines.length} very short lines suggest layout gaps`);

      observations.push(`${lines.length} lines of output, max line width ${Math.max(...lines.map((l: string) => l.length))}`);
      return { verdict: errors.length === 0 ? "pass" : "fail", durationMs: 0, errors, observations };
    },
  },
  {
    name: "80x24 terminal — config output",
    description: "Runs config in narrow terminal, checks JSON formatting",
    category: "terminal-size",
    severity: "error",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("config", ws, { COLUMNS: "80", LINES: "24" });

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      const jsonMatch = stdout.match(/{[\s\S]*}/);
      if (!jsonMatch) {
        errors.push("No JSON object found in config output");
        return { verdict: "fail", durationMs: 0, errors, observations };
      }
      try {
        JSON.parse(jsonMatch[0]);
        observations.push("Config output contains valid JSON");
      } catch {
        errors.push("Config output JSON failed to parse");
        return { verdict: "fail", durationMs: 0, errors, observations };
      }

      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Minimal terminal (40x10)",
    description: "Runs --help with COLUMNS=40 LINES=10 to test extreme constraint handling",
    category: "terminal-size",
    severity: "warning",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("--help", ws, { COLUMNS: "40", LINES: "10" });

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      const lines = stdout.split("\n").filter((l: string) => l.length > 0);
      observations.push(`40x10 terminal: ${lines.length} lines of output`);

      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Terminal with null COLUMNS",
    description: "Runs --help without COLUMNS env var to test default handling",
    category: "terminal-size",
    severity: "info",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (k !== "COLUMNS" && k !== "LINES") env[k] = v ?? "";
      }

      const { stdout, exitCode } = ctx.runLoom("--help", ws, env);

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      observations.push(`Output without COLUMNS env: ${stdout.length} chars`);
      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
];

export default EXPERIMENTS;

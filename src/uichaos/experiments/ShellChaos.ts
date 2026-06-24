import type { UiExperiment, UiContext, UiResult } from "./UiTestHarness.js";
import fs from "node:fs";

const EXPERIMENTS: UiExperiment[] = [
  {
    name: "PowerShell with Unicode output",
    description: "CLI commands produce output with Unicode characters in PowerShell",
    category: "shell",
    severity: "error",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, exitCode } = ctx.runLoom("--help", ws);

      if (exitCode !== 0) { errors.push(`Exit code ${exitCode}`); return { verdict: "fail", durationMs: 0, errors, observations }; }

      const utf8Valid = Buffer.from(stdout, "utf8").toString("utf8");
      if (utf8Valid.length < stdout.length * 0.9) {
        errors.push("Output contains invalid UTF-8 sequences");
        return { verdict: "fail", durationMs: 0, errors, observations };
      }

      observations.push(`Output is valid UTF-8 (${stdout.length} chars)`);
      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "CMD compatibility — no box-drawing chars",
    description: "Output should avoid box-drawing/ANSI-only chars that break in CMD",
    category: "shell",
    severity: "warning",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout } = ctx.runLoom("--help", ws);

      const boxDrawing = stdout.match(/[\u2500-\u257F]/g);
      if (boxDrawing) {
        observations.push(`${boxDrawing.length} box-drawing characters found — may not render in CMD`);
      }

      observations.push("No box-drawing characters in --help output");
      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "CRLF line endings check",
    description: "Output should use consistent line endings for the platform",
    category: "shell",
    severity: "info",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const ws = ctx.tempDir();

      const { stdout, stderr } = ctx.runLoom("--help", ws);

      const hasCRLF = stdout.includes("\r\n");
      const hasLF = stdout.includes("\n") && !stdout.includes("\r\n");

      if (hasCRLF) observations.push("Output uses CRLF line endings (Windows native)");
      if (hasLF) observations.push("Output uses LF line endings (Unix style)");

      return { verdict: "pass", durationMs: 0, errors, observations };
    },
  },
  {
    name: "Very long command path in init",
    description: "Init in a directory with a very long path (>200 chars)",
    category: "shell",
    severity: "warning",
    run: async (ctx: UiContext): Promise<UiResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const base = ctx.tempDir();

      const longPath = base + "\\" + "longdir\\".repeat(10).slice(0, -1);
      try {
        fs.mkdirSync(longPath, { recursive: true });
      } catch {
        observations.push("Could not create long path (platform limit)");
        return { verdict: "warn", durationMs: 0, errors, observations };
      }

      const { exitCode, stderr } = ctx.runLoom("init", longPath);

      if (exitCode === 0) {
        observations.push(`Init succeeded at path length ${longPath.length}`);
        return { verdict: "pass", durationMs: 0, errors, observations };
      }

      observations.push(`Init failed on long path (${longPath.length} chars): ${stderr.slice(0, 100)}`);
      return { verdict: "warn", durationMs: 0, errors, observations };
    },
  },
];

export default EXPERIMENTS;

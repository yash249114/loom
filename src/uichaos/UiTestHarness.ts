import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

// ── Types ──────────────────────────────────────────────────────────

export type Severity = "critical" | "error" | "warning" | "info";
export type Verdict = "pass" | "fail" | "warn" | "crash";

export interface UiExperiment {
  name: string;
  description: string;
  category: string;
  severity: Severity;
  run: (ctx: UiContext) => Promise<UiResult>;
}

export interface UiResult {
  verdict: Verdict;
  durationMs: number;
  errors: string[];
  observations: string[];
}

export interface UiContext {
  loomPath: string;
  runLoom: (args: string, cwd: string, env?: Record<string, string>) => { stdout: string; stderr: string; exitCode: number };
  writeFile: (filePath: string, content: string) => string;
  log: (msg: string) => void;
  tempDir: () => string;
}

export interface UiReport {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  warned: number;
  crashed: number;
  totalDurationMs: number;
  results: Array<{
    name: string;
    category: string;
    severity: Severity;
    verdict: Verdict;
    durationMs: number;
    errors: string[];
    observations: string[];
    recovered: boolean;
  }>;
}

// ── Harness ────────────────────────────────────────────────────────

export class UiChaosHarness {
  private experiments: UiExperiment[] = [];
  private context: UiContext;

  constructor(loomPath?: string) {
    const loom = loomPath ?? path.resolve(process.cwd(), "dist", "cli", "index.js");

    this.context = {
      loomPath: loom,
      runLoom: (args: string, cwd: string, env?: Record<string, string>) => {
        try {
          const stdout = execSync(`node "${loom}" ${args}`, {
            cwd,
            encoding: "utf8",
            timeout: 30_000,
            maxBuffer: 50 * 1024 * 1024,
            env: { ...process.env, ...env },
            shell: true,
          });
          return { stdout: stdout ?? "", stderr: "", exitCode: 0 };
        } catch (err: any) {
          return {
            stdout: err.stdout?.toString() ?? "",
            stderr: err.stderr?.toString() ?? "",
            exitCode: err.status ?? -1,
          };
        }
      },
      writeFile: (filePath: string, content: string) => {
        const full = path.resolve(process.cwd(), filePath);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, "utf8");
        return full;
      },
      log: (msg: string) => process.stdout.write(`  ${msg}\n`),
      tempDir: () => fs.mkdtempSync(path.join(os.tmpdir(), "ui-chaos-")),
    };
  }

  register(exp: UiExperiment): void { this.experiments.push(exp); }
  registerAll(exps: UiExperiment[]): void { for (const e of exps) this.register(e); }

  async runAll(): Promise<UiReport> {
    const start = Date.now();
    const report: UiReport = {
      timestamp: new Date().toISOString(),
      total: this.experiments.length,
      passed: 0, failed: 0, warned: 0, crashed: 0,
      totalDurationMs: 0,
      results: [],
    };

    for (const exp of this.experiments) {
      this.context.log(`\n[${exp.category}] ${exp.name}`);
      this.context.log(`  ${exp.description}`);

      const expStart = Date.now();
      let result: UiResult;

      try {
        result = await exp.run(this.context);
      } catch (err) {
        result = {
          verdict: "crash",
          durationMs: Date.now() - expStart,
          errors: [(err as Error).message],
          observations: [],
        };
      }

      result.durationMs = Date.now() - expStart;
      const icon = result.verdict === "pass" ? "PASS" : result.verdict === "fail" ? "FAIL" : result.verdict === "warn" ? "WARN" : "CRASH";
      this.context.log(`  → ${icon} (${result.durationMs}ms)`);
      for (const e of result.errors) this.context.log(`    error: ${e}`);
      for (const o of result.observations) this.context.log(`    note: ${o}`);

      report.results.push({
        name: exp.name,
        category: exp.category,
        severity: exp.severity,
        verdict: result.verdict,
        durationMs: result.durationMs,
        errors: result.errors,
        observations: result.observations,
        recovered: result.errors.length === 0,
      });

      if (result.verdict === "pass") report.passed++;
      else if (result.verdict === "fail") report.failed++;
      else if (result.verdict === "warn") report.warned++;
      else report.crashed++;
    }

    report.totalDurationMs = Date.now() - start;
    return report;
  }

  static printReport(report: UiReport): void {
    const bar = "─".repeat(60);
    console.log(`\n${bar}`);
    console.log(`UI CHAOS RESULTS`);
    console.log(`Total: ${report.total}  Pass: ${report.passed}  Fail: ${report.failed}  Warn: ${report.warned}  Crash: ${report.crashed}`);
    console.log(`Duration: ${(report.totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`${bar}\n`);

    const failures = report.results.filter((r) => r.verdict !== "pass" && r.verdict !== "warn");
    if (failures.length > 0) {
      console.log("FAILURES:");
      for (const f of failures) {
        console.log(`  [${f.verdict.toUpperCase()}] ${f.name}`);
        for (const e of f.errors) console.log(`       ${e}`);
      }
    }

    const score = report.total > 0 ? Math.round((report.passed / report.total) * 100) : 0;
    console.log(`\nUI Resilience Score: ${score}%`);
    console.log(`Status: ${score >= 90 ? "ROCK SOLID" : score >= 70 ? "STURDY" : score >= 50 ? "SHAKY" : score >= 30 ? "BRITTLE" : "CATASTROPHIC"}`);
  }
}

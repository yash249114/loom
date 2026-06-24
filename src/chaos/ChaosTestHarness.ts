import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

export type ChaosSeverity = "critical" | "error" | "warning" | "info";
export type ChaosVerdict = "pass" | "fail" | "partial" | "crashed";

export interface ChaosExperiment {
  name: string;
  description: string;
  category: string;
  severity: ChaosSeverity;
  run: (ctx: ChaosContext) => Promise<ChaosResult>;
}

export interface ChaosResult {
  verdict: ChaosVerdict;
  durationMs: number;
  errors: string[];
  observations: string[];
  recovered: boolean;
  recoveryTimeMs?: number;
}

export interface ChaosContext {
  workspace: string;
  loomPath: string;
  runLoom: (args: string, cwd: string) => { stdout: string; stderr: string; exitCode: number };
  writeFile: (filePath: string, content: string) => string;
  injectFault: (target: string, fault: string) => void;
  log: (msg: string) => void;
  tempDir: () => string;
}

export interface ChaosReport {
  timestamp: string;
  totalExperiments: number;
  passed: number;
  failed: number;
  partial: number;
  crashed: number;
  totalDurationMs: number;
  results: Array<{
    name: string;
    category: string;
    severity: ChaosSeverity;
    verdict: ChaosVerdict;
    durationMs: number;
    errors: string[];
    observations: string[];
    recovered: boolean;
  }>;
}

export class ChaosTestHarness {
  private experiments: ChaosExperiment[] = [];
  private results: ChaosResult[] = [];
  private context: ChaosContext;

  constructor(loomPath?: string) {
    const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "chaos-"));
    const loom = loomPath ?? path.resolve(process.cwd(), "dist", "cli", "index.js");
    const self = this;

    this.context = {
      workspace,
      loomPath: loom,
      runLoom: (args: string, cwd: string) => self.runLoom(args, cwd),
      writeFile: (filePath: string, content: string) => self.writeFile(filePath, content),
      injectFault: (_target: string, _fault: string) => {},
      log: (msg: string) => process.stdout.write(`  ${msg}\n`),
      tempDir: () => fs.mkdtempSync(path.join(os.tmpdir(), "chaos-tmp-")),
    };
  }

  get experimentCount(): number { return this.experiments.length; }

  register(experiment: ChaosExperiment): void {
    this.experiments.push(experiment);
  }

  registerAll(experiments: ChaosExperiment[]): void {
    for (const e of experiments) this.register(e);
  }

  async runAll(): Promise<ChaosReport> {
    const start = Date.now();
    const report: ChaosReport = {
      timestamp: new Date().toISOString(),
      totalExperiments: this.experiments.length,
      passed: 0,
      failed: 0,
      partial: 0,
      crashed: 0,
      totalDurationMs: 0,
      results: [],
    };

    for (const exp of this.experiments) {
      this.context.log(`\n[${exp.category}] ${exp.name}`);
      this.context.log(`  ${exp.description}`);

      const expStart = Date.now();
      let result: ChaosResult;

      try {
        result = await exp.run(this.context);
      } catch (err) {
        result = {
          verdict: "crashed",
          durationMs: Date.now() - expStart,
          errors: [(err as Error).message],
          observations: [],
          recovered: false,
        };
      }

      result.durationMs = Date.now() - expStart;
      this.results.push(result);

      const icon =
        result.verdict === "pass" ? "PASS" :
        result.verdict === "fail" ? "FAIL" :
        result.verdict === "partial" ? "PART" : "CRASH";

      this.context.log(`  → ${icon} (${result.durationMs}ms) ${result.recovered ? "recovered" : "no-recovery"}`);

      for (const err of result.errors) {
        this.context.log(`    error: ${err}`);
      }
      for (const obs of result.observations) {
        this.context.log(`    note: ${obs}`);
      }

      report.results.push({
        name: exp.name,
        category: exp.category,
        severity: exp.severity,
        verdict: result.verdict,
        durationMs: result.durationMs,
        errors: result.errors,
        observations: result.observations,
        recovered: result.recovered,
      });

      if (result.verdict === "pass") report.passed++;
      else if (result.verdict === "fail") report.failed++;
      else if (result.verdict === "partial") report.partial++;
      else report.crashed++;
    }

    report.totalDurationMs = Date.now() - start;
    return report;
  }

  runLoom(args: string, cwd: string): { stdout: string; stderr: string; exitCode: number } {
    try {
      const stdout = execSync(`node "${this.context.loomPath}" ${args}`, {
        cwd,
        encoding: "utf8",
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      return { stdout, stderr: "", exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout?.toString() ?? "",
        stderr: err.stderr?.toString() ?? "",
        exitCode: err.status ?? -1,
      };
    }
  }

  writeFile(filePath: string, content: string): string {
    const full = path.resolve(this.context.workspace, filePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
    return full;
  }

  cleanup(): void {
    try {
      fs.rmSync(this.context.workspace, { recursive: true, force: true });
    } catch {}
  }

  static printReport(report: ChaosReport): void {
    const bar = "─".repeat(60);
    console.log(`\n${bar}`);
    console.log(`CHAOS ENGINE RESULTS`);
    console.log(`Total: ${report.totalExperiments}  Pass: ${report.passed}  Fail: ${report.failed}  Partial: ${report.partial}  Crash: ${report.crashed}`);
    console.log(`Duration: ${(report.totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`${bar}\n`);

    const failures = report.results.filter((r) => r.verdict !== "pass");
    if (failures.length > 0) {
      console.log(`FAILURES:`);
      for (const f of failures) {
        console.log(`  ${f.severity === "critical" ? "!!!" : "  "} [${f.verdict.toUpperCase()}] ${f.name} (${f.category})`);
        for (const e of f.errors) console.log(`       ${e}`);
      }
    }

    const score = report.totalExperiments > 0
      ? Math.round((report.passed / report.totalExperiments) * 100)
      : 0;
    console.log(`\nResilience Score: ${score}%`);
    console.log(`Achievement: ${
      score >= 90 ? "INDESTRUCTIBLE" :
      score >= 70 ? "RESILIENT" :
      score >= 50 ? "SHAKY" :
      score >= 30 ? "BRITTLE" : "CATASTROPHIC"
    }\n`);
  }
}

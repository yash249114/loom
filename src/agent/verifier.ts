/**
 * VerificationRunner — runs build/lint/test commands after code edits
 * and feeds failures back into the agent loop for self-correction.
 */
import { execa } from "execa";
import { truncate } from "../core/util.js";

export interface VerificationCommand {
  /** Human-readable label, e.g. "TypeScript" */
  name: string;
  /** Shell command to run, e.g. "npx tsc --noEmit" */
  command: string;
  /** Timeout in milliseconds */
  timeoutMs: number;
}

export interface VerificationConfig {
  /** Whether verification runs automatically after file-modifying tools */
  enabled: boolean;
  /** Maximum retry attempts per agent turn (prevents infinite loops) */
  maxRetries: number;
  /** Commands to run, in order. First failure stops the chain. */
  commands: VerificationCommand[];
  /** Tool names that trigger verification when executed successfully */
  triggerTools: string[];
}

export interface VerificationResult {
  passed: boolean;
  /** Per-command results in execution order */
  results: CommandResult[];
  /** Human-readable summary suitable for injecting into agent context */
  summary: string;
}

export interface CommandResult {
  name: string;
  command: string;
  passed: boolean;
  exitCode: number | null;
  output: string;
  timedOut: boolean;
  durationMs: number;
}

export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  enabled: false,
  maxRetries: 3,
  commands: [],
  triggerTools: ["writefile", "editfile", "patchfile"],
};

export class VerificationRunner {
  constructor(private config: VerificationConfig) {}

  get enabled(): boolean {
    return this.config.enabled && this.config.commands.length > 0;
  }

  get maxRetries(): number {
    return this.config.maxRetries;
  }

  /** Check if a tool name should trigger verification */
  shouldTrigger(toolName: string): boolean {
    return this.config.triggerTools.includes(toolName);
  }

  /**
   * Run all verification commands in sequence.
   * Stops at the first failure and returns the summary.
   */
  async run(
    workspaceRoot: string,
    signal?: AbortSignal
  ): Promise<VerificationResult> {
    const results: CommandResult[] = [];
    let allPassed = true;

    for (const cmd of this.config.commands) {
      if (signal?.aborted) {
        results.push({
          name: cmd.name,
          command: cmd.command,
          passed: false,
          exitCode: null,
          output: "[aborted]",
          timedOut: false,
          durationMs: 0,
        });
        allPassed = false;
        break;
      }

      const start = Date.now();
      try {
        const proc = await execa(cmd.command, {
          shell: true,
          cwd: workspaceRoot,
          timeout: cmd.timeoutMs,
          all: true,
          reject: false,
        });

        const output = proc.all ?? `${proc.stdout}\n${proc.stderr}`;
        const passed = proc.exitCode === 0;
        const durationMs = Date.now() - start;

        results.push({
          name: cmd.name,
          command: cmd.command,
          passed,
          exitCode: proc.exitCode ?? null,
          output: truncate(output, 10000),
          timedOut: proc.timedOut ?? false,
          durationMs,
        });

        if (!passed) {
          allPassed = false;
          break; // stop-on-first-failure
        }
      } catch (e: any) {
        results.push({
          name: cmd.name,
          command: cmd.command,
          passed: false,
          exitCode: null,
          output: truncate(e.message ?? String(e), 5000),
          timedOut: false,
          durationMs: Date.now() - start,
        });
        allPassed = false;
        break;
      }
    }

    const summary = this.buildSummary(results, allPassed);
    return { passed: allPassed, results, summary };
  }

  private buildSummary(results: CommandResult[], allPassed: boolean): string {
    if (results.length === 0) return "No verification commands configured.";

    const lines: string[] = [];
    lines.push(
      `## Verification ${allPassed ? "PASSED ✓" : "FAILED ✗"}`
    );

    for (const r of results) {
      const status = r.passed ? "✓" : "✗";
      const timeout = r.timedOut ? " (TIMEOUT)" : "";
      lines.push(
        `\n### ${status} ${r.name}${timeout} [exit ${r.exitCode ?? "?"}] (${r.durationMs}ms)`
      );
      if (!r.passed && r.output) {
        // Include error output so the agent can read it
        lines.push("```");
        lines.push(r.output);
        lines.push("```");
      }
    }

    if (!allPassed) {
      lines.push(
        "\nFix the errors above and try again. Focus on the first error."
      );
    }

    return lines.join("\n");
  }
}

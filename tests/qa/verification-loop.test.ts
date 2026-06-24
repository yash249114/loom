import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { mkdtempSync } from "node:fs";
import { VerificationRunner } from "../../src/agent/verifier.js";
import type { VerificationConfig } from "../../src/agent/verifier.js";

// Cross-platform sleep command
const SLEEP_CMD = process.platform === "win32" ? "ping -n 10 127.0.0.1" : "sleep 10";

describe("Verification Loop", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "loom-verify-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns passed when disabled", async () => {
    const config: VerificationConfig = {
      enabled: false,
      maxRetries: 3,
      commands: [],
      triggerTools: ["writefile", "editfile", "patchfile"],
    };
    const runner = new VerificationRunner(config);
    expect(runner.enabled).toBe(false);
  });

  it("returns passed with no commands", async () => {
    const config: VerificationConfig = {
      enabled: true,
      maxRetries: 3,
      commands: [],
      triggerTools: ["writefile"],
    };
    const runner = new VerificationRunner(config);
    expect(runner.enabled).toBe(false);
  });

  it("passes verification when command succeeds", async () => {
    const config: VerificationConfig = {
      enabled: true,
      maxRetries: 3,
      commands: [
        { name: "echo", command: "echo ok", timeoutMs: 5000 },
      ],
      triggerTools: ["writefile"],
    };
    const runner = new VerificationRunner(config);
    const result = await runner.run(tmpDir);
    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].passed).toBe(true);
  });

  it("fails verification when command fails", async () => {
    const config: VerificationConfig = {
      enabled: true,
      maxRetries: 3,
      commands: [
        { name: "fail", command: "exit 1", timeoutMs: 5000 },
      ],
      triggerTools: ["writefile"],
    };
    const runner = new VerificationRunner(config);
    const result = await runner.run(tmpDir);
    expect(result.passed).toBe(false);
    expect(result.summary).toContain("FAILED");
  });

  it("stops at first failure", async () => {
    const config: VerificationConfig = {
      enabled: true,
      maxRetries: 3,
      commands: [
        { name: "first", command: "exit 1", timeoutMs: 5000 },
        { name: "second", command: "echo should not run", timeoutMs: 5000 },
      ],
      triggerTools: ["writefile"],
    };
    const runner = new VerificationRunner(config);
    const result = await runner.run(tmpDir);
    expect(result.passed).toBe(false);
    expect(result.results).toHaveLength(1);
  });

  it("passes with multiple commands", async () => {
    const config: VerificationConfig = {
      enabled: true,
      maxRetries: 3,
      commands: [
        { name: "cmd1", command: "echo first", timeoutMs: 5000 },
        { name: "cmd2", command: "echo second", timeoutMs: 5000 },
      ],
      triggerTools: ["writefile"],
    };
    const runner = new VerificationRunner(config);
    const result = await runner.run(tmpDir);
    expect(result.passed).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  it("handles command timeout", async () => {
    const config: VerificationConfig = {
      enabled: true,
      maxRetries: 3,
      commands: [
        { name: "sleep", command: SLEEP_CMD, timeoutMs: 500 },
      ],
      triggerTools: ["writefile"],
    };
    const runner = new VerificationRunner(config);
    const result = await runner.run(tmpDir);
    expect(result.passed).toBe(false);
    expect(result.results[0].timedOut).toBe(true);
  });

  it("respects abort signal", async () => {
    const config: VerificationConfig = {
      enabled: true,
      maxRetries: 3,
      commands: [
        { name: "slow", command: "sleep 30", timeoutMs: 60000 },
      ],
      triggerTools: ["writefile"],
    };
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 100);
    const runner = new VerificationRunner(config);
    const result = await runner.run(tmpDir, ac.signal);
    expect(result.passed).toBe(false);
  });

  it("shouldTrigger returns true for trigger tools", () => {
    const config: VerificationConfig = {
      enabled: true,
      maxRetries: 3,
      commands: [],
      triggerTools: ["writefile", "editfile", "patchfile"],
    };
    const runner = new VerificationRunner(config);
    expect(runner.shouldTrigger("writefile")).toBe(true);
    expect(runner.shouldTrigger("readfile")).toBe(false);
    expect(runner.shouldTrigger("shell")).toBe(false);
  });

  it("builds summary correctly", async () => {
    const config: VerificationConfig = {
      enabled: true,
      maxRetries: 3,
      commands: [
        { name: "test", command: "exit 0", timeoutMs: 5000 },
      ],
      triggerTools: ["writefile"],
    };
    const runner = new VerificationRunner(config);
    const result = await runner.run(tmpDir);
    expect(result.summary).toContain("PASSED");
    expect(result.summary).toContain("✓");
  });
});

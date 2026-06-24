import { describe, it, expect, beforeEach } from "vitest";
import { createShellTool } from "../../src/tools/shell-tool.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { ToolContext } from "../../src/core/types.js";
import { execSync } from "node:child_process";

function createCtx(overrides?: Partial<ToolContext>): ToolContext {
  return {
    workspaceRoot: process.cwd(),
    cwd: process.cwd(),
    log: () => {},
    confirm: async () => true,
    ...overrides,
  };
}

// Cross-platform sleep command
const SLEEP_CMD = process.platform === "win32" ? "ping -n 10 127.0.0.1" : "sleep 10";

describe("Shell Tool Safety", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("blocks rm -rf / command", async () => {
    const tool = createShellTool({ blockedCommands: ["rm -rf /"], sandbox: false });
    const ctx = createCtx();
    await expect(
      tool.handler({ command: "rm -rf /", timeoutMs: 5000 }, ctx)
    ).rejects.toThrow("Blocked command pattern");
  });

  it("blocks mkfs command", async () => {
    const tool = createShellTool({ blockedCommands: ["mkfs"], sandbox: false });
    const ctx = createCtx();
    await expect(
      tool.handler({ command: "mkfs.ext4 /dev/sda1", timeoutMs: 5000 }, ctx)
    ).rejects.toThrow("Blocked command pattern");
  });

  it("blocks shutdown command", async () => {
    const tool = createShellTool({ blockedCommands: ["shutdown"], sandbox: false });
    const ctx = createCtx();
    await expect(
      tool.handler({ command: "shutdown -h now", timeoutMs: 5000 }, ctx)
    ).rejects.toThrow("Blocked command pattern");
  });

  it("blocks fork bomb pattern", async () => {
    const tool = createShellTool({ blockedCommands: [":(){ :|:& };:"], sandbox: false });
    const ctx = createCtx();
    await expect(
      tool.handler({ command: ":(){ :|:& };:", timeoutMs: 5000 }, ctx)
    ).rejects.toThrow("Blocked command pattern");
  });

  it("sandbox mode returns safe message instead of executing", async () => {
    const tool = createShellTool({ blockedCommands: [], sandbox: true });
    const ctx = createCtx();
    const result = await tool.handler({ command: "rm -rf /", timeoutMs: 5000 }, ctx);
    expect(result).toContain("[sandbox]");
    expect(result).toContain("rm -rf /");
  });

  it("respects confirmation denial", async () => {
    const tool = createShellTool({ blockedCommands: [], sandbox: false });
    const ctx = createCtx({ confirm: async () => false });
    const result = await tool.handler({ command: "echo hello", timeoutMs: 5000 }, ctx);
    expect(result).toContain("cancelled");
  });

  it("executes safe commands when confirmed", async () => {
    const tool = createShellTool({ blockedCommands: [], sandbox: false });
    const ctx = createCtx();
    const result = await tool.handler({ command: "echo 'hello world'", timeoutMs: 5000 }, ctx);
    expect(result).toContain("hello world");
  });

  it("returns exit code information", async () => {
    const tool = createShellTool({ blockedCommands: [], sandbox: false });
    const ctx = createCtx();
    const result = await tool.handler({ command: "exit 42", timeoutMs: 5000 }, ctx);
    expect(result).toContain("[exit 42]");
  });

  it("captures stderr output", async () => {
    const tool = createShellTool({ blockedCommands: [], sandbox: false });
    const ctx = createCtx();
    const result = await tool.handler({ command: "echo 'error msg' >&2; exit 1", timeoutMs: 5000 }, ctx);
    expect(result).toContain("error msg");
  });

  it("handles command timeout", async () => {
    const tool = createShellTool({ blockedCommands: [], sandbox: false });
    const ctx = createCtx();
    const result = await tool.handler({ command: SLEEP_CMD, timeoutMs: 500 }, ctx);
    expect(result).toContain("TIMEOUT");
  });

  it("handles multiple blocked patterns", async () => {
    const tool = createShellTool({
      blockedCommands: ["rm -rf", "mkfs", "dd if=", "shutdown", "reboot", "poweroff", "format"],
      sandbox: false,
    });
    const ctx = createCtx();
    await expect(
      tool.handler({ command: "dd if=/dev/zero of=/dev/sda bs=1M", timeoutMs: 5000 }, ctx)
    ).rejects.toThrow("Blocked command pattern");
  });

  it("blocked command check via .includes() catches partial matches (potential false positive)", async () => {
    const tool = createShellTool({ blockedCommands: ["rm -rf /"], sandbox: false });
    const ctx = createCtx();
    // NOTE: "sudo rm -rf /var" contains "rm -rf /" (because /var starts with /)
    // This is a false-positive: safe commands get blocked due to substring matching
    await expect(
      tool.handler({ command: "sudo rm -rf /var", timeoutMs: 5000 }, ctx)
    ).rejects.toThrow("Blocked command pattern");
  });
});

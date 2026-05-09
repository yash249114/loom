/**
 * Test harness for tool execution — provides temporary workspace
 * directories and mock contexts for safe tool testing.
 */
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ToolContext, ToolDefinition } from "../../src/core/types.js";

export interface TestWorkspace {
  /** Absolute path to the temporary workspace root */
  root: string;
  /** Create a file in the workspace */
  writeFile(relativePath: string, content: string): Promise<void>;
  /** Read a file from the workspace */
  readFile(relativePath: string): Promise<string>;
  /** Check if a file exists in the workspace */
  exists(relativePath: string): boolean;
  /** Create a ToolContext bound to this workspace */
  createContext(overrides?: Partial<ToolContext>): ToolContext;
  /** Execute a tool with a context bound to this workspace */
  executeTool(
    tool: ToolDefinition,
    args: Record<string, unknown>,
    contextOverrides?: Partial<ToolContext>
  ): Promise<string>;
  /** Clean up the temporary directory */
  cleanup(): Promise<void>;
}

/**
 * Create a temporary workspace for tool testing.
 * Call `cleanup()` when done (or use in a `beforeEach`/`afterEach` block).
 */
export async function createTestWorkspace(): Promise<TestWorkspace> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "loom-test-"));

  const workspace: TestWorkspace = {
    root,

    async writeFile(relativePath: string, content: string) {
      const abs = path.join(root, relativePath);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, content, "utf8");
    },

    async readFile(relativePath: string) {
      return fs.readFile(path.join(root, relativePath), "utf8");
    },

    exists(relativePath: string) {
      return fsSync.existsSync(path.join(root, relativePath));
    },

    createContext(overrides?: Partial<ToolContext>): ToolContext {
      return {
        workspaceRoot: root,
        cwd: root,
        log: () => {},
        confirm: async () => true, // auto-approve in tests
        ...overrides,
      };
    },

    async executeTool(
      tool: ToolDefinition,
      args: Record<string, unknown>,
      contextOverrides?: Partial<ToolContext>
    ) {
      const ctx = workspace.createContext(contextOverrides);
      const parsed = tool.parameters.parse(args);
      const result = await tool.handler(parsed, ctx);
      return typeof result === "string" ? result : JSON.stringify(result);
    },

    async cleanup() {
      await fs.rm(root, { recursive: true, force: true });
    },
  };

  return workspace;
}

/**
 * Create a SafetyGate that always approves (for testing).
 */
export function createAutoApproveSafety() {
  // Inline to avoid circular deps — mirrors SafetyGate interface
  return {
    setAlwaysAllow(_v: boolean) {},
    confirmShell: async () => true,
    confirmWrite: async () => true,
    confirmGeneric: async () => true,
  };
}

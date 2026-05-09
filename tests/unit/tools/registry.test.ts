import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "../../../src/tools/registry.js";
import type { ToolContext, ToolDefinition } from "../../../src/core/types.js";

function dummyCtx(): ToolContext {
  return {
    workspaceRoot: "/tmp/test",
    cwd: "/tmp/test",
    log: () => {},
    confirm: async () => true,
  };
}

function makeTool(name: string, handler?: ToolDefinition["handler"]): ToolDefinition {
  return {
    name,
    description: `Tool ${name}`,
    parameters: z.object({ input: z.string().optional() }),
    handler: handler ?? (async ({ input }) => `${name}:${input ?? "none"}`),
  };
}

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it("registers and retrieves tools", () => {
    registry.register(makeTool("alpha"));
    expect(registry.has("alpha")).toBe(true);
    expect(registry.get("alpha")?.name).toBe("alpha");
  });

  it("lists all registered tools", () => {
    registry.register(makeTool("a"));
    registry.register(makeTool("b"));
    expect(registry.list()).toHaveLength(2);
  });

  it("unregisters a tool", () => {
    registry.register(makeTool("a"));
    registry.unregister("a");
    expect(registry.has("a")).toBe(false);
  });

  it("overwrites a tool with the same name", () => {
    registry.register(makeTool("a", async () => "v1"));
    registry.register(makeTool("a", async () => "v2"));
    expect(registry.list()).toHaveLength(1);
  });

  it("executes a tool with validated args", async () => {
    registry.register(makeTool("echo"));
    const result = await registry.execute("echo", { input: "hi" }, dummyCtx());
    expect(result).toBe("echo:hi");
  });

  it("throws on unknown tool", async () => {
    await expect(
      registry.execute("nonexistent", {}, dummyCtx())
    ).rejects.toThrow("Unknown tool");
  });

  it("validates arguments through Zod", async () => {
    const tool: ToolDefinition = {
      name: "strict",
      description: "needs a number",
      parameters: z.object({ n: z.number() }),
      handler: async ({ n }) => String(n),
    };
    registry.register(tool);
    await expect(
      registry.execute("strict", { n: "not a number" }, dummyCtx())
    ).rejects.toThrow();
  });

  it("filters tools by enabled list", () => {
    registry.register(makeTool("a"));
    registry.register(makeTool("b"));
    registry.register(makeTool("c"));
    const filtered = registry.filter(["a", "c"]);
    expect(filtered.list()).toHaveLength(2);
    expect(filtered.has("a")).toBe(true);
    expect(filtered.has("b")).toBe(false);
    expect(filtered.has("c")).toBe(true);
  });

  it("filter ignores unknown names", () => {
    registry.register(makeTool("a"));
    const filtered = registry.filter(["a", "unknown"]);
    expect(filtered.list()).toHaveLength(1);
  });

  it("describe() lists all tools", () => {
    registry.register(makeTool("alpha"));
    registry.register(makeTool("beta"));
    const desc = registry.describe();
    expect(desc).toContain("alpha");
    expect(desc).toContain("beta");
  });
});

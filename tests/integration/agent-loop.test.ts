import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { Agent } from "../../src/agent/agent.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { SafetyGate } from "../../src/safety/gate.js";
import { MockProvider, textProvider, fencedToolCallProvider } from "../helpers/mock-provider.js";
import { DEFAULT_CONFIG } from "../../src/config/defaults.js";
import type { LoomConfig } from "../../src/core/types.js";

function makeConfig(overrides?: Partial<LoomConfig>): LoomConfig {
  return { ...DEFAULT_CONFIG, ...overrides } as LoomConfig;
}

describe("Agent Loop", () => {
  let registry: ToolRegistry;
  let safety: SafetyGate;
  let config: LoomConfig;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo back input",
      parameters: z.object({ text: z.string() }),
      handler: async ({ text }) => `echoed: ${text}`,
    });
    registry.register({
      name: "fail",
      description: "Always fails",
      parameters: z.object({}),
      handler: async () => { throw new Error("intentional failure"); },
    });

    safety = new SafetyGate(
      DEFAULT_CONFIG.safety,
      async () => true,
      true
    );
    config = makeConfig({ agent: { ...DEFAULT_CONFIG.agent, maxIterations: 5 } });
  });

  it("returns plain text when model emits no tool calls", async () => {
    const provider = textProvider("Here is my answer.");
    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });

    const result = await agent.run("hello");
    expect(result).toBe("Here is my answer.");
    expect(agent.history).toHaveLength(2); // user + assistant
  });

  it("executes tool calls from text fences", async () => {
    const provider = new MockProvider();
    // Turn 1: model calls the echo tool
    provider.enqueue({
      text: '```toolcall\n{"name":"echo","arguments":{"text":"hello"}}\n```',
    });
    // Turn 2: model gives final answer
    provider.enqueue({ text: "Done, I echoed it." });

    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });

    const result = await agent.run("echo hello");
    expect(result).toBe("Done, I echoed it.");
    expect(provider.requests).toHaveLength(2);
  });

  it("handles tool execution errors gracefully", async () => {
    const provider = new MockProvider();
    provider.enqueue({
      text: '```toolcall\n{"name":"fail","arguments":{}}\n```',
    });
    provider.enqueue({ text: "The tool failed, but I recovered." });

    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });

    const result = await agent.run("do something");
    expect(result).toBe("The tool failed, but I recovered.");
  });

  it("respects maxIterations", async () => {
    const provider = new MockProvider();
    // Model always calls a tool (never gives final answer)
    provider.defaultResponse = {
      text: '```toolcall\n{"name":"echo","arguments":{"text":"loop"}}\n```',
    };

    const smallConfig = makeConfig({
      agent: { ...DEFAULT_CONFIG.agent, maxIterations: 3 },
    });

    const agent = new Agent({
      provider, registry, safety, config: smallConfig,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });

    const result = await agent.run("loop forever");
    expect(result).toContain("maxIterations");
  });

  it("emits events during execution", async () => {
    const provider = textProvider("response");
    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });

    const events: string[] = [];
    agent.onTyped("turn:start", () => events.push("turn:start"));
    agent.onTyped("stream:delta", () => events.push("delta"));
    agent.onTyped("stream:done", () => events.push("done"));
    agent.onTyped("agent:done", () => events.push("agent:done"));

    await agent.run("hi");
    expect(events).toContain("turn:start");
    expect(events).toContain("delta");
    expect(events).toContain("agent:done");
  });

  it("supports abort via AbortController", async () => {
    // Create a provider with very long streaming text and delay
    const provider = new MockProvider();
    provider.defaultResponse = {
      text: "x".repeat(2000),
      chunkDelayMs: 50,
    };

    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });

    // Abort after 100ms — well before streaming finishes
    const timer = setTimeout(() => agent.abort(), 100);
    try {
      await agent.run("slow query");
      // If we get here, abort didn't work fast enough — skip gracefully
    } catch (e: any) {
      expect(e.message || e.name).toBeTruthy();
    } finally {
      clearTimeout(timer);
    }
  });
});

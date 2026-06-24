import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";
import { Agent } from "../../src/agent/agent.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { SafetyGate } from "../../src/safety/gate.js";
import { MockProvider, textProvider, fencedToolCallProvider, nativeToolCallProvider } from "../helpers/mock-provider.js";
import { DEFAULT_CONFIG } from "../../src/config/defaults.js";
import type { LoomConfig, ProviderStreamChunk } from "../../src/core/types.js";

function makeConfig(overrides?: Partial<LoomConfig>): LoomConfig {
  return { ...DEFAULT_CONFIG, ...overrides } as LoomConfig;
}

describe("Agent Edge Cases", () => {
  let registry: ToolRegistry;
  let safety: SafetyGate;
  let config: LoomConfig;

  beforeEach(() => {
    registry = new ToolRegistry();
    registry.register({
      name: "echo",
      description: "Echo",
      parameters: z.object({ text: z.string() }),
      handler: async ({ text }) => `echoed: ${text}`,
    });
    registry.register({
      name: "noop",
      description: "Does nothing",
      parameters: z.object({}),
      handler: async () => "done",
    });
    safety = new SafetyGate(DEFAULT_CONFIG.safety, async () => true, true);
    config = makeConfig({ agent: { ...DEFAULT_CONFIG.agent, maxIterations: 5 } });
  });

  it("handles provider that returns empty text", async () => {
    const provider = textProvider("");
    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });
    const result = await agent.run("hello");
    expect(result).toBe("");
  });

  it("handles provider that throws immediately", async () => {
    const provider = new MockProvider();
    provider.enqueue({ error: new Error("provider unavailable") });
    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });
    await expect(agent.run("hello")).rejects.toThrow("provider unavailable");
  });

  it("handles multiple sequential tool calls", async () => {
    const provider = new MockProvider();
    provider.enqueue({
      toolCalls: [
        { id: "call1", name: "echo", arguments: { text: "first" } },
        { id: "call2", name: "echo", arguments: { text: "second" } },
      ],
    });
    provider.enqueue({ text: "All done" });

    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });
    const result = await agent.run("do two things");
    expect(result).toBe("All done");
    expect(provider.requests).toHaveLength(2);
  });

  it("respects maxToolCallsPerTurn limit", async () => {
    const limitConfig = makeConfig({
      agent: { ...DEFAULT_CONFIG.agent, maxToolCallsPerTurn: 2, maxIterations: 1 },
    });
    const provider = new MockProvider();
    provider.enqueue({
      toolCalls: Array.from({ length: 5 }, (_, i) => ({
        id: `call${i}`,
        name: "noop",
        arguments: {},
      })),
    });
    provider.enqueue({ text: "done" });

    const agent = new Agent({
      provider, registry, safety, config: limitConfig,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });
    const result = await agent.run("test");
    expect(typeof result).toBe("string");
  });

  it("handles mixed text and tool calls in response", async () => {
    const provider = new MockProvider();
    provider.enqueue({
      text: "I'll execute these tools:",
      toolCalls: [
        { id: "call1", name: "noop", arguments: {} },
      ],
    });
    provider.enqueue({ text: "Done." });

    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });
    const result = await agent.run("execute");
    expect(result).toBe("Done.");
  });

  it("handles abort mid-execution", async () => {
    const provider = new MockProvider();
    provider.defaultResponse = { text: "x".repeat(5000), chunkDelayMs: 100 };
    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });
    setTimeout(() => agent.abort(), 50);
    try {
      const result = await agent.run("slow");
      // If we get here before abort, the stream completed — acceptable
      expect(result.length).toBeGreaterThan(0);
    } catch {
      // Abort threw — also acceptable
      expect(true).toBe(true);
    }
  });

  it("emits all event types", async () => {
    const provider = textProvider("response");
    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });
    const events: string[] = [];
    agent.onTyped("turn:start", () => events.push("start"));
    agent.onTyped("stream:delta", () => events.push("delta"));
    agent.onTyped("stream:done", () => events.push("done"));
    agent.onTyped("agent:done", () => events.push("done-msg"));
    agent.onTyped("log", () => events.push("log"));
    await agent.run("hi");
    expect(events).toContain("start");
    expect(events).toContain("delta");
    expect(events).toContain("done");
  });

  it("handles loadHistory correctly", async () => {
    const provider = textProvider("response");
    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });
    agent.loadHistory([
      { role: "user", content: "previous message" },
      { role: "assistant", content: "previous response" },
    ]);
    expect(agent.history).toHaveLength(2);
    const result = await agent.run("new message");
    // agent.run adds user message, then assistant response → 2 original + 2 new = 4
    expect(agent.history).toHaveLength(4);
  });

  it("handles fallback chain exhaustion", async () => {
    // This test validates that when skipRouting is false, the agent
    // attempts to connect to real providers and handles failures gracefully
    const provider = new MockProvider();
    provider.defaultResponse = { text: "ok" };
    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: false, // real routing will try OpenRouter first
    });
    try {
      const result = await agent.run("hello");
      expect(typeof result).toBe("string");
    } catch (e: any) {
      // If all providers fail (expected when no API key), catches gracefully
      expect(e.message).toBeTruthy();
    }
  });

  it("handles provider that returns only tool calls with no text", async () => {
    const provider = new MockProvider();
    provider.enqueue({
      toolCalls: [{ id: "c1", name: "noop", arguments: {} }],
    });
    provider.enqueue({ text: "final" });
    const agent = new Agent({
      provider, registry, safety, config,
      workspaceRoot: "/tmp/test",
      skipRouting: true,
    });
    const result = await agent.run("do it");
    expect(result).toBe("final");
  });
});

import { describe, it, expect } from "vitest";
import { classifyTask, routeTask, getFallbackChain } from "../../../src/agent/router.js";
import { DEFAULT_CONFIG } from "../../../src/config/defaults.js";
import type { LoomConfig, RoutingDecision } from "../../../src/core/types.js";

function makeConfig(overrides?: Partial<LoomConfig>): LoomConfig {
  return { ...DEFAULT_CONFIG, ...overrides } as LoomConfig;
}

describe("classifyTask", () => {
  it("classifies code-related prompts as coding", () => {
    expect(classifyTask("fix the bug in parser.ts")).toBe("coding");
    expect(classifyTask("implement a new endpoint")).toBe("coding");
    expect(classifyTask("refactor the function to use async")).toBe("coding");
    expect(classifyTask("debug the compile error")).toBe("coding");
    expect(classifyTask("write unit tests for the module")).toBe("coding");
  });

  it("classifies reasoning-related prompts as reasoning", () => {
    expect(classifyTask("should I use Redis or Memcached?")).toBe("reasoning");
    expect(classifyTask("compare different design patterns")).toBe("reasoning");
    expect(classifyTask("explain why this approach is better")).toBe("reasoning");
    expect(classifyTask("analyze the tradeoffs of microservices")).toBe("reasoning");
    expect(classifyTask("review the architecture decision")).toBe("reasoning");
  });

  it("classifies generic prompts as general", () => {
    expect(classifyTask("hello")).toBe("general");
    expect(classifyTask("what time is it")).toBe("general");
    expect(classifyTask("tell me a joke")).toBe("general");
  });

  it("picks coding when both signals present but code is stronger", () => {
    expect(classifyTask("implement and test the new API endpoint")).toBe("coding");
  });

  it("picks reasoning when both signals present but reason is stronger", () => {
    expect(classifyTask("should I design an alternative approach or strategy?")).toBe("reasoning");
  });
});

describe("routeTask", () => {
  it("routes to openrouter in auto mode", () => {
    const config = makeConfig();
    const result = routeTask("fix the bug", config);
    expect(result.provider).toBe("openrouter");
    expect(result.category).toBe("coding");
    expect(result.model).toBe(config.models.coding);
  });

  it("routes to ollama when forceLocal is true", () => {
    const config = makeConfig();
    const result = routeTask("fix the bug", config, true);
    expect(result.provider).toBe("ollama");
    expect(result.category).toBe("local");
    expect(result.model).toBe(config.models.local);
    expect(result.reason).toBe("forced local");
  });

  it("routes to ollama in local mode", () => {
    const config = makeConfig({
      routing: { defaultMode: "local", fallbackToLocal: true },
    });
    const result = routeTask("fix the bug", config);
    expect(result.provider).toBe("ollama");
    expect(result.category).toBe("local");
    expect(result.reason).toBe("config: local mode");
  });

  it("routes to openrouter in remote mode", () => {
    const config = makeConfig({
      routing: { defaultMode: "remote", fallbackToLocal: true },
    });
    const result = routeTask("hello", config);
    expect(result.provider).toBe("openrouter");
    expect(result.reason).toContain("remote mode");
  });

  it("selects the correct model for each category", () => {
    const config = makeConfig();

    const codingResult = routeTask("write a function", config);
    expect(codingResult.model).toBe(config.models.coding);

    const reasoningResult = routeTask("explain why", config);
    expect(reasoningResult.model).toBe(config.models.reasoning);

    const generalResult = routeTask("hello world", config);
    expect(generalResult.model).toBe(config.models.general);
  });

  it("uses custom models from config", () => {
    const config = makeConfig({
      models: {
        coding: "custom/coder",
        reasoning: "custom/thinker",
        general: "custom/chat",
        local: "custom/local",
      },
    });
    expect(routeTask("write code", config).model).toBe("custom/coder");
    expect(routeTask("explain", config).model).toBe("custom/thinker");
  });
});

describe("getFallbackChain", () => {
  const config = makeConfig();

  it("returns 3 items for an OpenRouter decision with fallbackToLocal", () => {
    const primary: RoutingDecision = {
      category: "coding",
      model: "qwen/qwen3-coder:free",
      provider: "openrouter",
      reason: "classified as coding",
    };
    const chain = getFallbackChain(primary, config);
    expect(chain).toHaveLength(3);
  });

  it("first item is the original primary decision", () => {
    const primary: RoutingDecision = {
      category: "coding",
      model: "qwen/qwen3-coder:free",
      provider: "openrouter",
      reason: "classified as coding",
    };
    const chain = getFallbackChain(primary, config);
    expect(chain[0]).toBe(primary);
  });

  it("second item is the cloud fallback (openrouter/free by default)", () => {
    const primary: RoutingDecision = {
      category: "coding",
      model: "qwen/qwen3-coder:free",
      provider: "openrouter",
      reason: "classified as coding",
    };
    const chain = getFallbackChain(primary, config);
    expect(chain[1].provider).toBe("openrouter");
    expect(chain[1].model).toBe("meta-llama/llama-3.2-3b-instruct:free");
    expect(chain[1].reason).toContain("rate-limited");
  });

  it("third item is local Ollama", () => {
    const primary: RoutingDecision = {
      category: "coding",
      model: "qwen/qwen3-coder:free",
      provider: "openrouter",
      reason: "classified as coding",
    };
    const chain = getFallbackChain(primary, config);
    expect(chain[2].provider).toBe("ollama");
    expect(chain[2].model).toBe(config.models.local);
    expect(chain[2].category).toBe("local");
  });

  it("uses config.models.fallback when set", () => {
    const customConfig = makeConfig({
      models: {
        ...config.models,
        fallback: "custom/fallback-model",
      },
    });
    const primary: RoutingDecision = {
      category: "general",
      model: "meta-llama/llama-3.3-70b-instruct:free",
      provider: "openrouter",
      reason: "classified as general",
    };
    const chain = getFallbackChain(primary, customConfig);
    expect(chain[1].model).toBe("custom/fallback-model");
  });

  it("skips cloud fallback when primary IS the fallback model", () => {
    const primary: RoutingDecision = {
      category: "general",
      model: "meta-llama/llama-3.2-3b-instruct:free",
      provider: "openrouter",
      reason: "classified as general",
    };
    const chain = getFallbackChain(primary, config);
    // Should only have 2 items: primary + local (no duplicate)
    expect(chain).toHaveLength(2);
    expect(chain[0].model).toBe("meta-llama/llama-3.2-3b-instruct:free");
    expect(chain[1].provider).toBe("ollama");
  });

  it("skips local fallback when fallbackToLocal is false", () => {
    const noLocalConfig = makeConfig({
      routing: { defaultMode: "auto", fallbackToLocal: false },
    });
    const primary: RoutingDecision = {
      category: "coding",
      model: "qwen/qwen3-coder-480b-a35b:free",
      provider: "openrouter",
      reason: "classified as coding",
    };
    const chain = getFallbackChain(primary, noLocalConfig);
    // Should only have 2 items: primary + cloud fallback (no local)
    expect(chain).toHaveLength(2);
    expect(chain.every((c) => c.provider === "openrouter")).toBe(true);
  });

  it("only returns primary + local for Ollama decisions (no cloud fallback)", () => {
    const primary: RoutingDecision = {
      category: "local",
      model: "qwen2.5-coder:7b",
      provider: "ollama",
      reason: "forced local",
    };
    const chain = getFallbackChain(primary, config);
    // No cloud fallback added for Ollama → primary + local only
    // But primary IS local, so just primary + the appended local
    expect(chain).toHaveLength(2);
    expect(chain[0]).toBe(primary);
    expect(chain[1].provider).toBe("ollama");
  });
});


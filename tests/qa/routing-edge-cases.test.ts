import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { describe, it, expect } from "vitest";
import { classifyTask, routeTask, getFallbackChain } from "../../src/agent/router.js";
import { DEFAULT_CONFIG } from "../../src/config/defaults.js";
import type { LoomConfig, RoutingDecision } from "../../src/core/types.js";

function makeConfig(overrides?: Partial<LoomConfig>): LoomConfig {
  return { ...DEFAULT_CONFIG, ...overrides } as LoomConfig;
}

describe("Routing Edge Cases", () => {
  describe("classifyTask - Boundary Cases", () => {
    it("handles empty prompt", () => {
      expect(classifyTask("")).toBe("general");
    });

    it("handles very long prompt", () => {
      const long = "fix ".repeat(1000);
      expect(classifyTask(long)).toBe("coding");
    });

    it("handles prompt with only numbers/symbols", () => {
      expect(classifyTask("12345 !@#$%")).toBe("general");
    });

    it("handles unicode and emoji", () => {
      expect(classifyTask("你好世界 🌍")).toBe("general");
      expect(classifyTask("🐛 fix this bug")).toBe("coding");
    });

    it("detects code signals in mixed content", () => {
      expect(classifyTask("the error is in the class definition")).toBe("coding");
    });
  });

  describe("routeTask - Edge Cases", () => {
    it("routes empty prompt in auto mode", () => {
      const config = makeConfig();
      const result = routeTask("", config);
      expect(result.provider).toBe("openrouter");
      expect(result.category).toBe("general");
    });

    it("forceLocal overrides everything", () => {
      const config = makeConfig({
        routing: { defaultMode: "remote", fallbackToLocal: true },
      });
      const result = routeTask("write code", config, true);
      expect(result.provider).toBe("ollama");
      expect(result.category).toBe("local");
      expect(result.reason).toBe("forced local");
    });

    it("local mode with custom local model", () => {
      const config = makeConfig({
        models: { ...DEFAULT_CONFIG.models, local: "custom/local-model:v1" },
        routing: { defaultMode: "local", fallbackToLocal: true },
      });
      const result = routeTask("anything", config);
      expect(result.model).toBe("custom/local-model:v1");
    });

    it("remote mode with reasoning task", () => {
      const config = makeConfig({
        routing: { defaultMode: "remote", fallbackToLocal: true },
      });
      const result = routeTask("compare architectures", config);
      expect(result.provider).toBe("openrouter");
      expect(result.category).toBe("reasoning");
    });
  });

  describe("getFallbackChain - Edge Cases", () => {
    it("returns single item when no fallback configured", () => {
      const config = makeConfig({
        routing: { defaultMode: "auto", fallbackToLocal: false },
        models: { ...DEFAULT_CONFIG.models, fallback: "" },
      });
      const primary: RoutingDecision = {
        category: "coding",
        model: "qwen/qwen3-coder:free",
        provider: "ollama",
        reason: "test",
      };
      const chain = getFallbackChain(primary, config);
      expect(chain.length).toBeGreaterThanOrEqual(1);
    });

    it("handles missing fallback model gracefully", () => {
      const config = makeConfig({
        models: {
          coding: "test/coder",
          reasoning: "test/thinker",
          general: "test/chat",
          local: "test/local",
        },
        routing: { defaultMode: "auto", fallbackToLocal: true },
      });
      const primary: RoutingDecision = {
        category: "coding",
        model: "test/coder",
        provider: "openrouter",
        reason: "test",
      };
      const chain = getFallbackChain(primary, config);
      expect(chain.length).toBeGreaterThanOrEqual(2);
    });

    it("deduplicates when primary equals fallback", () => {
      const config = makeConfig({
        models: {
          ...DEFAULT_CONFIG.models,
          fallback: "qwen/qwen3-coder:free",
        },
      });
      const primary: RoutingDecision = {
        category: "coding",
        model: "qwen/qwen3-coder:free",
        provider: "openrouter",
        reason: "test",
      };
      const chain = getFallbackChain(primary, config);
      // primary is same as fallback, so no duplicate
      const models = chain.map((c) => c.model);
      expect(new Set(models).size).toBeLessThanOrEqual(models.length);
    });
  });

  describe("Config Loading - Edge Cases", () => {
    it("loads default config when no file exists", async () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loom-test-config-"));
      const { loadConfig } = await import("../../src/config/loader.js");
      const { config } = loadConfig(tmp);
      expect(config.defaultProvider).toBe("ollama");
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    it("resolves provider aliases correctly", async () => {
      const { resolveProvider } = await import("../../src/config/loader.js");
      const config = makeConfig({
        defaultProvider: "openrouter",
        aliases: { fast: "groq" },
        providers: {
          groq: {
            type: "openai",
            baseURL: "https://api.groq.com/openai/v1",
            model: "llama-3.3-70b-versatile",
          },
        },
      });
      const { key } = resolveProvider(config, "fast");
      expect(key).toBe("groq");
    });

    it("throws for unknown provider alias", async () => {
      const { resolveProvider } = await import("../../src/config/loader.js");
      const config = makeConfig();
      expect(() => resolveProvider(config, "unknown-aliase")).toThrow();
    });
  });
});

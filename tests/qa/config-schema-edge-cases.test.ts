import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  LoomConfigSchema,
  ProviderConfigSchema,
  AgentConfigSchema,
  SafetyConfigSchema,
  VerificationConfigSchema,
} from "../../src/config/schema.js";

describe("Config Schema Validation", () => {
  describe("ProviderConfigSchema", () => {
    it("validates openai type", () => {
      const result = ProviderConfigSchema.parse({
        type: "openai",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4",
      });
      expect(result.type).toBe("openai");
    });

    it("validates ollama type", () => {
      const result = ProviderConfigSchema.parse({
        type: "ollama",
        baseURL: "http://localhost:11434",
        model: "llama2",
      });
      expect(result.type).toBe("ollama");
    });

    it("rejects invalid type", () => {
      expect(() =>
        ProviderConfigSchema.parse({
          type: "invalid",
          baseURL: "http://localhost",
          model: "test",
        })
      ).toThrow();
    });

    it("rejects non-url baseURL", () => {
      expect(() =>
        ProviderConfigSchema.parse({
          type: "openai",
          baseURL: "not-a-url",
          model: "test",
        })
      ).toThrow();
    });

    it("validates with optional apiKey", () => {
      const result = ProviderConfigSchema.parse({
        type: "openai",
        baseURL: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-4",
      });
      expect(result.apiKey).toBe("sk-test");
    });
  });

  describe("AgentConfigSchema", () => {
    it("applies defaults", () => {
      const result = AgentConfigSchema.parse({});
      expect(result.maxIterations).toBe(25);
      expect(result.maxToolCallsPerTurn).toBe(10);
      expect(result.temperature).toBe(0.2);
      expect(result.contextWindow).toBe(16000);
    });

    it("rejects maxIterations below 1", () => {
      expect(() => AgentConfigSchema.parse({ maxIterations: 0 })).toThrow();
    });

    it("rejects maxIterations above 200", () => {
      expect(() => AgentConfigSchema.parse({ maxIterations: 201 })).toThrow();
    });

    it("rejects temperature below 0", () => {
      expect(() => AgentConfigSchema.parse({ temperature: -1 })).toThrow();
    });

    it("rejects temperature above 2", () => {
      expect(() => AgentConfigSchema.parse({ temperature: 3 })).toThrow();
    });
  });

  describe("SafetyConfigSchema", () => {
    it("applies defaults", () => {
      const result = SafetyConfigSchema.parse({});
      expect(result.requireConfirmForShell).toBe(true);
      expect(result.requireConfirmForWrite).toBe(false);
      expect(result.blockedCommands).toEqual([]);
      expect(result.sandbox).toBe(false);
    });

    it("blocks commands array", () => {
      const result = SafetyConfigSchema.parse({
        blockedCommands: ["rm -rf /", "mkfs"],
      });
      expect(result.blockedCommands).toHaveLength(2);
    });
  });

  describe("VerificationConfigSchema", () => {
    it("applies defaults", () => {
      const result = VerificationConfigSchema.parse({});
      expect(result.enabled).toBe(false);
      expect(result.maxRetries).toBe(3);
      expect(result.commands).toEqual([]);
    });

    it("validates verification commands", () => {
      const result = VerificationConfigSchema.parse({
        enabled: true,
        commands: [
          { name: "TypeScript", command: "tsc --noEmit", timeoutMs: 30000 },
        ],
      });
      expect(result.commands).toHaveLength(1);
    });

    it("rejects maxRetries above 10", () => {
      expect(() =>
        VerificationConfigSchema.parse({ maxRetries: 11 })
      ).toThrow();
    });
  });

  describe("LoomConfigSchema", () => {
    it("validates a full config", () => {
      const result = LoomConfigSchema.parse({
        defaultProvider: "openrouter",
        providers: {
          openrouter: {
            type: "openai",
            baseURL: "https://openrouter.ai/api/v1",
            model: "qwen3-coder",
          },
        },
      });
      expect(result.defaultProvider).toBe("openrouter");
      expect(result.providers.openrouter).toBeTruthy();
    });

    it("uses default providerEndpoints when omitted", () => {
      const result = LoomConfigSchema.parse({
        defaultProvider: "openrouter",
        providers: {
          openrouter: {
            type: "openai",
            baseURL: "https://openrouter.ai/api/v1",
            model: "test",
          },
        },
      });
      expect(result.providerEndpoints.openrouter.baseURL).toBe(
        "https://openrouter.ai/api/v1"
      );
    });

    it("rejects missing defaultProvider", () => {
      expect(() =>
        LoomConfigSchema.parse({
          providers: {},
        })
      ).toThrow();
    });

    it("rejects empty providers", () => {
      expect(() =>
        LoomConfigSchema.parse({
          defaultProvider: "openrouter",
          providers: {},
        })
      ).toThrow();
    });

    it("handles routing config", () => {
      const result = LoomConfigSchema.parse({
        defaultProvider: "openrouter",
        providers: {
          openrouter: {
            type: "openai",
            baseURL: "https://openrouter.ai/api/v1",
            model: "test",
          },
        },
        routing: { defaultMode: "remote", fallbackToLocal: false },
      });
      expect(result.routing.defaultMode).toBe("remote");
      expect(result.routing.fallbackToLocal).toBe(false);
    });
  });
});

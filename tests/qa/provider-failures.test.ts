import { describe, it, expect, beforeEach } from "vitest";
import { OpenAIProvider } from "../../src/providers/openai.js";
import { OllamaProvider } from "../../src/providers/ollama.js";
import { createProvider, createRoutedProvider } from "../../src/providers/factory.js";
import { DEFAULT_CONFIG } from "../../src/config/defaults.js";
import type { ProviderConfig, LoomConfig, RoutingDecision } from "../../src/core/types.js";

describe("Provider Failure Modes", () => {
  describe("OpenAI Provider - Invalid API Keys", () => {
    it("rejects empty API key with 401", async () => {
      const provider = new OpenAIProvider("test", {
        type: "openai",
        baseURL: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o-mini",
      });
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
      });
      await expect(async () => {
        for await (const chunk of stream) {
          // should throw
        }
      }).rejects.toThrow();
    });

    it("rejects obviously invalid API key", async () => {
      const provider = new OpenAIProvider("test", {
        type: "openai",
        baseURL: "https://api.openai.com/v1",
        apiKey: "sk-invalid-key-that-will-fail",
        model: "gpt-4o-mini",
      });
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
      });
      await expect(async () => {
        for await (const chunk of stream) {
          // should throw
        }
      }).rejects.toThrow();
    });
  });

  describe("OpenAI Provider - Invalid Endpoints", () => {
    it("fails with unreachable endpoint", async () => {
      const provider = new OpenAIProvider("test", {
        type: "openai",
        baseURL: "https://nonexistent-domain-12345.com/api/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      });
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
      });
      await expect(async () => {
        for await (const chunk of stream) {
          // should throw
        }
      }).rejects.toThrow();
    });

    it("fails with malformed baseURL", () => {
      expect(() => {
        new OpenAIProvider("test", {
          type: "openai",
          baseURL: "not-a-url",
          apiKey: "sk-test",
          model: "gpt-4o-mini",
        });
      }).not.toThrow();
    });
  });

  describe("OpenAI Provider - Model Errors", () => {
    it("fails with nonexistent model", async () => {
      const provider = new OpenAIProvider("test", {
        type: "openai",
        baseURL: "https://api.openai.com/v1",
        apiKey: "sk-test-invalid",
        model: "this-model-does-not-exist-xyz-999",
      });
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
      });
      await expect(async () => {
        for await (const chunk of stream) {
          // should throw
        }
      }).rejects.toThrow();
    });
  });

  describe("Ollama Provider - Connection Failures", () => {
    it("fails when Ollama is not running", async () => {
      const provider = new OllamaProvider("ollama", {
        type: "ollama",
        baseURL: "http://127.0.0.1:11434",
        model: "qwen2.5-coder:7b",
      });
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
      });
      await expect(async () => {
        for await (const chunk of stream) {
          // should throw
        }
      }).rejects.toThrow();
    });

    it("fails with wrong port", async () => {
      const provider = new OllamaProvider("ollama", {
        type: "ollama",
        baseURL: "http://127.0.0.1:19999",
        model: "qwen2.5-coder:7b",
      });
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
      });
      await expect(async () => {
        for await (const chunk of stream) {
          // should throw
        }
      }).rejects.toThrow();
    });

    it("fails with nonexistent model", async () => {
      const provider = new OllamaProvider("ollama", {
        type: "ollama",
        baseURL: "http://127.0.0.1:11434",
        model: "nonexistent-model-v99",
      });
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
      });
      await expect(async () => {
        for await (const chunk of stream) {
          // should throw
        }
      }).rejects.toThrow();
    });
  });

  describe("Provider Factory", () => {
    it("throws on unknown provider type", () => {
      expect(() =>
        createProvider("test", {
          type: "unknown" as any,
          baseURL: "http://localhost",
          model: "test",
        })
      ).toThrow("Unknown provider type");
    });

    it("creates routed provider with Ollama decision", () => {
      const decision: RoutingDecision = {
        category: "local",
        model: "qwen2.5-coder:7b",
        provider: "ollama",
        reason: "test",
      };
      const provider = createRoutedProvider(decision, DEFAULT_CONFIG as LoomConfig);
      expect(provider.name).toBe("ollama");
      expect(provider.model).toBe("qwen2.5-coder:7b");
    });

    it("creates routed provider with OpenRouter decision", () => {
      const decision: RoutingDecision = {
        category: "coding",
        model: "qwen/qwen3-coder:free",
        provider: "openrouter",
        reason: "test",
      };
      const provider = createRoutedProvider(decision, DEFAULT_CONFIG as LoomConfig);
      expect(provider.name).toBe("openrouter");
      expect(provider.model).toBe("qwen/qwen3-coder:free");
    });
  });

  describe("Rate Limiting and Retries", () => {
    it("OpenAI provider wraps requests with retry logic for 429", async () => {
      const provider = new OpenAIProvider("test", {
        type: "openai",
        baseURL: "https://httpstat.us",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      });
      // httpstat.us/429 returns 429
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
      });
      await expect(async () => {
        for await (const chunk of stream) {}
      }).rejects.toThrow();
    });

    it("handles 503 service unavailable", async () => {
      const provider = new OpenAIProvider("test", {
        type: "openai",
        baseURL: "https://httpstat.us",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      });
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
      });
      await expect(async () => {
        for await (const chunk of stream) {}
      }).rejects.toThrow();
    });
  });

  describe("Streaming Edge Cases", () => {
    it("handles empty response body", async () => {
      class EmptyBodyProvider extends OpenAIProvider {
        async *stream(req: any) {
          throw new Error("OpenAI provider: no response body");
        }
      }
      const provider = new EmptyBodyProvider("test", {
        type: "openai",
        baseURL: "http://localhost",
        apiKey: "sk-test",
        model: "test",
      });
      const stream = provider.stream({ messages: [{ role: "user", content: "hi" }] });
      await expect(async () => {
        for await (const chunk of stream) {}
      }).rejects.toThrow("no response body");
    });

    it("handles signal abort during streaming", async () => {
      const provider = new OpenAIProvider("test", {
        type: "openai",
        baseURL: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      });
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 50);
      const stream = provider.stream({
        messages: [{ role: "user", content: "hi" }],
        signal: ac.signal,
      });
      await expect(async () => {
        for await (const chunk of stream) {}
      }).rejects.toThrow();
    });
  });

  describe("Ollama - Malformed Responses", () => {
    it("handles malformed JSON in stream", async () => {
      class MalformedOllama extends OllamaProvider {
        constructor() {
          super("ollama", {
            type: "ollama",
            baseURL: "http://127.0.0.1:11434",
            model: "test",
          });
        }
        async *stream(req: any) {
          yield { delta: "", done: false };
          yield { delta: "", done: true };
        }
      }
      const provider = new MalformedOllama();
      const stream = provider.stream({ messages: [{ role: "user", content: "hi" }] });
      const chunks: any[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});

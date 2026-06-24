import type { Provider, ProviderConfig, LoomConfig, RoutingDecision } from "../core/types.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAIProvider } from "./openai.js";
import { AnthropicProvider } from "./anthropic.js";

export { ModelDiscovery } from "./discovery.js";
export { ModelCache } from "./cache.js";
export { AnthropicProvider } from "./anthropic.js";
export { inferCapabilities, inferModelMode, estimateContextWindow } from "./capabilities.js";

/**
 * Create a provider from a ProviderConfig entry.
 */
export function createProvider(name: string, cfg: ProviderConfig): Provider {
  switch (cfg.type) {
    case "ollama":
      return new OllamaProvider(name, cfg);
    case "openai":
      return new OpenAIProvider(name, cfg);
    case "anthropic":
      return new AnthropicProvider(name, cfg);
    case "google":
      // Gemini uses an OpenAI-compatible endpoint
      return new OpenAIProvider(name, cfg);
    default:
      throw new Error(`Unknown provider type: ${(cfg as any).type}`);
  }
}

/**
 * Create a provider from a RoutingDecision.
 */
export function createRoutedProvider(
  decision: RoutingDecision,
  config: LoomConfig
): Provider {
  const providerName = decision.provider;

  // Ollama local
  if (providerName === "ollama") {
    const endpoint = config.providerEndpoints.ollama ?? {
      baseURL: "http://127.0.0.1:11434",
    };
    return new OllamaProvider("ollama", {
      type: "ollama",
      baseURL: endpoint.baseURL,
      model: decision.model,
    });
  }

  // Anthropic
  if (providerName === "anthropic") {
    const endpoint = config.providerEndpoints.anthropic ?? {
      baseURL: "https://api.anthropic.com/v1",
      apiKey: process.env.ANTHROPIC_API_KEY,
    };
    return new AnthropicProvider("anthropic", {
      type: "anthropic",
      baseURL: endpoint.baseURL,
      apiKey: endpoint.apiKey ?? "",
      model: decision.model,
    });
  }

  // Gemini — use OpenAI-compatible endpoint
  if (providerName === "gemini") {
    const endpoint = config.providerEndpoints.gemini ?? {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: process.env.GEMINI_API_KEY,
    };
    return new OpenAIProvider("gemini", {
      type: "openai",
      baseURL: endpoint.baseURL,
      apiKey: endpoint.apiKey ?? "",
      model: decision.model,
    });
  }

  // OpenRouter, Groq, OpenAI — all OpenAI-compatible
  const endpoint = config.providerEndpoints[providerName] ?? {
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  };

  const headers: Record<string, string> = {};
  if (providerName === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/yourusername/loom";
    headers["X-Title"] = "Loom CLI";
  }

  return new OpenAIProvider(providerName, {
    type: "openai",
    baseURL: endpoint.baseURL,
    apiKey: endpoint.apiKey ?? "",
    model: decision.model,
    headers,
  });
}

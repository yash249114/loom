import type { Provider, ProviderConfig, LoomConfig, RoutingDecision } from "../core/types.js";
import { OllamaProvider } from "./ollama.js";
import { OpenAIProvider } from "./openai.js";

/**
 * Create a provider from a legacy ProviderConfig entry.
 */
export function createProvider(name: string, cfg: ProviderConfig): Provider {
  switch (cfg.type) {
    case "ollama":
      return new OllamaProvider(name, cfg);
    case "openai":
      return new OpenAIProvider(name, cfg);
    default:
      throw new Error(`Unknown provider type: ${(cfg as any).type}`);
  }
}

/**
 * Create a provider from a RoutingDecision, using providerEndpoints
 * from the config. This is the primary factory for routed requests.
 */
export function createRoutedProvider(
  decision: RoutingDecision,
  config: LoomConfig
): Provider {
  if (decision.provider === "ollama") {
    const endpoint = config.providerEndpoints.ollama ?? {
      baseURL: "http://127.0.0.1:11434",
    };
    return new OllamaProvider("ollama", {
      type: "ollama",
      baseURL: endpoint.baseURL,
      model: decision.model,
    });
  }

  // OpenRouter (or any OpenAI-compatible endpoint)
  const endpoint = config.providerEndpoints.openrouter ?? {
    baseURL: "https://openrouter.ai/api/v1",
  };
  return new OpenAIProvider("openrouter", {
    type: "openai",
    baseURL: endpoint.baseURL,
    apiKey: endpoint.apiKey ?? "",
    model: decision.model,
    headers: {
      "HTTP-Referer": "https://github.com/yourusername/loom",
      "X-Title": "Loom CLI",
    },
  });
}

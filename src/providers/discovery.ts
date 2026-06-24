/**
 * Model Discovery Engine
 *
 * Fetches available models from each provider's API, maps capabilities,
 * assigns quality tiers, and caches results.
 *
 * Connect Flow:
 *   Provider → API Key → Validate → Fetch Models → Select Model → Save
 *
 * Supported:
 *   OpenRouter  → GET /api/v1/models
 *   Gemini      → GET /v1beta/models
 *   Groq        → GET /openai/v1/models
 *   OpenAI      → GET /v1/models
 *   Anthropic   → GET /v1/models
 *   Ollama      → GET /api/tags
 */
import type { ModelInfo, ProviderKey, ProviderStatus } from "../core/types.js";
import { inferCapabilities, inferModelMode, estimateContextWindow, PROVIDER_ENDPOINTS } from "./capabilities.js";
import { ModelCache } from "./cache.js";

export interface DiscoveryOptions {
  apiKeys?: Partial<Record<ProviderKey, string>>;
  baseURLs?: Partial<Record<ProviderKey, string>>;
  workspaceDir?: string;
  cacheTtlMs?: number;
  /** Skip cache — force fresh fetch */
  force?: boolean;
}

export class ModelDiscovery {
  private cache: ModelCache;

  constructor(opts: DiscoveryOptions = {}) {
    this.cache = new ModelCache({
      workspaceDir: opts.workspaceDir,
      ttlMs: opts.cacheTtlMs,
    });
  }

  /**
   * Discover models for a single provider.
   * Returns cached models if available and not forced.
   */
  async discoverProvider(
    provider: ProviderKey,
    apiKey?: string,
    opts?: { force?: boolean; baseURL?: string }
  ): Promise<ProviderStatus> {
    // Check cache first
    if (!opts?.force) {
      const cached = this.cache.read(provider);
      if (cached) {
        return {
          key: provider,
          name: provider,
          ok: true,
          models: cached,
          latencyMs: 0,
          endpoint: PROVIDER_ENDPOINTS[provider]?.baseURL,
        };
      }
    }

    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (!endpoint) {
      return {
        key: provider,
        name: provider,
        ok: false,
        error: `Unknown provider: ${provider}`,
      };
    }

    const baseURL = opts?.baseURL?.replace(/\/$/, "") || endpoint.baseURL;
    const key = apiKey || process.env[endpoint.apiKeyEnv];

    // Skip if no API key and provider requires one (skip Ollama)
    if (provider !== "ollama" && !key) {
      return {
        key: provider,
        name: provider,
        ok: false,
        error: `No API key found for ${provider}. Set ${endpoint.apiKeyEnv} or pass --key.`,
        endpoint: baseURL,
      };
    }

    const start = Date.now();
    try {
      const models = await this.fetchProviderModels(provider, baseURL, key ?? "");
      const latencyMs = Date.now() - start;

      // Cache the results
      this.cache.write(provider, models);

      return {
        key: provider,
        name: provider,
        ok: true,
        models,
        latencyMs,
        endpoint: baseURL,
      };
    } catch (err: any) {
      return {
        key: provider,
        name: provider,
        ok: false,
        error: err.message ?? String(err),
        latencyMs: Date.now() - start,
        endpoint: baseURL,
      };
    }
  }

  /**
   * Discover models for all configured providers.
   */
  async discoverAll(
    apiKeys?: Partial<Record<ProviderKey, string>>,
    opts?: { force?: boolean }
  ): Promise<ProviderStatus[]> {
    const providers: ProviderKey[] = [
      "openrouter", "gemini", "groq", "openai", "anthropic", "ollama",
    ];

    const results = await Promise.allSettled(
      providers.map((p) =>
        this.discoverProvider(p, apiKeys?.[p], opts)
      )
    );

    return results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        key: providers[i],
        name: providers[i],
        ok: false,
        error: r.reason?.message ?? String(r.reason),
      };
    });
  }

  /**
   * Validate a provider connection (check API key works).
   * For Ollama, just check the endpoint is reachable.
   */
  async validateProvider(
    provider: ProviderKey,
    apiKey?: string,
    baseURL?: string
  ): Promise<ProviderStatus> {
    return this.discoverProvider(provider, apiKey, { force: true, baseURL });
  }

  // ── Provider-specific fetching ──────────────────────────────────

  private async fetchProviderModels(
    provider: ProviderKey,
    baseURL: string,
    apiKey?: string
  ): Promise<ModelInfo[]> {
    const k = apiKey ?? "";
    switch (provider) {
      case "openrouter": return this.fetchOpenRouterModels(baseURL, k);
      case "gemini":     return this.fetchGeminiModels(baseURL, k);
      case "groq":       return this.fetchOpenAICompatibleModels(baseURL, k, "groq");
      case "openai":     return this.fetchOpenAICompatibleModels(baseURL, k, "openai");
      case "anthropic":  return this.fetchAnthropicModels(baseURL, k);
      case "ollama":     return this.fetchOllamaModels(baseURL);
      default:           throw new Error(`Unsupported provider: ${provider}`);
    }
  }

  private async fetchOpenRouterModels(
    baseURL: string,
    apiKey: string
  ): Promise<ModelInfo[]> {
    const res = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`OpenRouter API ${res.status}: ${await res.text().catch(() => "")}`);
    const json: any = await res.json();
    const models: any[] = json.data ?? [];
    return models.map((m: any) => this.toModelInfo("openrouter", m.id, m));
  }

  private async fetchOpenAICompatibleModels(
    baseURL: string,
    apiKey: string,
    provider: ProviderKey
  ): Promise<ModelInfo[]> {
    const res = await fetch(`${baseURL}/models`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`${provider} API ${res.status}: ${await res.text().catch(() => "")}`);
    const json: any = await res.json();
    const models: any[] = json.data ?? [];
    return models.map((m: any) => this.toModelInfo(provider, m.id, m));
  }

  private async fetchGeminiModels(
    baseURL: string,
    apiKey: string
  ): Promise<ModelInfo[]> {
    const url = `${baseURL}/models?key=${apiKey}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text().catch(() => "")}`);
    const json: any = await res.json();
    const models: any[] = json.models ?? [];
    return models
      .filter((m: any) => m.name?.includes("gemini"))
      .map((m: any) => {
        const id = m.name.replace(/^models\//, "");
        return this.toModelInfo("gemini", id, {
          ...m,
          description: m.description,
          contextWindow: m.inputTokenLimit ?? 32768,
          outputTokenLimit: m.outputTokenLimit,
        });
      });
  }

  private async fetchAnthropicModels(
    baseURL: string,
    apiKey: string
  ): Promise<ModelInfo[]> {
    const res = await fetch(`${baseURL}/models`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text().catch(() => "")}`);
    const json: any = await res.json();
    const models: any[] = json.data ?? [];
    return models.map((m: any) => this.toModelInfo("anthropic", m.id ?? m.name, m));
  }

  private async fetchOllamaModels(baseURL: string): Promise<ModelInfo[]> {
    const res = await fetch(`${baseURL}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Ollama API ${res.status}: ${await res.text().catch(() => "")}`);
    const json: any = await res.json();
    const models: any[] = json.models ?? [];
    return models.map((m: any) => {
      const id = m.name;
      const ctxWindow = (m.details?.context_length ?? estimateContextWindow(id));
      return this.toModelInfo("ollama", id, {
        ...m,
        contextWindow: ctxWindow,
      });
    });
  }

  // ── Model Info Builder ──────────────────────────────────────────

  private toModelInfo(
    provider: ProviderKey,
    id: string,
    raw: any
  ): ModelInfo {
    const contextWindow = raw.contextWindow ?? raw.context_length ??
      estimateContextWindow(id, raw.contextWindow);
    const capabilities = inferCapabilities(id, raw.name ?? id, contextWindow);
    const mode = inferModelMode(id, contextWindow);

    return {
      id,
      provider,
      name: raw.name ?? id,
      description: raw.description ?? raw.object ?? "",
      contextWindow,
      maxOutputTokens: raw.outputTokenLimit ?? raw.maxTokens,
      capabilities,
      mode,
      pricing: raw.pricing ? {
        perToken: raw.pricing.prompt ?? raw.pricing.perToken,
        perRequest: raw.pricing.request,
      } : undefined,
      fetchedAt: Date.now(),
    };
  }
}

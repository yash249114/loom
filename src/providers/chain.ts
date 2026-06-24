import {
  ProviderKey,
  ProviderRequest,
  ProviderStreamChunk,
  RoutingDecision,
  LoomConfig,
  ModelInfo,
} from "../core/types.js";
import { createRoutedProvider } from "./factory.js";
import { HealthMonitor } from "./health.js";
import { ModelControlPlane } from "./mcp.js";

export interface FallbackChainEntry {
  provider: ProviderKey;
  model: string;
  reason: string;
  priority: number;
}

export interface FallbackResult {
  success: boolean;
  provider: ProviderKey;
  model: string;
  error?: string;
  attempts: number;
}

export interface ChainExecutionOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}

export class FallbackChainExecutor {
  private health: HealthMonitor;
  private mcp: ModelControlPlane;
  private config: LoomConfig;

  constructor(
    health: HealthMonitor,
    mcp: ModelControlPlane,
    config: LoomConfig
  ) {
    this.health = health;
    this.mcp = mcp;
    this.config = config;
  }

  buildChain(decision: RoutingDecision): FallbackChainEntry[] {
    const chain: FallbackChainEntry[] = [];

    chain.push({
      provider: decision.provider as ProviderKey,
      model: decision.model,
      reason: "primary",
      priority: 0,
    });

    const healthRanking = this.health.rankProvidersByHealth(
      ["openrouter", "gemini", "groq", "openai", "anthropic"],
      decision.provider as ProviderKey
    );

    let priority = 1;
    for (const providerKey of healthRanking) {
      if (providerKey === decision.provider) continue;

      const fallbackModel = this.selectFallbackModel(providerKey);
      if (fallbackModel) {
        chain.push({
          provider: providerKey,
          model: fallbackModel.id,
          reason: `fallback (${this.health.getStatus(providerKey)})`,
          priority: priority++,
        });
      }
    }

    if (this.config.routing.fallbackToLocal) {
      chain.push({
        provider: "ollama",
        model: this.config.models?.local ?? "qwen2.5-coder:7b",
        reason: "local fallback",
        priority: priority++,
      });
    }

    return chain;
  }

  private selectFallbackModel(provider: ProviderKey): ModelInfo | null {
    const models = this.mcp.getModelsForProvider(provider);
    if (models.length === 0) return null;

    const scored = models
      .map((m) => ({
        model: m,
        score:
          m.capabilities.coding * 3 +
          m.capabilities.reasoning * 2 +
          m.capabilities.general +
          (m.capabilities.toolCalls ? 5 : 0) -
          (m.pricing ? m.pricing.perToken * 1000000 : 0),
      }))
      .sort((a, b) => b.score - a.score);

    return scored[0]?.model ?? null;
  }

  async executeWithFallback(
    request: ProviderRequest,
    decision: RoutingDecision,
    options: ChainExecutionOptions = {}
  ): Promise<AsyncIterable<ProviderStreamChunk>> {
    const maxRetries = options.maxRetries ?? 3;
    const retryDelayMs = options.retryDelayMs ?? 1000;

    const chain = this.buildChain(decision);

    for (let attempt = 0; attempt < Math.min(maxRetries, chain.length); attempt++) {
      const entry = chain[attempt];

      try {
        const provider = createRoutedProvider(
          { provider: entry.provider, model: entry.model, reason: entry.reason, category: "general" },
          this.config
        );

        const stream = provider.stream({
          ...request,
          model: entry.model,
        });

        return this.wrapWithHealthTracking(entry.provider, stream);
      } catch (err: any) {
        this.health.recordCheck(entry.provider, {
          timestamp: Date.now(),
          latencyMs: 0,
          ok: false,
          error: err.message,
        });

        if (attempt < chain.length - 1) {
          await this.delay(retryDelayMs * (attempt + 1));
        }
      }
    }

    throw new Error("All providers in fallback chain failed");
  }

  private async *wrapWithHealthTracking(
    providerKey: ProviderKey,
    stream: AsyncIterable<ProviderStreamChunk>
  ): AsyncGenerator<ProviderStreamChunk> {
    const start = Date.now();
    let hasContent = false;

    try {
      for await (const chunk of stream) {
        if (chunk.delta) hasContent = true;
        yield chunk;
      }

      this.health.recordCheck(providerKey, {
        timestamp: Date.now(),
        latencyMs: Date.now() - start,
        ok: true,
      });
    } catch (err: any) {
      this.health.recordCheck(providerKey, {
        timestamp: Date.now(),
        latencyMs: Date.now() - start,
        ok: false,
        error: err.message,
      });
      throw err;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getChainInfo(decision: RoutingDecision): {
    chain: FallbackChainEntry[];
    healthStatus: Record<ProviderKey, string>;
  } {
    const chain = this.buildChain(decision);
    const healthStatus: Record<string, string> = {};

    for (const entry of chain) {
      healthStatus[entry.provider] = this.health.getStatus(entry.provider);
    }

    return {
      chain,
      healthStatus: healthStatus as Record<ProviderKey, string>,
    };
  }
}

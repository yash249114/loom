import {
  ProviderKey,
  ModelInfo,
  ProviderConfig,
  ModelCapabilities,
  ModelMode,
} from "../core/types.js";
import { HealthMonitor, ProviderHealth } from "./health.js";

export interface ModelScore {
  model: ModelInfo;
  score: number;
  reasons: string[];
}

export interface RoutingRequest {
  category: "coding" | "reasoning" | "general" | "local";
  mode: ModelMode;
  preferLocal?: boolean;
  requireVision?: boolean;
  requireTools?: boolean;
  maxCostPer1k?: number;
  minContextWindow?: number;
}

export interface RoutingResult {
  primary: ModelScore;
  fallbacks: ModelScore[];
  routingMode: ModelMode;
  category: string;
}

export class ModelControlPlane {
  private models: Map<ProviderKey, ModelInfo[]> = new Map();
  private health: HealthMonitor;

  constructor(healthMonitor: HealthMonitor) {
    this.health = healthMonitor;
  }

  updateModels(provider: ProviderKey, models: ModelInfo[]): void {
    this.models.set(provider, models);
  }

  getAllModels(): ModelInfo[] {
    const all: ModelInfo[] = [];
    for (const models of this.models.values()) {
      all.push(...models);
    }
    return all;
  }

  getModelsForProvider(provider: ProviderKey): ModelInfo[] {
    return this.models.get(provider) ?? [];
  }

  scoreModel(model: ModelInfo, request: RoutingRequest): ModelScore {
    let score = 0;
    const reasons: string[] = [];

    const capabilityScore = this.scoreCapabilities(model, request);
    score += capabilityScore.score;
    reasons.push(...capabilityScore.reasons);

    const modeScore = this.scoreMode(model, request.mode);
    score += modeScore.score;
    reasons.push(...modeScore.reasons);

    const healthScore = this.scoreHealth(model.provider as ProviderKey);
    score += healthScore.score;
    reasons.push(...healthScore.reasons);

    const constraintScore = this.scoreConstraints(model, request);
    score += constraintScore.score;
    reasons.push(...constraintScore.reasons);

    return { model, score, reasons };
  }

  selectModel(request: RoutingRequest): RoutingResult | null {
    const allModels = this.getAllModels();
    if (allModels.length === 0) return null;

    const scored = allModels
      .map((m) => this.scoreModel(m, request))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) return null;

    const primary = scored[0];
    const fallbacks = scored.slice(1, 4);

    return {
      primary,
      fallbacks,
      routingMode: request.mode,
      category: request.category,
    };
  }

  private scoreCapabilities(
    model: ModelInfo,
    request: RoutingRequest
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    const caps = model.capabilities;

    const categoryWeights: Record<string, keyof ModelCapabilities> = {
      coding: "coding",
      reasoning: "reasoning",
      general: "general",
    };

    const capKey = categoryWeights[request.category];
    if (capKey && typeof caps[capKey] === "number") {
      const capValue = caps[capKey] as number;
      score += capValue * 10;
      if (capValue >= 8) reasons.push(`${request.category} specialist`);
    }

    if (request.requireVision && !caps.vision) {
      score -= 1000;
      reasons.push("missing vision");
    }

    if (request.requireTools && !caps.toolCalls) {
      score -= 1000;
      reasons.push("missing tool support");
    }

    if (caps.vision) score += 2;
    if (caps.toolCalls) score += 5;
    if (caps.streaming) score += 1;

    return { score, reasons };
  }

  private scoreMode(
    model: ModelInfo,
    targetMode: ModelMode
  ): { score: number; reasons: string[] } {
    const score = 0;
    const reasons: string[] = [];
    const modeOrder: ModelMode[] = [
      "low",
      "medium",
      "high",
      "very-high",
      "max",
      "ultra",
    ];

    if (targetMode === "auto") {
      return { score: 50, reasons: ["auto mode"] };
    }

    const targetIdx = modeOrder.indexOf(targetMode);
    const modelIdx = modeOrder.indexOf(model.mode);

    if (modelIdx === targetIdx) {
      return { score: 100, reasons: [`exact mode match: ${targetMode}`] };
    }

    if (modelIdx === targetIdx - 1 || modelIdx === targetIdx + 1) {
      return { score: 70, reasons: [`adjacent mode: ${model.mode}`] };
    }

    return { score: Math.max(0, 50 - Math.abs(modelIdx - targetIdx) * 15), reasons: [`mode ${model.mode}`] };
  }

  private scoreHealth(provider: ProviderKey): {
    score: number;
    reasons: string[];
  } {
    const status = this.health.getStatus(provider);
    const h = this.health.getHealth(provider);

    switch (status) {
      case "healthy":
        return {
          score: 30,
          reasons: [
            `healthy (${h.avgLatencyMs}ms avg, ${h.uptimePercent}% uptime)`,
          ],
        };
      case "degraded":
        return {
          score: 10,
          reasons: [`degraded (${h.uptimePercent}% uptime)`],
        };
      case "unhealthy":
        return { score: -50, reasons: [`unhealthy (${h.consecutiveFailures} failures)`] };
    }
  }

  private scoreConstraints(
    model: ModelInfo,
    request: RoutingRequest
  ): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    if (
      request.minContextWindow &&
      model.contextWindow < request.minContextWindow
    ) {
      score -= 200;
      reasons.push(
        `context too small (${model.contextWindow} < ${request.minContextWindow})`
      );
    }

    if (request.maxCostPer1k && model.pricing) {
      const costPer1k = model.pricing.perToken * 1000;
      if (costPer1k > request.maxCostPer1k) {
        score -= 100;
        reasons.push(`too expensive ($${costPer1k}/1k > $${request.maxCostPer1k}/1k)`);
      }
    }

    const contextScore = Math.min(20, Math.log10(model.contextWindow) * 5);
    score += contextScore;

    if (model.pricing) {
      if (model.pricing.perToken === 0) score += 15;
      else if (model.pricing.perToken < 0.000001) score += 10;
      else if (model.pricing.perToken < 0.00001) score += 5;
    }

    return { score, reasons };
  }

  getRecommendation(request: RoutingRequest): {
    recommendation: string;
    reasoning: string[];
  } {
    const result = this.selectModel(request);
    if (!result) {
      return {
        recommendation: "No suitable model found",
        reasoning: ["No models match the criteria"],
      };
    }

    const topReasons = result.primary.reasons.slice(0, 3);
    const fallbackInfo =
      result.fallbacks.length > 0
        ? ` (${result.fallbacks.length} fallbacks available)`
        : "";

    return {
      recommendation: `${result.primary.model.id} (score: ${result.primary.score})${fallbackInfo}`,
      reasoning: topReasons,
    };
  }
}

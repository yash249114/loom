import {
  ProviderKey,
  ModelInfo,
  ModelMode,
  LoomConfig,
  RoutingDecision,
} from "../core/types.js";
import { HealthMonitor } from "./health.js";
import { ModelControlPlane, RoutingRequest } from "./mcp.js";

export type TaskCategory = "coding" | "reasoning" | "general" | "local";

export interface ClassificationResult {
  category: TaskCategory;
  confidence: number;
  signals: string[];
}

export interface IntelligentRoutingResult {
  decision: RoutingDecision;
  classification: ClassificationResult;
  alternatives: RoutingDecision[];
  reasoning: string[];
}

const CODING_SIGNALS = [
  "write", "fix", "refactor", "implement", "debug", "function", "class",
  "error", "code", "test", "lint", "build", "compile", "syntax", "import",
  "export", "module", "api", "endpoint", "hook", "component", "script",
  "bug", "patch", "edit", "create", "delete", "rename", "move", "add",
  "remove", "update", "type", "interface", "typescript", "javascript",
  "python", "rust", "golang", "java", "css", "html", "sql", "regex",
  "algorithm", "data structure", "file", "directory", "package", "dependency",
];

const REASONING_SIGNALS = [
  "design", "architect", "plan", "should i", "tradeoff", "compare",
  "analyze", "why", "how does", "explain", "review", "structure",
  "approach", "strategy", "decision", "evaluate", "consider", "pros",
  "cons", "recommend", "best practice", "pattern", "alternative",
  "architecture", "scalability", "performance", "security", "trade-off",
];

export class IntelligentRouter {
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

  classifyTask(prompt: string): ClassificationResult {
    const lower = prompt.toLowerCase();
    const words = lower.split(/\s+/);

    let codingScore = 0;
    let reasoningScore = 0;
    const signals: string[] = [];

    for (const signal of CODING_SIGNALS) {
      if (lower.includes(signal)) {
        codingScore += 1;
        signals.push(`coding:${signal}`);
      }
    }

    for (const signal of REASONING_SIGNALS) {
      if (lower.includes(signal)) {
        reasoningScore += 1;
        signals.push(`reasoning:${signal}`);
      }
    }

    const maxScore = Math.max(codingScore, reasoningScore);
    const totalScore = codingScore + reasoningScore;
    const confidence = totalScore > 0 ? maxScore / totalScore : 0.5;

    let category: TaskCategory;
    if (codingScore > reasoningScore) {
      category = "coding";
    } else if (reasoningScore > codingScore) {
      category = "reasoning";
    } else {
      category = "general";
    }

    return { category, confidence, signals };
  }

  route(
    prompt: string,
    mode: ModelMode = "auto",
    options: {
      preferLocal?: boolean;
      requireVision?: boolean;
      requireTools?: boolean;
      maxCostPer1k?: number;
      minContextWindow?: number;
    } = {}
  ): IntelligentRoutingResult {
    const classification = this.classifyTask(prompt);
    const reasoning: string[] = [];

    if (options.preferLocal || this.config.routing.defaultMode === "local") {
      classification.category = "local";
      reasoning.push("Forced local mode");
    }

    const request: RoutingRequest = {
      category: classification.category,
      mode,
      preferLocal: options.preferLocal,
      requireVision: options.requireVision,
      requireTools: options.requireTools ?? true,
      maxCostPer1k: options.maxCostPer1k,
      minContextWindow: options.minContextWindow,
    };

    const result = this.mcp.selectModel(request);

    if (!result) {
      const fallbackDecision: RoutingDecision = {
        provider: "ollama",
        model: this.config.models?.local ?? "qwen2.5-coder:7b",
        reason: "no suitable model found, using local fallback",
        category: classification.category,
      };

      return {
        decision: fallbackDecision,
        classification,
        alternatives: [],
        reasoning: ["No suitable remote model, falling back to local"],
      };
    }

    const primaryScore = result.primary;
    const primary = primaryScore.model;
    const decision: RoutingDecision = {
      provider: primary.provider as ProviderKey,
      model: primary.id,
      reason: `scored ${primaryScore.score} (${primaryScore.reasons.join(", ")})`,
      category: classification.category,
    };

    reasoning.push(`Category: ${classification.category} (${Math.round(classification.confidence * 100)}% confidence)`);
    reasoning.push(`Selected: ${primary.id} from ${primary.provider}`);
    reasoning.push(`Score breakdown: ${primaryScore.reasons.join("; ")}`);

    const alternatives: RoutingDecision[] = result.fallbacks.map((f) => ({
      provider: f.model.provider as ProviderKey,
      model: f.model.id,
      reason: `scored ${f.score} (${f.reasons.join(", ")})`,
      category: classification.category,
    }));

    return { decision, classification, alternatives, reasoning };
  }

  suggestMode(prompt: string): ModelMode {
    const classification = this.classifyTask(prompt);

    if (classification.confidence < 0.3) return "medium";

    const lower = prompt.toLowerCase();

    if (
      lower.includes("simple") ||
      lower.includes("quick") ||
      lower.includes("basic") ||
      lower.includes("just")
    ) {
      return "low";
    }

    if (
      lower.includes("complex") ||
      lower.includes("advanced") ||
      lower.includes("sophisticated") ||
      lower.includes("enterprise")
    ) {
      return "high";
    }

    if (
      lower.includes("critical") ||
      lower.includes("production") ||
      lower.includes("security") ||
      lower.includes("optimize")
    ) {
      return "very-high";
    }

    if (classification.category === "coding") return "high";
    if (classification.category === "reasoning") return "very-high";
    return "medium";
  }

  explainRouting(prompt: string, mode?: ModelMode): string[] {
    const effectiveMode = mode ?? this.suggestMode(prompt);
    const result = this.route(prompt, effectiveMode);

    const lines: string[] = [
      `Task: "${prompt.slice(0, 80)}${prompt.length > 80 ? "..." : ""}"`,
      `Classification: ${result.classification.category} (${Math.round(result.classification.confidence * 100)}%)`,
      `Routing Mode: ${effectiveMode}`,
      `Selected: ${result.decision.model} @ ${result.decision.provider}`,
      `Reason: ${result.decision.reason}`,
      "",
      "Alternatives:",
    ];

    for (const alt of result.alternatives.slice(0, 3)) {
      lines.push(`  - ${alt.model} @ ${alt.provider} (${alt.reason})`);
    }

    const chainInfo = this.health.getReport();
    lines.push("");
    lines.push("Provider Health:");
    for (const [key, health] of Object.entries(chainInfo.providers)) {
      const status = this.health.getStatus(key as ProviderKey);
      lines.push(
        `  ${key}: ${status} (avg ${health.avgLatencyMs}ms, ${health.uptimePercent}% uptime)`
      );
    }

    return lines;
  }
}

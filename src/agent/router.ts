/**
 * Task router — classifies user prompts and routes to the appropriate
 * model/provider based on task type and configuration.
 */
import type { LoomConfig, RoutingDecision, TaskCategory } from "../core/types.js";

const CODE_SIGNALS =
  /\b(write|fix|refactor|implement|debug|function|class|error|code|test|lint|build|compile|syntax|import|export|module|api|endpoint|hook|component|script|bug|patch|edit|create|delete|rename|move|add|remove|update|type|interface)\b/i;

const REASON_SIGNALS =
  /\b(design|architect|plan|should i|tradeoff|compare|analyze|why|how does|explain|review|structure|approach|strategy|decision|evaluate|consider|pros|cons|recommend|best practice|pattern|alternative)\b/i;

/**
 * Classify a user prompt into a task category based on keyword signals.
 */
export function classifyTask(prompt: string): TaskCategory {
  const codeMatches = prompt.match(CODE_SIGNALS);
  const reasonMatches = prompt.match(REASON_SIGNALS);
  const codeScore = codeMatches ? codeMatches.length : 0;
  const reasonScore = reasonMatches ? reasonMatches.length : 0;

  if (codeScore > reasonScore) return "coding";
  if (reasonScore > codeScore) return "reasoning";
  return "general";
}

/**
 * Route a prompt to the appropriate model and provider.
 *
 * - If `forceLocal` or routing mode is "local", always use Ollama.
 * - If routing mode is "remote", always use OpenRouter.
 * - If routing mode is "auto" (default), classify the task and pick the model.
 */
export function routeTask(
  prompt: string,
  config: LoomConfig,
  forceLocal = false
): RoutingDecision {
  if (forceLocal || config.routing.defaultMode === "local") {
    return {
      category: "local",
      model: config.models.local,
      provider: "ollama",
      reason: forceLocal ? "forced local" : "config: local mode",
    };
  }

  if (config.routing.defaultMode === "remote") {
    const category = classifyTask(prompt);
    return {
      category,
      model: config.models[category],
      provider: "openrouter",
      reason: `remote mode, classified as ${category}`,
    };
  }

  // Auto mode: classify and route
  const category = classifyTask(prompt);
  const model = config.models[category];

  return {
    category,
    model,
    provider: "openrouter",
    reason: `classified as ${category}`,
  };
}

/**
 * Build a 3-tier fallback chain for a routing decision:
 * 1. Primary model (from the original decision)
 * 2. Cloud fallback (openrouter/free or config.models.fallback)
 * 3. Local Ollama (config.models.local)
 *
 * The agent tries each in order; on retryable errors (429, 5xx) it
 * advances to the next candidate. Non-retryable errors stop the chain.
 */
export function getFallbackChain(
  decision: RoutingDecision,
  config: LoomConfig
): RoutingDecision[] {
  const chain: RoutingDecision[] = [decision];

  // Only add cloud fallback if the primary was already on OpenRouter
  // (avoids adding a second OpenRouter attempt for local-only decisions)
  if (decision.provider === "openrouter") {
    const fallbackModel = config.models?.fallback ?? "openrouter/free";
    // Don't duplicate if the primary model IS the fallback model
    if (fallbackModel !== decision.model) {
      chain.push({
        category: decision.category,
        model: fallbackModel,
        provider: "openrouter",
        reason: "rate-limited, trying cloud fallback",
      });
    }
  }

  // Always add local Ollama as final fallback
  if (config.routing?.fallbackToLocal !== false) {
    chain.push({
      category: "local",
      model: config.models?.local ?? "qwen2.5-coder:7b",
      provider: "ollama",
      reason: "cloud unavailable, using local Ollama",
    });
  }

  return chain;
}

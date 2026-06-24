/**
 * Capability Mapping Engine
 *
 * Dynamically assigns capability scores and quality tiers to models
 * based on model name patterns, known model families, and context window size.
 * No hardcoded model IDs — uses pattern matching and heuristics.
 */
import type { ModelInfo, ModelCapabilities, ModelMode, ProviderKey } from "../core/types.js";

// ── Quality Tier Heuristics ──────────────────────────────────────

const BUDGET_PATTERNS = /(mini|small|tiny|nano|micro|light|1b|3b|0\.5b|free)\b/i;
const MEDIUM_PATTERNS = /(7b|8b|9b|12b|13b|14b|16b|20b)\b/i;
const HIGH_PATTERNS = /(70b|34b|32b|30b|27b|24b|22b|21b)\b/i;
const VERY_HIGH_PATTERNS = /(120b|123b|180b|200b|240b|270b|400b|450b)\b/i;
const ULTRA_PATTERNS = /(540b|1t|1\.6t)\b/i;

const CODER_PATTERNS = /(coder|code|dev|program|engineer|debug)\b/i;
const REASON_PATTERNS = /(reason|think|deep|logic|math|science)\b/i;
const VISION_PATTERNS = /(vision|multimodal|image|visual)\b/i;
const INSTRUCT_PATTERNS = /(instruct|chat|it)\b/i;

export function inferModelMode(id: string, contextWindow: number): ModelMode {
  if (ULTRA_PATTERNS.test(id)) return "ultra";
  if (VERY_HIGH_PATTERNS.test(id)) return "max";
  if (HIGH_PATTERNS.test(id)) return "very-high";
  if (MEDIUM_PATTERNS.test(id)) return "high";
  if (BUDGET_PATTERNS.test(id)) return "low";
  if (contextWindow >= 1000000) return "ultra";
  if (contextWindow >= 200000) return "max";
  if (contextWindow >= 100000) return "very-high";
  if (contextWindow >= 32000) return "high";
  if (contextWindow >= 16000) return "medium";
  return "low";
}

export function inferCapabilities(
  id: string,
  name: string,
  contextWindow: number
): ModelCapabilities {
  const lowerId = id.toLowerCase();
  const lowerName = name.toLowerCase();

  const isCoder = CODER_PATTERNS.test(lowerId) || CODER_PATTERNS.test(lowerName);
  const isReason = REASON_PATTERNS.test(lowerId) || REASON_PATTERNS.test(lowerName);
  const hasVision = VISION_PATTERNS.test(lowerId) || VISION_PATTERNS.test(lowerName);
  const isInstruct = INSTRUCT_PATTERNS.test(lowerId) || INSTRUCT_PATTERNS.test(lowerName) || !lowerId.includes("base");

  // Known model family capability boosts
  const isClaude = lowerId.includes("claude");
  const isGPT4 = /gpt-4/.test(lowerId);
  const isGemini = lowerId.includes("gemini");
  const isLlama = lowerId.includes("llama");
  const isQwen = lowerId.includes("qwen");
  const isMistral = lowerId.includes("mistral") || lowerId.includes("mixtral");
  const isDeepseek = lowerId.includes("deepseek");

  const sizeScore = inferSizeScore(lowerId, contextWindow);

  let coding = 5;
  let reasoning = 5;
  let general = 5;

  if (isCoder) coding += 3;
  if (isReason) reasoning += 3;
  if (isInstruct) general += 1;

  if (isClaude) { coding += 1; reasoning += 2; }
  if (isGPT4) { coding += 2; reasoning += 1; general += 1; }
  if (isGemini) { reasoning += 1; general += 2; }
  if (isLlama) { coding += 1; general += 1; }
  if (isQwen) { coding += 2; }
  if (isMistral) { coding += 1; }
  if (isDeepseek) { coding += 2; reasoning += 1; }

  coding = clamp(coding + Math.round(sizeScore * 2));
  reasoning = clamp(reasoning + Math.round(sizeScore * 1.5));
  general = clamp(general + Math.round(sizeScore * 1));

  return {
    coding: clamp(coding),
    reasoning: clamp(reasoning),
    general: clamp(general),
    vision: hasVision || isGemini || isClaude,
    toolCalls: isInstruct && !lowerId.includes("deprecated"),
    streaming: true,
  };
}

function inferSizeScore(lowerId: string, contextWindow: number): number {
  if (contextWindow >= 1000000) return 0.8;
  if (contextWindow >= 200000) return 0.6;
  if (contextWindow >= 100000) return 0.5;
  if (contextWindow >= 32000) return 0.3;
  if (contextWindow >= 8000) return 0.2;
  if (/\d{3,4}b/.test(lowerId)) {
    const match = lowerId.match(/(\d+)b/);
    if (match) {
      const params = parseInt(match[1], 10);
      if (params >= 500) return 0.8;
      if (params >= 100) return 0.6;
      if (params >= 30) return 0.4;
      if (params >= 10) return 0.2;
    }
  }
  return 0;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(10, n));
}

// ── Context Window Estimation ────────────────────────────────────

export function estimateContextWindow(modelId: string, declared?: number): number {
  if (declared && declared > 0) return declared;

  const lower = modelId.toLowerCase();

  // Claude models
  if (lower.includes("claude") && lower.includes("opus")) return 200000;
  if (lower.includes("claude") && lower.includes("sonnet")) return 200000;
  if (lower.includes("claude") && lower.includes("haiku")) return 200000;
  if (lower.includes("claude")) return 100000;

  // Gemini models
  if (lower.includes("gemini") && lower.includes("pro")) return 1048576;
  if (lower.includes("gemini") && lower.includes("flash")) return 1048576;
  if (lower.includes("gemini")) return 32768;

  // GPT-4 models
  if (lower.includes("gpt-4") && lower.includes("turbo")) return 128000;
  if (lower.includes("gpt-4") && lower.includes("omini")) return 128000;
  if (lower.includes("gpt-4")) return 8192;
  if (lower.includes("gpt-3.5")) return 16385;

  // Llama models
  if (lower.includes("llama") || lower.includes("llama")) return 8192;
  if (lower.includes("qwen") && lower.includes("coder")) return 32768;
  if (lower.includes("qwen")) return 32768;

  // Mistral
  if (lower.includes("mistral") || lower.includes("mixtral")) return 32768;

  // DeepSeek
  if (lower.includes("deepseek")) return 65536;

  // Default fallback
  return 4096;
}

// ── Provider Discovery URLs ──────────────────────────────────────

export interface ProviderEndpointConfig {
  baseURL: string;
  modelsPath: string;
  apiKeyHeader: string;
  apiKeyEnv: string;
  defaultBaseURL: string;
}

export const PROVIDER_ENDPOINTS: Record<string, ProviderEndpointConfig> = {
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    modelsPath: "/models",
    apiKeyHeader: "Authorization",
    apiKeyEnv: "OPENROUTER_API_KEY",
    defaultBaseURL: "https://openrouter.ai/api/v1",
  },
  gemini: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    modelsPath: "/models",
    apiKeyHeader: "x-goog-api-key",
    apiKeyEnv: "GEMINI_API_KEY",
    defaultBaseURL: "https://generativelanguage.googleapis.com/v1beta",
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    modelsPath: "/models",
    apiKeyHeader: "Authorization",
    apiKeyEnv: "GROQ_API_KEY",
    defaultBaseURL: "https://api.groq.com/openai/v1",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    modelsPath: "/models",
    apiKeyHeader: "Authorization",
    apiKeyEnv: "OPENAI_API_KEY",
    defaultBaseURL: "https://api.openai.com/v1",
  },
  anthropic: {
    baseURL: "https://api.anthropic.com/v1",
    modelsPath: "/models",
    apiKeyHeader: "x-api-key",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    defaultBaseURL: "https://api.anthropic.com/v1",
  },
  ollama: {
    baseURL: "http://127.0.0.1:11434",
    modelsPath: "/api/tags",
    apiKeyHeader: "",
    apiKeyEnv: "",
    defaultBaseURL: "http://127.0.0.1:11434",
  },
};

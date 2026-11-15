# Model Discovery System

## Overview

Model Discovery is the subsystem responsible for dynamically retrieving, classifying, caching, and selecting AI models from configured providers. Models are **never hardcoded** — every model identifier comes from the provider's API.

## Discovery Flow

```
  Provider Connected
         │
         ▼
  Fetch Models ──────────────────────────────────┐
    │ (GET /v1/models or equivalent)             │
    ▼                                            │
  Raw Model List                                  │
    │                                            │
    ▼                                            │
  Normalize ───→ Canonical Model Shape           │
    │                                            │
    ▼                                            │
  Enrich with Capabilities                       │
    │ (infer from model name/ID patterns)        │
    ▼                                            │
  Classify by Tier                               │
    │                                            │
    ▼                                            │
  Cache to Disk ──→ .loom/models-cache/          │
    │                                            │
    ▼                                            │
  Return to Caller ◄─────────────────────────────┘
```

## Normalization Pipeline

### Step 1: Fetch Raw Models

Each provider's API returns models in a different format. The connector normalizes them:

```typescript
// OpenRouter response
GET https://openrouter.ai/api/v1/models
→ { data: [{ id: "qwen/qwen3-coder:free", name: "Qwen3 Coder (Free)", context_length: 32768, pricing: { prompt: "0", completion: "0" }, ... }] }

// OpenAI response
GET https://api.openai.com/v1/models
→ { data: [{ id: "gpt-4o", created: 1700000000, ... }] }

// Ollama response
GET http://localhost:11434/api/tags
→ { models: [{ name: "qwen2.5-coder:7b", size: 4800000000, ... }] }
```

### Step 2: Normalize to Canonical Shape

```typescript
interface CanonicalModel {
  id: string;                    // Provider's model ID (e.g. "gpt-4o")
  provider: string;              // Provider ID (e.g. "openai")
  
  // Identification
  displayName: string;           // Human-readable name
  family: string;                // Model family (e.g. "gpt-4", "claude-3", "qwen")
  version: string;               // Version string if available
  
  // Capacity
  contextWindow: number;         // Maximum context tokens
  maxOutputTokens: number;       // Maximum output tokens (0 = unknown)
  
  // Capabilities (inferred or explicit)
  capabilities: {
    chat: boolean;               // General chat
    code: boolean;               // Code generation
    reasoning: boolean;          // Chain-of-thought
    vision: boolean;             // Image input
    functionCalling: boolean;    // Tool/function calling
    streaming: boolean;          // SSE streaming
    jsonMode: boolean;           // Structured output
  };
  
  // Performance tier (inferred)
  speedTier: SpeedTier;          // "fast" | "medium" | "slow" | "unknown"
  qualityTier: QualityTier;      // "low" | "medium" | "high" | "frontier" | "unknown"
  
  // Pricing (from provider API or metadata)
  pricing: {
    inputPer1K: number;          // USD per 1K input tokens
    outputPer1K: number;         // USD per 1K output tokens
    currency: "USD";
    tier: "free" | "paid" | "unknown";
  };
  
  // Metadata
  updatedAt: string;             // ISO date from provider
  raw: unknown;                  // Original provider response for reference
}
```

### Step 3: Capability Inference

Since most provider APIs don't return structured capability data, capabilities are inferred:

```typescript
class CapabilityInferrer {
  infer(model: { id: string; provider: string }): CanonicalModel["capabilities"] {
    const id = model.id.toLowerCase();
    const provider = model.provider;
    
    return {
      chat: true,  // All LLM models support chat
      
      code: /coder|code|instruct|deepseek|llama|gpt|claude|gemini/i.test(id),
      
      reasoning: /reason|think|deepseek-r1|qwq|o1|o3|claude|gemini-2.5/i.test(id),
      
      vision: /vision|gemini|gpt-4o|claude-3\.5|claude-4|llama-3\.2-.*vision/i.test(id),
      
      functionCalling: !/vision|image|embed/i.test(id) && provider !== "gemini-legacy",
      
      streaming: true,  // All modern providers support streaming
      
      jsonMode: /gpt-4|gpt-3\.5|claude-3|gemini-1\.5/i.test(id),
    };
  }
}
```

### Step 4: Tier Classification

Models are classified into tiers based on known benchmarks and model families:

```typescript
type QualityTier = "frontier" | "high" | "medium" | "low" | "unknown";

function classifyTier(model: CanonicalModel): QualityTier {
  const id = model.id.toLowerCase();
  
  // Frontier: best available models
  if (/claude-4|claude-3\.5-sonnet|gpt-4o|o1|o3|gemini-2\.5-pro|deepseek-r1/i.test(id))
    return "frontier";
  
  // High: capable, slightly older or smaller
  if (/claude-3-haiku|gpt-4o-mini|gemini-2\.5-flash|llama-3\.3|qwen3-coder/i.test(id))
    return "high";
  
  // Medium: good for most tasks
  if (/llama-3\.2|mistral|mixtral|gemma-2|qwen2\.5/i.test(id))
    return "medium";
  
  // Low: lightweight, fast
  if (/llama-3\.2-[13]b|phi|tiny|nano/i.test(id))
    return "low";
  
  return "unknown";
}
```

### Step 5: Caching

```typescript
interface ModelCacheEntry {
  provider: string;
  models: CanonicalModel[];
  fetchedAt: number;             // Unix timestamp
  expiresAt: number;             // Cache expiry timestamp
  etag?: string;                 // For conditional requests
}

class ModelCache {
  private cacheDir: string;      // .loom/models-cache/
  private defaultTTL: number;    // 3600000 (1 hour)

  async get(provider: string): Promise<CanonicalModel[] | null>;
  async set(provider: string, models: CanonicalModel[]): Promise<void>;
  async invalidate(provider: string): Promise<void>;
  async isStale(provider: string): Promise<boolean>;
  
  // Cache file: .loom/models-cache/openrouter.json
  private cachePath(provider: string): string;
}
```

## Selection Modes

The selection mode determines how a model is chosen from the available list:

### Mode Definitions

```typescript
type SelectionMode =
  | "auto"        // Let the task router decide based on task classification
  | "low"         // Cheapest model with required capabilities
  | "medium"      // Balanced cost and capability
  | "high"        // Strong model for complex tasks (context >= 64K)
  | "very_high"   // Frontier model (context >= 128K, strong reasoning)
  | "max"         // Largest context window available
  | "ultra";      // Maximum capability regardless of cost
```

### Mode Resolution Algorithm

```typescript
async function selectModel(
  provider: string,
  mode: SelectionMode,
  taskCategory: TaskCategory
): Promise<CanonicalModel> {
  const models = await getModels(provider);
  
  // Filter to models that support the task category
  const capable = models.filter(m => matchesTask(m, taskCategory));
  
  if (capable.length === 0) {
    throw new Error(`No ${provider} models support task: ${taskCategory}`);
  }
  
  switch (mode) {
    case "auto":
      // Use task router classification
      return selectByTaskRouting(capable, taskCategory);
      
    case "low":
      // Cheapest model (free first, then lowest cost)
      return selectCheapest(capable, taskCategory);
      
    case "medium":
      // Middle ground: context >= 32K, reasonable speed
      return selectBalanced(capable);
      
    case "high":
      // Strong model: context >= 64K, quality >= high
      return selectHighCapability(capable);
      
    case "very_high":
      // Frontier: context >= 128K, quality == frontier
      return selectFrontier(capable);
      
    case "max":
      // Largest context window
      return selectMaxContext(capable);
      
    case "ultra":
      // Best overall (most expensive, most capable)
      return selectUltra(capable);
  }
}
```

### Task-Model Matching

```typescript
function matchesTask(model: CanonicalModel, task: TaskCategory): boolean {
  switch (task) {
    case "coding":
      return model.capabilities.code;
    case "reasoning":
      return model.capabilities.reasoning;
    case "general":
      return model.capabilities.chat;
    case "local":
      return true;  // Any Ollama model works locally
  }
}
```

### Selection Examples

| Mode | Task | OpenRouter | Gemini | Ollama |
|---|---|---|---|---|
| `auto` | coding | qwen3-coder:free | gemini-2.5-flash | qwen2.5-coder:7b |
| `low` | general | meta-llama/llama-3.2-3b:free | gemini-2.0-flash-lite | llama3.2:3b |
| `medium` | reasoning | mistralai/mistral-small | gemini-2.5-flash | mistral:7b |
| `high` | coding | anthropic/claude-sonnet-4 | gemini-2.5-pro | qwen2.5-coder:14b |
| `very_high` | any | openai/o3 | gemini-2.5-pro-exp | — |
| `max` | analysis | anthropic/claude-4 (200K ctx) | gemini-2.5-flash (1M ctx) | — |
| `ultra` | any | openai/o3 (highest reasoning) | gemini-2.5-pro (100K ctx) | — |

## Provider-Specific Fetching

### OpenRouter

```typescript
class OpenRouterModelFetcher {
  async fetch(apiKey: string): Promise<RawModel[]> {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.json().data;
  }
  
  // OpenRouter returns rich metadata including:
  // - id, name, description
  // - context_length, max_completion_tokens
  // - pricing (prompt, completion)
  // - architecture (modality, tokenizer)
  // - top_provider (max_batch_size, is_moderated)
}
```

### Gemini

```typescript
class GeminiModelFetcher {
  async fetch(apiKey: string): Promise<RawModel[]> {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await res.json();
    return data.models.filter((m: any) =>
      m.name.startsWith("models/gemini") && m.supportedGenerationMethods?.includes("generateContent")
    );
  }
}
```

### Groq

```typescript
class GroqModelFetcher {
  async fetch(apiKey: string): Promise<RawModel[]> {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.json().data;
  }
  
  // Models include: llama3-70b, llama3-8b, mixtral-8x7b, gemma2-9b, etc.
  // Groq models are identified by their "active" and "owned_by" fields
}
```

### OpenAI

```typescript
class OpenAIModelFetcher {
  async fetch(apiKey: string): Promise<RawModel[]> {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.json().data;
  }
  
  // Note: OpenAI's /v1/models returns ALL models including non-LLM
  // (embeddings, whisper, tts, etc.). Filter required:
  // - Exclude: embedding, whisper, tts, moderation, dall-e
  // - Include: gpt-4*, gpt-3.5*, o1*, o3*
  // - Check: "gpt-4" in id or "o1" in id or "o3" in id or "gpt-3.5" in id
}
```

### Anthropic

```typescript
class AnthropicModelFetcher {
  async fetch(apiKey: string): Promise<RawModel[]> {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    return res.json().data;
  }
  
  // Returns: claude-4, claude-3.5-sonnet, claude-3.5-haiku, claude-opus, etc.
  // Each model has: type, id, display_name, created_at
}
```

### Ollama

```typescript
class OllamaModelFetcher {
  async fetch(baseURL: string): Promise<RawModel[]> {
    const res = await fetch(`${baseURL.replace(/\/$/, "")}/api/tags`);
    const data = await res.json();
    return data.models.map((m: any) => ({
      id: m.name,
      name: m.name,
      size: m.size,
      modified: m.modified_at,
      details: m.details,  // family, parameter_size, quantization
    }));
  }
  
  // Ollama returns locally pulled models only
  // Details include: parent_model, format, family, parameter_size, quantization_level
}
```

## CLI Integration

```bash
# Fetch and display models for connected provider
loom models openrouter
loom models openrouter --refresh    # Bypass cache
loom models openrouter --mode high  # Show only high-tier models

# Select a model
loom models select openrouter qwen/qwen3-coder:free

# Show current model and available modes
loom models current
loom models modes                   # Explain each selection mode

# Model info
loom models info openrouter qwen/qwen3-coder:free
```

## TUI Integration

The model selector appears in the connection workflow and as a separate screen:

```
┌─────────────────────────────────────────────────────┐
│ ⌬ Loom · Model Selection                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Provider: OpenRouter                                │
│  Mode:     ● Auto  ○ Low  ○ Medium  ○ High          │
│            ○ Very High  ○ Max  ○ Ultra               │
│                                                     │
│  Available models (27):                              │
│  ┌──────────────────────────────────────────────┐   │
│  │ ○ qwen/qwen3-coder:free           32K  FREE   │   │
│  │ ● google/gemini-2.5-flash          1M  FREE   │   │
│  │ ○ meta-llama/llama-3.3-70b       128K  $0.27  │   │
│  │ ○ anthropic/claude-4             200K  $3.00  │   │
│  │ ○ mistral/mistral-large          128K  $2.00  │   │
│  │ ○ openai/gpt-4o                  128K  $2.50  │   │
│  │ ↓ (21 more)                                   │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [Enter] Select  [m] Change Mode  [r] Refresh       │
│  [Tab] Sort: Context ▼  Cost  Name  Speed           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Configuration Output

After model selection, the config is updated:

```json
{
  "defaultProvider": "openrouter",
  "selectionMode": "auto",
  "models": {
    "coding": "qwen/qwen3-coder:free",
    "reasoning": "google/gemini-2.5-flash",
    "general": "meta-llama/llama-3.3-70b-instruct:free",
    "local": "qwen2.5-coder:7b",
    "fallback": "google/gemma-4-31b-it:free"
  },
  "providers": {
    "openrouter": {
      "type": "openai",
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKey": "${OPENROUTER_API_KEY}",
      "model": "qwen/qwen3-coder:free"
    }
  }
}
```

## File Structure

```
src/
  providers/
    models/
      fetcher.ts           # ModelFetcher orchestration
      cache.ts             # ModelCache implementation
      normalizer.ts        # Normalization pipeline
      inferrer.ts          # CapabilityInferrer
      classifier.ts        # Tier classification
      selector.ts          # ModelSelector (modes)
      types.ts             # CanonicalModel, etc.
```

## Integration Points

| Component | Integration |
|---|---|
| Config schema | `selectionMode` field added to `RoutingConfig` |
| Config defaults | Default mode is `"auto"` |
| Agent router | Router accepts `selectionMode` to refine model choice |
| TUI | Model screen in connection wizard; `/model` slash command extended |
| CLI | `loom models` command group |
| Session store | Session records which model was used and in what mode |

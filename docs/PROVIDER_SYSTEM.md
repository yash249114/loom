# Provider System Architecture

## Overview

The Provider System is a unified framework for connecting, authenticating, validating, and managing AI model providers. It replaces the current hardcoded provider configuration with a dynamic, user-driven connection workflow.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Provider System                    │
├─────────────────────────────────────────────────────┤
│  ProviderManager  ←  ProviderConnector              │
│       │                                                        
│       ├── ProviderValidator                                    
│       ├── ProviderRegistry                                     
│       ├── KeyManager                                           
│       └── ConfigPersister                                      
│                                                    
│  ┌────────────────────────────────────┐                        
│  │         ProviderCatalog            │                        
│  │  ┌──────────┐  ┌──────────┐       │                        
│  │  │ OpenRouter│  │  Gemini   │       │                        
│  │  ├──────────┤  ├──────────┤       │                        
│  │  │ Groq     │  │  OpenAI   │       │                        
│  │  ├──────────┤  ├──────────┤       │                        
│  │  │ Anthropic│  │  Ollama   │       │                        
│  │  └──────────┘  └──────────┘       │                        
│  └────────────────────────────────────┘                        
└─────────────────────────────────────────────────────┘
```

## Provider Connector

Each provider has a connector that implements a standard interface:

```typescript
interface ProviderConnector {
  id: string;                    // "openrouter", "gemini", etc.
  name: string;                  // Display name
  docsUrl: string;               // API key documentation URL
  requiresBaseURL: boolean;      // Some (Ollama) need a custom URL
  defaultBaseURL: string;        // Default endpoint

  // Lifecycle
  validateKey(apiKey: string, baseURL?: string): Promise<KeyValidation>;
  fetchModels(apiKey: string, baseURL?: string): Promise<ModelDescriptor[]>;
  testConnection(config: ProviderConnectionConfig): Promise<ConnectionResult>;
}

interface KeyValidation {
  valid: boolean;
  keyPreview: string;            // "sk-or-...xyz"
  tier?: string;                 // "free", "pay-as-you-go", "enterprise"
  error?: string;
}

interface ConnectionResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface ModelDescriptor {
  id: string;                    // Model identifier for API calls
  name: string;                  // Human-readable name
  provider: string;              // Provider id
  capabilities: ModelCapability[];
  contextWindow: number;
  maxOutputTokens: number;
  pricing?: ModelPricing;
  speedTier?: "fast" | "medium" | "slow";
}

interface ModelCapability {
  type: "chat" | "code" | "reasoning" | "vision" | "function_calling" | "streaming";
  supported: boolean;
}

interface ModelPricing {
  inputPer1K: number;            // USD per 1K input tokens
  outputPer1K: number;           // USD per 1K output tokens
  currency: string;
}
```

## Connection Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Select  │───→│  Enter   │───→│ Validate │───→│  Fetch   │───→│  Display │───→│  Select  │───→│   Save   │
│ Provider │    │ API Key  │    │   Key    │    │  Models  │    │  Models  │    │  Model   │    │  Config  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Step 1: Provider Selection

```typescript
// In CLI / TUI
const provider = await selectFromList([
  { id: "openrouter", name: "OpenRouter", description: "Multi-model gateway with free tier" },
  { id: "gemini",     name: "Gemini",     description: "Google's Gemini models" },
  { id: "groq",       name: "Groq",       description: "Fast inference via LPU hardware" },
  { id: "openai",     name: "OpenAI",     description: "GPT-4, GPT-4o, o1, o3 models" },
  { id: "anthropic",  name: "Anthropic",  description: "Claude 3.5 Sonnet, Claude 4" },
  { id: "ollama",     name: "Ollama",     description: "Local models (offline)" },
]);
```

### Step 2: API Key Entry

```typescript
interface KeyEntryConfig {
  providerId: string;
  
  // Display
  promptText: string;             // "Enter your OpenRouter API key"
  placeholder: string;            // "sk-or-v1-..."
  helpUrl: string;                // Link to API key creation page
  
  // Validation rules
  pattern?: RegExp;               // Optional format check before network call
  maskInput: boolean;             // Mask on screen
  allowSkip: boolean;             // Some providers (Ollama) don't need keys
  
  // For providers with custom URLs (Ollama)
  showBaseURL: boolean;
  baseURLPlaceholder: string;     // "http://localhost:11434"
}
```

### Step 3: Key Validation

Each provider connector implements its own validation:

| Provider | Validation Method |
|---|---|
| OpenRouter | `GET https://openrouter.ai/api/v1/auth/key` — validates key and returns tier info |
| Gemini | `GET https://generativelanguage.googleapis.com/v1/models?key=...` — validates by listing models |
| Groq | `GET https://api.groq.com/openai/v1/models` with `Authorization: Bearer <key>` |
| OpenAI | `GET https://api.openai.com/v1/models` with `Authorization: Bearer <key>` |
| Anthropic | `GET https://api.anthropic.com/v1/messages` with `x-api-key: <key>` (minimal request) |
| Ollama | `GET http://localhost:11434/api/tags` — no key needed, validates server is running |

```typescript
async function validateKey(providerId: string, apiKey: string, baseURL?: string): Promise<KeyValidation> {
  const connector = getConnector(providerId);
  return connector.validateKey(apiKey, baseURL);
}

// Result
{
  valid: true,
  keyPreview: "sk-or-...2x7f",
  tier: "free",
  error: undefined
}
```

### Step 4: Fetch Models

Models are fetched dynamically from the provider's API. They are **never hardcoded**.

```typescript
// Returns every model available to this API key
const models = await connector.fetchModels(apiKey, baseURL);

// Each model includes:
[
  {
    id: "qwen/qwen3-coder:free",
    name: "Qwen3 Coder (Free)",
    provider: "openrouter",
    capabilities: [
      { type: "chat", supported: true },
      { type: "code", supported: true },
      { type: "reasoning", supported: true },
      { type: "function_calling", supported: true },
      { type: "streaming", supported: true },
    ],
    contextWindow: 32768,
    maxOutputTokens: 8192,
    pricing: { inputPer1K: 0, outputPer1K: 0, currency: "USD" },
    speedTier: "fast",
  },
  // ... more models
]
```

**Caching**: Models are cached in `.loom/models-cache/<provider>.json` with an expiry (default 1 hour) to avoid repeated API calls during the same session.

### Step 5: Display Models

Models are displayed in a sorted, categorized list:

```
Available models for OpenRouter ─────────────────────────────────
                                 Context   Input     Output   Speed
  qwen/qwen3-coder:free          32,768    free      free     ●●●●○
  google/gemini-2.5-flash        1,048,576  free      free     ●●●●●
  meta-llama/llama-3.3-70b       131,072   $0.27/m   $0.27/m  ●●●○○
  anthropic/claude-4             200,000   $3.00/m   $15.00/m ●●●○○
  ... (sorted by context window descending)
```

### Step 6: Model Selection

```typescript
interface ModelSelection {
  modelId: string;
  mode: SelectionMode;
  providerId: string;
}

type SelectionMode =
  | "auto"         // Let Loom pick based on task routing
  | "low"          // Cheapest/fastest capable model
  | "medium"       // Balanced cost/capability
  | "high"         // Strong model for complex tasks
  | "very_high"    // Frontier model
  | "max"          // Best available (largest context/most capable)
  | "ultra";       // Maximum capability regardless of cost
```

### Step 7: Save Configuration

```typescript
// Generated config shape
{
  "providers": {
    "openrouter": {
      "type": "openai",
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKey": "sk-or-v1-...",      // Stored in config or env
      "model": "selected-model-id"
    }
  },
  "routing": {
    "defaultMode": "auto",
    "selectionMode": "medium"
  }
}
```

## Key Manager

The Key Manager handles credential storage securely:

```typescript
interface KeyManager {
  // Storage modes
  store(mode: KeyStorageMode, providerId: string, key: string): Promise<void>;
  retrieve(providerId: string): Promise<string | null>;
  remove(providerId: string): Promise<void>;
  list(): Promise<string[]>;         // List provider IDs with stored keys
}

type KeyStorageMode =
  | "env"           // Write to .env in workspace root
  | "config"        // Store in .loom/config.json (interpolated)
  | "keychain"      // OS keychain (macOS Keychain, Windows Credential Manager, libsecret)
  | "prompt";       // Don't store; prompt each session
```

**Security rules:**
- `env` mode writes to `.env` (gitignored if in `.gitignore`)
- `config` mode stores keys in config file with a warning
- `keychain` mode is preferred for production use
- Keys are never logged, displayed in full, or included in error messages

## Config Persister

```typescript
interface ConfigPersister {
  saveProvider(providerId: string, config: ProviderConnectionConfig): Promise<void>;
  removeProvider(providerId: string): Promise<void>;
  getProvider(providerId: string): Promise<ProviderConnectionConfig | null>;
  listProviders(): Promise<string[]>;
}

interface ProviderConnectionConfig {
  providerId: string;
  baseURL: string;
  modelId: string;
  selectionMode: SelectionMode;
  keyStorageMode: KeyStorageMode;
  active: boolean;
  connectedAt: number;               // Unix timestamp
  lastValidatedAt: number;
}
```

## CLI Commands

```bash
loom provider list                          # List connected providers
loom provider connect <provider>            # Start connection wizard
loom provider disconnect <provider>         # Remove provider config
loom provider models <provider>             # List cached/available models
loom provider refresh <provider>            # Re-fetch models from API
loom provider test <provider>               # Test connection
```

New interactive commands:

```bash
loom setup             # Guided setup wizard (checks env, walks through providers)
```

## Provider Catalog

| Provider | Type | Requires Key | Requires BaseURL | Auth Header | Models Source |
|---|---|---|---|---|---|
| OpenRouter | openai | Yes | No | `Authorization: Bearer` | `GET /api/v1/models` |
| Gemini | openai | Yes | No | `key` query param | `GET /v1/models` |
| Groq | openai | Yes | No | `Authorization: Bearer` | `GET /v1/models` |
| OpenAI | openai | Yes | No | `Authorization: Bearer` | `GET /v1/models` |
| Anthropic | anthropic | Yes | No | `x-api-key` | `GET /v1/models` |
| Ollama | ollama | No | Yes (usually) | None | `GET /api/tags` |

## Provider Registry

```typescript
class ProviderRegistry {
  private connectors = new Map<string, ProviderConnector>();

  register(connector: ProviderConnector): void;
  get(id: string): ProviderConnector;
  list(): ProviderConnector[];
  has(id: string): boolean;
}

// Global singleton
export const providerRegistry = new ProviderRegistry();
```

## Integration with Agent

The provider system feeds into the agent's routing:

```typescript
// Routing now considers selection mode
interface AgentRoutingInput {
  prompt: string;
  selectionMode: SelectionMode;    // From user config
  availableModels: ModelDescriptor[];
  taskCategory: TaskCategory;
}

// The router uses selectionMode to threshold model selection:
// "auto"    → Use configured model for task category
// "low"     → Filter to cheapest models with required capabilities
// "medium"  → Balanced cost + capability
// "high"    → Strong reasoning models
// "very_high" → Frontier models (GPT-4o, Claude 4, Gemini 2.5 Pro)
// "max"     → Largest context window available
// "ultra"   → Most expensive/most capable
```

## File Structure

```
src/
  providers/
    index.ts                  # Re-exports
    registry.ts               # ProviderRegistry class
    manager.ts                # ProviderManager orchestration
    key-manager.ts            # KeyManager (secure storage)
    config-persister.ts       # ConfigPersister
    connectors/
      base.ts                 # BaseProviderConnector abstract class
      openrouter.ts           # OpenRouter connector
      gemini.ts               # Gemini connector
      groq.ts                 # Groq connector
      openai.ts               # OpenAI connector
      anthropic.ts            # Anthropic connector
      ollama.ts               # Ollama connector
    validation/
      validator.ts            # Key and connection validation
    models/
      fetcher.ts              # Model fetching with caching
      cache.ts                # Model cache (file-based, TTL)
      selector.ts             # Model selection by mode
    types.ts                  # Public types
```

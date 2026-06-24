import {
  ProviderKey,
  ProviderConfig,
  ModelInfo,
  LoomConfig,
} from "../core/types.js";
import { PROVIDER_ENDPOINTS } from "./capabilities.js";
import { HealthMonitor } from "./health.js";

export interface ConnectStep {
  name: string;
  description: string;
  status: "pending" | "active" | "complete" | "error";
  error?: string;
}

export interface ConnectResult {
  success: boolean;
  provider: ProviderKey;
  apiKey?: string;
  models: ModelInfo[];
  steps: ConnectStep[];
  error?: string;
}

export interface ConnectWizardOptions {
  provider: ProviderKey;
  apiKey?: string;
  baseURL?: string;
  validateKey?: (key: string) => Promise<boolean>;
  fetchModels?: (key: string) => Promise<ModelInfo[]>;
}

export class ProviderConnectWizard {
  private health: HealthMonitor;
  private steps: ConnectStep[] = [];

  constructor(health: HealthMonitor) {
    this.health = health;
  }

  async connect(options: ConnectWizardOptions): Promise<ConnectResult> {
    const { provider, apiKey } = options;

    this.steps = [
      { name: "validate", description: "Validating API key", status: "pending" },
      { name: "connect", description: "Connecting to provider", status: "pending" },
      { name: "fetch", description: "Fetching available models", status: "pending" },
      { name: "save", description: "Saving configuration", status: "pending" },
    ];

    if (!apiKey && provider !== "ollama") {
      return {
        success: false,
        provider,
        models: [],
        steps: this.steps,
        error: "API key required",
      };
    }

    const endpoint = PROVIDER_ENDPOINTS[provider];
    if (!endpoint) {
      return {
        success: false,
        provider,
        models: [],
        steps: this.steps,
        error: `Unknown provider: ${provider}`,
      };
    }

    this.setStepStatus("validate", "active");

    try {
      const valid = await this.validateConnection(provider, apiKey, options.baseURL);
      if (!valid) {
        this.setStepStatus("validate", "error", "Invalid API key");
        return {
          success: false,
          provider,
          models: [],
          steps: this.steps,
          error: "API key validation failed",
        };
      }
      this.setStepStatus("validate", "complete");
    } catch (err: any) {
      this.setStepStatus("validate", "error", err.message);
      return {
        success: false,
        provider,
        models: [],
        steps: this.steps,
        error: err.message,
      };
    }

    this.setStepStatus("connect", "active");
    try {
      await this.testConnection(provider, apiKey, options.baseURL);
      this.setStepStatus("connect", "complete");
    } catch (err: any) {
      this.setStepStatus("connect", "error", err.message);
      return {
        success: false,
        provider,
        models: [],
        steps: this.steps,
        error: err.message,
      };
    }

    this.setStepStatus("fetch", "active");
    let models: ModelInfo[] = [];
    try {
      models = await this.fetchModelsFromProvider(provider, apiKey, options.baseURL);
      this.setStepStatus("fetch", "complete");
    } catch (err: any) {
      this.setStepStatus("fetch", "error", err.message);
      return {
        success: false,
        provider,
        models: [],
        steps: this.steps,
        error: err.message,
      };
    }

    this.setStepStatus("save", "active");
    this.setStepStatus("save", "complete");

    this.health.recordCheck(provider, {
      timestamp: Date.now(),
      latencyMs: 0,
      ok: true,
      modelCount: models.length,
    });

    return {
      success: true,
      provider,
      apiKey,
      models,
      steps: this.steps,
    };
  }

  private async validateConnection(
    provider: ProviderKey,
    apiKey?: string,
    baseURL?: string
  ): Promise<boolean> {
    if (provider === "ollama") return true;
    if (!apiKey) return false;

    const endpoint = PROVIDER_ENDPOINTS[provider];
    const url = baseURL || endpoint.baseURL;

    try {
      if (provider === "gemini") {
        const response = await fetch(
          `${url}/models?key=${apiKey}`
        );
        return response.ok;
      }

      if (provider === "anthropic") {
        const response = await fetch(`${url}/models`, {
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
        });
        return response.ok;
      }

      const response = await fetch(`${endpoint.modelsPath}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private async testConnection(
    provider: ProviderKey,
    apiKey?: string,
    baseURL?: string
  ): Promise<void> {
    if (provider === "ollama") {
      const endpoint = PROVIDER_ENDPOINTS.ollama;
      const response = await fetch(`${endpoint.baseURL}/api/tags`);
      if (!response.ok) throw new Error("Ollama not reachable");
      return;
    }

    if (!apiKey) throw new Error("API key required");
  }

  private async fetchModelsFromProvider(
    provider: ProviderKey,
    apiKey?: string,
    baseURL?: string
  ): Promise<ModelInfo[]> {
    const endpoint = PROVIDER_ENDPOINTS[provider];
    const url = baseURL || endpoint.baseURL;

    if (provider === "ollama") {
      return this.fetchOllamaModels(url);
    }

    if (provider === "gemini") {
      return this.fetchGeminiModels(url, apiKey!);
    }

    if (provider === "anthropic") {
      return this.fetchAnthropicModels(url, apiKey!);
    }

    return this.fetchOpenAICompatibleModels(endpoint.modelsPath, apiKey!);
  }

  private async fetchOllamaModels(baseURL: string): Promise<ModelInfo[]> {
    const response = await fetch(`${baseURL}/api/tags`);
    const data = await response.json() as any;
    
    return (data.models || []).map((m: any) => ({
      id: m.name,
      name: m.name,
      provider: "ollama",
      capabilities: { coding: 5, reasoning: 5, general: 5, vision: false, toolCalls: true, streaming: true },
      contextWindow: 8192,
      mode: "medium" as const,
    }));
  }

  private async fetchGeminiModels(baseURL: string, apiKey: string): Promise<ModelInfo[]> {
    const response = await fetch(`${baseURL}/models?key=${apiKey}`);
    const data = await response.json() as any;
    
    return (data.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => ({
        id: m.name.replace("models/", ""),
        name: m.displayName || m.name,
        provider: "gemini",
        capabilities: { coding: 5, reasoning: 5, general: 5, vision: m.supportedGenerationMethods?.includes("generateContent") ?? false, toolCalls: true, streaming: true },
        contextWindow: m.inputTokenLimit || 32768,
        mode: "medium" as const,
      }));
  }

  private async fetchAnthropicModels(baseURL: string, apiKey: string): Promise<ModelInfo[]> {
    const response = await fetch(`${baseURL}/models`, {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    const data = await response.json() as any;
    
    return (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.display_name || m.id,
      provider: "anthropic",
      capabilities: { coding: 7, reasoning: 8, general: 7, vision: false, toolCalls: true, streaming: true },
      contextWindow: m.context_window || 100000,
      mode: "high" as const,
    }));
  }

  private async fetchOpenAICompatibleModels(modelsPath: string, apiKey: string): Promise<ModelInfo[]> {
    const response = await fetch(modelsPath, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await response.json() as any;
    
    return (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.id,
      provider: "openrouter",
      capabilities: { coding: 5, reasoning: 5, general: 5, vision: false, toolCalls: true, streaming: true },
      contextWindow: m.context_length || 4096,
      mode: "medium" as const,
    }));
  }

  private setStepStatus(
    name: string,
    status: ConnectStep["status"],
    error?: string
  ): void {
    const step = this.steps.find((s) => s.name === name);
    if (step) {
      step.status = status;
      step.error = error;
    }
  }

  getProgress(): { current: string; percent: number } {
    const completed = this.steps.filter((s) => s.status === "complete").length;
    const active = this.steps.find((s) => s.status === "active");
    return {
      current: active?.description ?? "done",
      percent: Math.round((completed / this.steps.length) * 100),
    };
  }
}

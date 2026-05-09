import { z } from "zod";

export const ProviderConfigSchema = z.object({
  type: z.enum(["ollama", "openai"]),
  baseURL: z.string().url(),
  apiKey: z.string().optional(),
  model: z.string(),
  headers: z.record(z.string()).optional(),
});

export const ProviderEndpointSchema = z.object({
  baseURL: z.string().url(),
  apiKey: z.string().optional(),
});

export const AgentConfigSchema = z.object({
  maxIterations: z.number().int().min(1).max(200).default(25),
  maxToolCallsPerTurn: z.number().int().min(1).max(50).default(10),
  temperature: z.number().min(0).max(2).default(0.2),
  contextWindow: z.number().int().min(1024).default(16000),
  streamReasoning: z.boolean().default(true),
});

export const SafetyConfigSchema = z.object({
  requireConfirmForShell: z.boolean().default(true),
  requireConfirmForWrite: z.boolean().default(false),
  blockedCommands: z.array(z.string()).default([]),
  sandbox: z.boolean().default(false),
});

export const VerificationCommandSchema = z.object({
  name: z.string(),
  command: z.string(),
  timeoutMs: z.number().int().positive().default(60000),
});

export const VerificationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  maxRetries: z.number().int().min(0).max(10).default(3),
  commands: z.array(VerificationCommandSchema).default([]),
  triggerTools: z.array(z.string()).default(["writefile", "editfile", "patchfile"]),
});

export const ModelConfigSchema = z.object({
  coding: z.string().default("qwen/qwen3-coder:free"),
  reasoning: z.string().default("qwen/qwen3-next-80b-a3b-instruct:free"),
  general: z.string().default("meta-llama/llama-3.3-70b-instruct:free"),
  local: z.string().default("qwen2.5-coder:7b"),
  fallback: z.string().optional(),
});

export const RoutingConfigSchema = z.object({
  defaultMode: z.enum(["auto", "local", "remote"]).default("auto"),
  fallbackToLocal: z.boolean().default(true),
});

export const LoomConfigSchema = z.object({
  defaultProvider: z.string(),
  providers: z.record(ProviderConfigSchema),
  providerEndpoints: z
    .record(ProviderEndpointSchema)
    .default({
      openrouter: { baseURL: "https://openrouter.ai/api/v1" },
      ollama: { baseURL: "http://127.0.0.1:11434" },
    }),
  aliases: z.record(z.string()).default({}),
  agent: AgentConfigSchema.default({} as any),
  safety: SafetyConfigSchema.default({} as any),
  systemPrompt: z.string().nullable().default(null),
  tools: z
    .object({ enabled: z.array(z.string()).default([]) })
    .default({ enabled: [] }),
  verification: VerificationConfigSchema.default({} as any),
  models: ModelConfigSchema.default({} as any),
  routing: RoutingConfigSchema.default({} as any),
});

export type LoomConfigInput = z.input<typeof LoomConfigSchema>;

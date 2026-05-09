import { z } from "zod";
import type { VerificationConfig } from "../agent/verifier.js";

export type Role = "system" | "user" | "assistant" | "tool";

export interface Message {
  role: Role;
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  name?: string;
  timestamp?: number;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  ok: boolean;
  output: string;
  error?: string;
}

export interface ToolDefinition<TArgs = any> {
  name: string;
  description: string;
  parameters: z.ZodType<TArgs>;
  jsonSchema?: Record<string, unknown>;
  handler: (args: TArgs, ctx: ToolContext) => Promise<string> | string;
  dangerous?: boolean;
}

export interface ToolContext {
  workspaceRoot: string;
  cwd: string;
  log: (msg: string) => void;
  confirm: (msg: string) => Promise<boolean>;
  signal?: AbortSignal;
}

export interface ToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  argumentsDelta?: string;
}

export interface ProviderStreamChunk {
  delta: string;
  done: boolean;
  toolCallDeltas?: ToolCallDelta[];
  raw?: unknown;
}

export interface ProviderRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  temperature?: number;
  model?: string;
  signal?: AbortSignal;
  systemPrompt?: string;
}

export interface Provider {
  name: string;
  model: string;
  supportsNativeTools: boolean;
  stream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk>;
}

export interface ProviderConfig {
  type: "ollama" | "openai";
  baseURL: string;
  apiKey?: string;
  model: string;
  headers?: Record<string, string>;
}

export interface AgentConfig {
  maxIterations: number;
  maxToolCallsPerTurn: number;
  temperature: number;
  contextWindow: number;
  streamReasoning: boolean;
}

export interface SafetyConfig {
  requireConfirmForShell: boolean;
  requireConfirmForWrite: boolean;
  blockedCommands: string[];
  sandbox: boolean;
}

export type TaskCategory = "coding" | "reasoning" | "general" | "local";

export interface RoutingDecision {
  category: TaskCategory;
  model: string;
  provider: "openrouter" | "ollama";
  reason: string;
}

export interface ProviderEndpoint {
  baseURL: string;
  apiKey?: string;
}

export interface ModelConfig {
  coding: string;
  reasoning: string;
  general: string;
  local: string;
  fallback?: string;
}

export interface RoutingConfig {
  defaultMode: "auto" | "local" | "remote";
  fallbackToLocal: boolean;
}

export interface LoomConfig {
  defaultProvider: string;
  providers: Record<string, ProviderConfig>;
  providerEndpoints: Record<string, ProviderEndpoint>;
  aliases: Record<string, string>;
  agent: AgentConfig;
  safety: SafetyConfig;
  systemPrompt: string | null;
  tools: { enabled: string[] };
  verification: VerificationConfig;
  models: ModelConfig;
  routing: RoutingConfig;
}

export interface SessionMessage extends Message {
  id: string;
}

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  workspace: string;
  provider: string;
  model: string;
  messages: SessionMessage[];
  summary?: string;
}

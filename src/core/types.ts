export type ViewType =
  | 'chat' | 'agents' | 'sessions' | 'repository'
  | 'memory' | 'skills' | 'mcps' | 'connect'
  | 'status' | 'settings'

export type AgentMode =
  | 'plan' | 'build' | 'review'
  | 'debug' | 'research' | 'test'

export type ModalType =
  | 'confirm' | 'sensitive-file' | 'provider-setup'
  | 'model-select' | 'settings' | null

// ── Provider Intelligence types ──────────────────────────────────────

export type ModelMode =
  | "auto" | "low" | "medium" | "high"
  | "very-high" | "very_high" | "max" | "ultra"

export interface ModelCapabilities {
  coding: number
  reasoning: number
  general: number
  vision?: boolean
  toolCalls?: boolean
  streaming?: boolean
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  capabilities: ModelCapabilities
  contextWindow: number
  maxOutputTokens?: number
  mode: ModelMode
  description?: string
  pricing?: { perToken: number; perRequest?: number }
  family?: string
  fetchedAt?: number
}

export type ProviderKey =
  | "openrouter"
  | "gemini"
  | "groq"
  | "openai"
  | "anthropic"
  | "ollama"

export interface ProviderStatus {
  key: ProviderKey
  name: string
  ok: boolean
  models?: ModelInfo[]
  latencyMs?: number
  endpoint?: string
  error?: string
}

export interface ProviderCacheEntry {
  provider: ProviderKey
  models: ModelInfo[]
  fetchedAt: number
  ttlMs: number
}

// ── Provider types ───────────────────────────────────────────────────

export interface ProviderConfig {
  type: "ollama" | "openai" | "anthropic" | "google"
  baseURL: string
  apiKey?: string
  model: string
  temperature?: number
  maxTokens?: number
  headers?: Record<string, string>
}

export interface ProviderRequest {
  messages: Message[]
  model?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  tools?: ToolDefinition[]
  signal?: AbortSignal
}

export interface ProviderStreamChunk {
  delta: string
  done: boolean
  toolCallDeltas?: ToolCallDelta[]
}

export interface ToolCallDelta {
  index: number
  id?: string
  name?: string
  argumentsDelta?: string
}

// ── Tool types ───────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string
  description: string
  parameters: any
  handler: (args: any, ctx: ToolContext) => Promise<string>
  dangerous?: boolean
  jsonSchema?: any
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  name: string
  ok: boolean
  output: string
  error?: string
}

export interface ToolContext {
  workspaceRoot: string
  cwd: string
  log: (msg: string) => void
  confirm: (msg: string) => Promise<boolean>
  signal?: AbortSignal
  [key: string]: any
}

// ── Config types ─────────────────────────────────────────────────────

export interface SafetyConfig {
  requireConfirmForShell: boolean
  requireConfirmForWrite: boolean
  blockedCommands: string[]
  sandbox: boolean
}

export interface LoomConfig {
  defaultProvider: string
  providers: Record<string, ProviderConfig>
  providerEndpoints: Record<string, { baseURL: string; apiKey?: string }>
  aliases: Record<string, string>
  agent: {
    maxIterations: number
    maxToolCallsPerTurn: number
    temperature: number
    contextWindow: number
    streamReasoning: boolean
  }
  safety: SafetyConfig
  systemPrompt: string | null
  tools: { enabled: string[] }
  verification: {
    enabled: boolean
    maxRetries: number
    commands: Array<{ name: string; command: string; timeoutMs: number }>
    triggerTools: string[]
  }
  models: {
    coding: string
    reasoning: string
    general: string
    local: string
    fallback?: string
  }
  routing: {
    defaultMode: "auto" | "local" | "remote"
    fallbackToLocal: boolean
    discovery: boolean
    cacheTtlMs: number
  }
  mcpServers?: Record<string, { command: string; args?: string[]; env?: Record<string, string> }>
}

export type TaskCategory = "coding" | "reasoning" | "general" | "local"

export interface RoutingDecision {
  category: TaskCategory | "local"
  provider: string
  model: string
  reason: string
}

// ── Session types ────────────────────────────────────────────────────

export interface Session {
  id: string
  workspace: string
  provider: string
  model: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  summary?: string
}

// ── Message ──────────────────────────────────────────────────────────

export interface Message {
  id?: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  timestamp: number
  model?: string
  toolCalls?: ToolCall[]
  toolCallId?: string
  name?: string
}

// ── Provider interface ───────────────────────────────────────────────

export interface Provider {
  name: string
  id?: string
  model?: string
  supportsNativeTools?: boolean
  stream(request: ProviderRequest): AsyncIterable<ProviderStreamChunk>
  validateKey?(key: string): Promise<boolean>
  fetchModels?(): Promise<ModelInfo[]>
}

// ── UI types ─────────────────────────────────────────────────────────

export interface Model {
  id: string
  name: string
  provider: string
  contextLength: number
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  duration: number
}

export interface AgentStep {
  text: string
  status: 'done' | 'active' | 'pending'
}

export interface SlashCommand {
  id: string
  category: string
  label: string
  description: string
  icon: string
}

// ── File Explorer ────────────────────────────────────────────────────

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  size?: number
}

// ── Diff Viewer ──────────────────────────────────────────────────────

export interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header'
  content: string
  oldLine?: number
  newLine?: number
}

// ── Session Timeline ─────────────────────────────────────────────────

export interface SessionInfo {
  id: string
  summary: string
  messageCount: number
  createdAt: number
  agent: string
}

// ── App State ────────────────────────────────────────────────────────

export interface AppState {
  currentView: ViewType
  sidebarCollapsed: boolean
  contextPanelOpen: boolean
  currentAgent: AgentMode
  provider: Provider | null
  models: Model[]
  selectedModel: Model | null
  chatHistory: Message[]
  tokenUsage: number
  tokenLimit: number
  commandPaletteOpen: boolean
  activeModal: ModalType
  toasts: Toast[]
  isLoading: boolean
  gitBranch: string
  cwd: string
  terminalWidth: number
  terminalHeight: number

  // Input state
  inputBuffer: string
  inputMode: boolean
  slashCommandMode: boolean
  commandPaletteIndex: number
  commandPaletteQuery: string

  // Agent reasoning
  agentSteps: AgentStep[]
  reasoningActive: boolean

  // Streaming
  streamingContent: string
  streamingActive: boolean

  // Chat scroll
  chatScrollOffset: number

  // Panels
  fileExplorerOpen: boolean
  diffOpen: boolean
  sessionTimelineOpen: boolean

  // Onboarding
  onboardingComplete: boolean

  // File explorer
  files: FileNode[]
  fileExplorerCursor: number

  // Diff viewer
  diffLines: DiffLine[]
  diffScrollOffset: number

  // Session timeline
  sessions: SessionInfo[]
}

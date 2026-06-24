# MCP (Model Context Protocol) System Architecture

## Overview

MCP (Model Context Protocol) is a standardized transport layer for AI model interaction. It decouples the agent from specific provider implementations by defining a common wire protocol, allowing Loom to add new providers without modifying the agent loop or routing core.

The MCP system consists of three layers:

```
┌─────────────────────────────────────────────────────┐
│                   Agent Loop                         │
│  (tool orchestration, verification, session mgmt)    │
├─────────────────────────────────────────────────────┤
│                   MCP Router                         │
│  (session management, capability negotiation,        │
│   streaming abstraction, provider selection)         │
├──────────┬──────────┬──────────┬────────────────────┤
│  MCP     │  MCP     │  MCP     │  MCP               │
│ Server   │  Server  │  Server  │  Server            │
│ (OpenAI) │ (Ollama) │ (Claude) │ (Remote API)       │
└──────────┴──────────┴──────────┴────────────────────┘
```

## Core Concepts

### MCP Session

A lightweight, bidirectional communication channel between Loom and a model provider.

```typescript
interface MCPSession {
  id: string;
  provider: string;
  model: string;
  config: MCPConfig;
  status: "connecting" | "connected" | "streaming" | "error" | "closed";
  
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  stream(request: MCPRequest): AsyncIterable<MCPChunk>;
  
  // Capabilities
  capabilities(): Promise<MCPCapabilities>;
}
```

### MCP Message

Standardized message envelope used in all provider communication:

```typescript
interface MCPMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  
  // Tool calling
  toolCalls?: MCPToolCall[];
  toolCallId?: string;
  name?: string;
}

interface MCPToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}
```

### MCP Request / Response

```typescript
interface MCPRequest {
  messages: MCPMessage[];
  system?: string;
  tools?: MCPToolDefinition[];
  options?: MCPRequestOptions;
  signal?: AbortSignal;
}

interface MCPRequestOptions {
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  seed?: number;
}

interface MCPChunk {
  delta: string;
  done: boolean;
  toolCallDeltas?: MCPToolCallDelta[];
  usage?: MCPUsage;
  error?: MCPError;
}

interface MCPToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  argumentsDelta?: string;
}

interface MCPUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}
```

## MCP Router

The MCP Router is the central hub that manages provider connections and routes requests:

```typescript
class MCPRouter {
  private sessions = new Map<string, MCPSession>();
  private factories = new Map<string, MCPFactory>();

  // Registration
  register(providerId: string, factory: MCPFactory): void;
  
  // Session management
  async createSession(providerId: string, config: MCPConfig): Promise<MCPSession>;
  async destroySession(sessionId: string): Promise<void>;
  getSession(sessionId: string): MCPSession | undefined;
  
  // Streaming
  stream(sessionId: string, request: MCPRequest): AsyncIterable<MCPChunk>;
  
  // Discovery
  getCapabilities(sessionId: string): Promise<MCPCapabilities>;
  listProviders(): string[];
  
  // Fallback routing
  createFallbackChain(primary: string, fallbacks: string[]): MCPFallbackChain;
}
```

### Capability Negotiation

```typescript
interface MCPCapabilities {
  providerId: string;
  
  // Streaming
  supportsStreaming: boolean;
  
  // Tool calling
  supportsNativeTools: boolean;
  toolCallStyle: "native" | "text" | "both";
  
  // Content types
  supportsVision: boolean;
  supportsStructuredOutput: boolean;
  
  // Context
  maxContextWindow: number;
  maxOutputTokens: number;
  
  // Pricing
  pricing: {
    inputPer1K: number;
    outputPer1K: number;
  };
  
  // Performance
  averageLatencyMs: number;
}
```

## MCP Adapter Architecture

Each provider implements an MCP Adapter that translates between the MCP protocol and the provider's native API:

```
                MCP Router
                    │
         ┌──────────┴──────────┐
         │                     │
    MCPRequest            MCPChunk
         │                     │
    ┌────┴─────────────────────┴────┐
    │         MCP Adapter           │
    │  ┌────────────────────────┐  │
    │  │  Request Translator    │  │
    │  │  Response Parser       │  │
    │  │  Error Handler         │  │
    │  │  Retry Logic           │  │
    │  └────────────────────────┘  │
    └──────────┬──────────────────┘
               │
    ┌──────────┴──────────┐
    │  Provider API       │
    │  (HTTP/REST/gRPC)   │
    └─────────────────────┘
```

### MCP Adapter Interface

```typescript
interface MCPAdapter {
  // Provider identification
  providerId: string;
  
  // Session lifecycle
  createSession(config: MCPConfig): Promise<MCPSession>;
  
  // Streaming (core function)
  stream(session: MCPSession, request: MCPRequest): AsyncIterable<MCPChunk>;
  
  // Capabilities
  getCapabilities(): Promise<MCPCapabilities>;
  
  // Models
  listModels(): Promise<MCPModel[]>;
  
  // Validation
  validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }>;
}

interface MCPConfig {
  apiKey?: string;
  baseURL: string;
  model: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
}
```

## MCP Factories

```typescript
// Base factory creates adapters for a specific provider protocol
interface MCPFactory {
  providerId: string;
  createAdapter(config: MCPConfig): MCPAdapter;
}

// Built-in factories
class OpenAICompatibleFactory implements MCPFactory {
  providerId = "openai-compatible";
  
  createAdapter(config: MCPConfig): MCPAdapter {
    return new OpenAICompatibleAdapter(config);
  }
}

class OllamaFactory implements MCPFactory {
  providerId = "ollama";
  
  createAdapter(config: MCPConfig): MCPAdapter {
    return new OllamaAdapter(config);
  }
}

class AnthropicFactory implements MCPFactory {
  providerId = "anthropic";
  
  createAdapter(config: MCPConfig): MCPAdapter {
    return new AnthropicAdapter(config);
  }
}
```

## Provider Registration

Providers register with the MCP system at startup or dynamically:

```typescript
// Registration table
const MCP_FACTORIES: Record<string, MCPFactoryRegistration> = {
  "openrouter": {
    factory: new OpenAICompatibleFactory(),
    defaultConfig: {
      baseURL: "https://openrouter.ai/api/v1",
      headers: { "HTTP-Referer": "https://loom.sh", "X-Title": "Loom" },
    },
  },
  "gemini": {
    factory: new OpenAICompatibleFactory(),
    defaultConfig: {
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    },
  },
  "groq": {
    factory: new OpenAICompatibleFactory(),
    defaultConfig: {
      baseURL: "https://api.groq.com/openai/v1",
    },
  },
  "openai": {
    factory: new OpenAICompatibleFactory(),
    defaultConfig: {
      baseURL: "https://api.openai.com/v1",
    },
  },
  "anthropic": {
    factory: new AnthropicFactory(),
    defaultConfig: {
      baseURL: "https://api.anthropic.com",
    },
  },
  "ollama": {
    factory: new OllamaFactory(),
    defaultConfig: {
      baseURL: "http://localhost:11434",
    },
  },
};
```

## Adapter Implementations

### OpenAI-Compatible Adapter

Handles OpenRouter, Gemini (OpenAI-compatible endpoint), Groq, and OpenAI itself:

```typescript
class OpenAICompatibleAdapter implements MCPAdapter {
  providerId: string;
  
  async *stream(session: MCPSession, request: MCPRequest): AsyncIterable<MCPChunk> {
    const body = this.buildBody(session, request);
    
    const res = await withRetry(async () => {
      const r = await fetch(`${session.config.baseURL}/chat/completions`, {
        method: "POST",
        headers: this.buildHeaders(session),
        body: JSON.stringify(body),
        signal: request.signal,
      });
      if (!r.ok) throw await this.handleError(r);
      return r;
    });
    
    // SSE parsing
    for await (const chunk of this.parseSSE(res)) {
      yield this.normalizeChunk(chunk);
    }
  }
  
  private buildBody(session: MCPSession, request: MCPRequest): Record<string, unknown> {
    return {
      model: session.config.model,
      messages: request.messages.map(m => this.formatMessage(m)),
      stream: true,
      temperature: request.options?.temperature,
      max_tokens: request.options?.maxTokens,
      tools: request.tools?.map(t => toolToOpenAIFunction(t)),
      stop: request.options?.stop,
    };
  }
  
  private async *parseSSE(res: Response): AsyncIterable<SSEChunk> {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        for (const line of evt.split("\n")) {
          if (!line.trim().startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload === "[DONE]") { yield { type: "done" }; return; }
          yield { type: "chunk", data: JSON.parse(payload) };
        }
      }
    }
  }
  
  private normalizeChunk(raw: SSEChunk): MCPChunk {
    if (raw.type === "done") return { delta: "", done: true };
    
    const choice = raw.data.choices?.[0];
    return {
      delta: choice?.delta?.content ?? "",
      done: !!choice?.finish_reason,
      toolCallDeltas: choice?.delta?.tool_calls?.map((tc: any) => ({
        index: tc.index ?? 0,
        id: tc.id,
        name: tc.function?.name,
        argumentsDelta: tc.function?.arguments,
      })),
      usage: raw.data.usage,
    };
  }
}
```

### Anthropic Adapter

```typescript
class AnthropicAdapter implements MCPAdapter {
  providerId = "anthropic";
  
  async *stream(session: MCPSession, request: MCPRequest): AsyncIterable<MCPChunk> {
    const body = {
      model: session.config.model,
      system: request.system,
      messages: request.messages.filter(m => m.role !== "system"),
      max_tokens: request.options?.maxTokens ?? 8192,
      stream: true,
      temperature: request.options?.temperature,
      tools: request.tools?.map(t => this.formatTool(t)),
    };
    
    const res = await withRetry(async () => {
      const r = await fetch(`${session.config.baseURL}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": session.config.apiKey ?? "",
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: request.signal,
      });
      if (!r.ok) throw await this.handleError(r);
      return r;
    });
    
    // Parse Anthropic SSE format
    // Event types: message_start, content_block_start, content_block_delta,
    //   content_block_stop, message_delta, message_stop, ping
    for await (const event of this.parseAnthropicSSE(res)) {
      yield this.normalizeAnthropicEvent(event);
    }
  }
  
  private normalizeAnthropicEvent(event: AnthropicEvent): MCPChunk {
    switch (event.type) {
      case "content_block_delta":
        if (event.delta?.type === "text_delta") {
          return { delta: event.delta.text, done: false };
        }
        if (event.delta?.type === "input_json_delta") {
          return {
            delta: "",
            done: false,
            toolCallDeltas: [{
              index: event.index ?? 0,
              argumentsDelta: event.delta.partial_json,
            }],
          };
        }
        return { delta: "", done: false };
        
      case "content_block_start":
        if (event.content_block?.type === "tool_use") {
          return {
            delta: "",
            done: false,
            toolCallDeltas: [{
              index: event.index ?? 0,
              id: event.content_block.id,
              name: event.content_block.name,
            }],
          };
        }
        return { delta: "", done: false };
        
      case "message_stop":
        return { delta: "", done: true };
        
      default:
        return { delta: "", done: false };
    }
  }
}
```

### Ollama Adapter

```typescript
class OllamaAdapter implements MCPAdapter {
  providerId = "ollama";
  
  async *stream(session: MCPSession, request: MCPRequest): AsyncIterable<MCPChunk> {
    const body = {
      model: session.config.model,
      messages: request.messages.map(m => this.formatMessage(m)),
      stream: true,
      options: {
        temperature: request.options?.temperature,
        num_predict: request.options?.maxTokens,
      },
      tools: request.tools?.map(t => toolToOpenAIFunction(t)),
    };
    
    const res = await fetch(`${session.config.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: request.signal,
    });
    
    for await (const line of this.parseNDJSON(res)) {
      yield {
        delta: line.message?.content ?? "",
        done: line.done ?? false,
        toolCallDeltas: line.message?.tool_calls?.map((tc: any, i: number) => ({
          index: i,
          name: tc.function?.name,
          argumentsDelta: typeof tc.function?.arguments === "string"
            ? tc.function.arguments
            : JSON.stringify(tc.function?.arguments ?? {}),
        })),
      };
    }
  }
}
```

## Fallback Chain

The MCP system supports automatic fallback across providers:

```typescript
class MCPFallbackChain {
  private candidates: MCPFallbackCandidate[];
  private currentIndex = 0;
  
  constructor(candidates: MCPFallbackCandidate[]) {
    this.candidates = candidates;
  }
  
  async *stream(request: MCPRequest): AsyncIterable<MCPChunk> {
    while (this.currentIndex < this.candidates.length) {
      const candidate = this.candidates[this.currentIndex];
      
      try {
        for await (const chunk of candidate.session.stream(request)) {
          yield {
            ...chunk,
            meta: { provider: candidate.providerId, model: candidate.modelId },
          };
          if (chunk.done) return;
        }
      } catch (err) {
        const mcpErr = err as MCPError;
        if (mcpErr.retryable) {
          this.currentIndex++;
          yield {
            delta: `\n[fallback → ${candidate.providerId}/${candidate.modelId}]\n`,
            done: false,
          };
          continue;
        }
        throw err;
      }
    }
    
    throw new MCPError("All providers exhausted", "NO_CANDIDATES");
  }
}

interface MCPFallbackCandidate {
  providerId: string;
  modelId: string;
  session: MCPSession;
  conditions: {
    retryOn?: number[];           // HTTP status codes that trigger fallback
    retryOnError?: string[];      // Error types that trigger fallback
  };
}
```

## MCP Server Mode

In addition to local provider connections, the MCP system can run a server for remote access:

```typescript
class MCPServer {
  private router: MCPRouter;
  private httpServer: HttpServer;
  
  async start(port: number): Promise<void> {
    this.httpServer = createServer(async (req, res) => {
      // MCP over WebSocket
      if (req.headers["upgrade"] === "websocket") {
        return this.handleWebSocket(req, res);
      }
      
      // MCP over REST
      const { sessionId, request } = await parseMCPRequest(req);
      const stream = this.router.stream(sessionId, request);
      
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      for await (const chunk of stream) {
        res.write(JSON.stringify(chunk) + "\n");
      }
      res.end();
    });
    
    this.httpServer.listen(port);
  }
  
  // MCP over WebSocket — bidirectional streaming
  private async handleWebSocket(req: IncomingMessage, socket: Duplex): Promise<void> {
    // ... WebSocket upgrade and bidirectional streaming
  }
}
```

## MCP Client (for Remote Mode)

When Loom connects to a remote MCP server:

```typescript
class MCPClient implements MCPAdapter {
  private serverURL: string;
  
  async createSession(config: MCPConfig): Promise<MCPSession> {
    const res = await fetch(`${this.serverURL}/mcp/session`, {
      method: "POST",
      body: JSON.stringify(config),
    });
    const { sessionId } = await res.json();
    return new RemoteMCPSession(this.serverURL, sessionId);
  }
  
  async *stream(session: MCPSession, request: MCPRequest): AsyncIterable<MCPChunk> {
    const res = await fetch(`${this.serverURL}/mcp/stream/${session.id}`, {
      method: "POST",
      body: JSON.stringify(request),
    });
    
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        yield JSON.parse(line);
      }
    }
  }
}
```

## Error Handling

```typescript
class MCPError extends Error {
  constructor(
    message: string,
    public code: MCPErrorCode,
    public retryable: boolean = false,
    public status?: number,
    public retryAfter?: number
  ) {
    super(message);
  }
}

type MCPErrorCode =
  | "AUTH_FAILED"           // Invalid/expired API key
  | "RATE_LIMITED"          // 429 — retryable
  | "SERVER_ERROR"          // 5xx — retryable
  | "MODEL_NOT_FOUND"       // Model not available
  | "CONTEXT_TOO_LONG"      // Prompt exceeds context window
  | "INVALID_REQUEST"       // Malformed request — not retryable
  | "TIMEOUT"               // Request timed out
  | "NO_CANDIDATES"         // All fallback candidates exhausted
  | "SESSION_CLOSED";       // Session was disconnected
```

## Configuration Example

```json
{
  "mcp": {
    "serverMode": false,
    "serverPort": 3100,
    "defaultProvider": "openrouter",
    "fallbackOrder": ["openrouter", "gemini", "groq", "ollama"],
    "timeoutMs": 120000,
    "maxRetries": 3,
    "retryDelayMs": 1000
  },
  "providers": {
    "openrouter": {
      "mcpFactory": "openai-compatible",
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKey": "${OPENROUTER_API_KEY}",
      "model": "qwen/qwen3-coder:free",
      "headers": {
        "HTTP-Referer": "https://loom.sh",
        "X-Title": "Loom"
      }
    },
    "anthropic": {
      "mcpFactory": "anthropic",
      "baseURL": "https://api.anthropic.com",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "model": "claude-sonnet-4-20250514"
    }
  }
}
```

## File Structure

```
src/
  mcp/
    index.ts                  # Re-exports
    router.ts                 # MCPRouter — central hub
    types.ts                  # All MCP types
    errors.ts                 # MCPError class
    session.ts                # MCPSession implementation
    fallback.ts               # MCPFallbackChain
    
    adapters/
      base.ts                 # Base adapter abstract class
      openai-compatible.ts    # OpenAI/Azure/Groq/OpenRouter/Gemini
      anthropic.ts            # Anthropic/Claude
      ollama.ts               # Ollama
      remote.ts               # Remote MCP client
      factory.ts              # Adapter factory
    
    server/
      index.ts                # MCPServer
      websocket.ts            # WebSocket handler
      rest.ts                 # REST handler
    
    client/
      index.ts                # MCPClient
    
    discovery/
      models.ts               # Model discovery via MCP
      capabilities.ts         # Capability negotiation
    
    integration/
      agent-bridge.ts         # Bridges MCP router to existing Agent loop
      config-bridge.ts        # Reads MCP config from LoomConfig
```

## Migration Path

The MCP system is designed to wrap the existing provider implementations:

1. **Phase 1** — Wrap `OpenAIProvider` and `OllamaProvider` in MCP adapters without changing their internals
2. **Phase 2** — Add `AnthropicAdapter` as new provider (no existing implementation)
3. **Phase 3** — Move provider selection and fallback from `agent.ts` into `MCPRouter`
4. **Phase 4** — Enable MCP server mode for remote connections

## Agent Bridge

The agent bridge connects the existing Agent loop to the MCP system:

```typescript
class MCPAgentBridge {
  private router: MCPRouter;
  private config: LoomConfig;
  
  createProviderForTask(prompt: string, options?: {
    forceLocal?: boolean;
    providerName?: string;
  }): Provider {
    // This bridge creates an MCP-backed Provider that the
    // existing agent loop can use without modification
    const sessionId = this.router.createSession("openrouter", {
      apiKey: this.config.providers.openrouter.apiKey,
      baseURL: this.config.providers.openrouter.baseURL,
      model: this.config.models.coding,
    });
    
    return {
      name: "mcp-bridge",
      model: this.config.models.coding,
      supportsNativeTools: true,
      stream: (req) => this.router.stream(sessionId, req),
    };
  }
}
```

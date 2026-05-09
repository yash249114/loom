import type {
  Provider,
  ProviderConfig,
  ProviderRequest,
  ProviderStreamChunk,
  ToolCallDelta,
  Message,
  ToolDefinition,
} from "../core/types.js";
import { toolToOpenAIFunction } from "../core/schema.js";
import { withRetry } from "../core/retry.js";

export class OpenAIProvider implements Provider {
  name: string;
  model: string;
  supportsNativeTools = true;
  private baseURL: string;
  private apiKey: string;
  private headers: Record<string, string>;

  constructor(name: string, cfg: ProviderConfig) {
    this.name = name;
    this.model = cfg.model;
    this.baseURL = cfg.baseURL.replace(/\/$/, "");
    this.apiKey = cfg.apiKey ?? "";
    this.headers = cfg.headers ?? {};
  }

  async *stream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk> {
    const messages = this.formatMessages(req.messages, req.systemPrompt);
    const body: Record<string, unknown> = {
      model: req.model ?? this.model,
      messages,
      stream: true,
      temperature: req.temperature ?? 0.2,
    };

    // Native function calling: convert tool definitions to OpenAI format
    if (req.tools?.length) {
      body.tools = req.tools.map((t) => toolToOpenAIFunction(t));
    }

    // Wrap fetch with retry for rate limits and transient errors
    const res = await withRetry(
      async () => {
        const r = await fetch(`${this.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
            ...this.headers,
          },
          body: JSON.stringify(body),
          signal: req.signal,
        });

        if (!r.ok) {
          const text = await r.text().catch(() => "");
          const err: any = new Error(
            `OpenAI provider error ${r.status}: ${text}`
          );
          err.status = r.status;
          // Preserve Retry-After header for the retry logic
          const retryAfter = r.headers.get("retry-after");
          if (retryAfter) err.retryAfter = retryAfter;
          throw err;
        }

        return r;
      },
      { maxAttempts: 4, baseDelayMs: 1000 }
    );

    if (!res.body) {
      throw new Error("OpenAI provider: no response body");
    }

    const reader = res.body.getReader();
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
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            yield { delta: "", done: true };
            return;
          }
          try {
            const obj = JSON.parse(payload);
            const choice = obj.choices?.[0];
            if (!choice) continue;

            const textDelta: string = choice.delta?.content ?? "";

            // Parse native tool call deltas
            const rawToolCalls: any[] = choice.delta?.tool_calls ?? [];
            let toolCallDeltas: ToolCallDelta[] | undefined;
            if (rawToolCalls.length > 0) {
              toolCallDeltas = rawToolCalls.map((tc: any) => ({
                index: tc.index ?? 0,
                id: tc.id,
                name: tc.function?.name,
                argumentsDelta: tc.function?.arguments,
              }));
            }

            if (textDelta || toolCallDeltas) {
              yield { delta: textDelta, done: false, toolCallDeltas };
            }

            if (choice.finish_reason) {
              yield { delta: "", done: true };
              return;
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    }
    yield { delta: "", done: true };
  }

  private formatMessages(
    messages: Message[],
    systemPrompt?: string
  ): Array<Record<string, unknown>> {
    const out: Array<Record<string, unknown>> = [];
    if (systemPrompt) out.push({ role: "system", content: systemPrompt });
    for (const m of messages) {
      if (m.role === "assistant" && m.toolCalls?.length) {
        // Assistant message that triggered tool calls
        out.push({
          role: "assistant",
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: "function",
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        });
      } else if (m.role === "tool" && m.toolCallId) {
        // Tool result message with proper tool_call_id
        out.push({
          role: "tool",
          tool_call_id: m.toolCallId,
          content: m.content,
        });
      } else if (m.role === "tool") {
        // Legacy tool result (no tool_call_id) — send as user message
        out.push({
          role: "user",
          content: `[tool:${m.name ?? ""}] ${m.content}`,
        });
      } else {
        out.push({ role: m.role, content: m.content });
      }
    }
    return out;
  }
}

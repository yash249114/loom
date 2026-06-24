/**
 * Anthropic Provider
 *
 * Native provider for Anthropic's Claude API.
 * Uses the Messages API format (not OpenAI-compatible).
 */
import type {
  Provider,
  ProviderConfig,
  ProviderRequest,
  ProviderStreamChunk,
  ToolCallDelta,
  Message,
  ToolDefinition,
} from "../core/types.js";

export class AnthropicProvider implements Provider {
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
    this.headers = {
      "anthropic-version": "2023-06-01",
      ...cfg.headers,
    };
  }

  async *stream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk> {
    const messages = this.formatMessages(req.messages);
    const body: Record<string, unknown> = {
      model: req.model ?? this.model,
      max_tokens: 4096,
      stream: true,
      messages,
    };

    if (req.systemPrompt) {
      body.system = req.systemPrompt;
    }

    if (req.tools?.length) {
      body.tools = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.jsonSchema ?? { type: "object" },
      }));
    }

    const res = await fetch(`${this.baseURL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        ...this.headers,
      },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const err: any = new Error(`Anthropic error ${res.status}: ${text}`);
      err.status = res.status;
      throw err;
    }

    if (!res.body) {
      throw new Error("Anthropic: no response body");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          yield { delta: "", done: true };
          return;
        }

        try {
          const obj = JSON.parse(payload);
          const eventType = obj.type;

          if (eventType === "content_block_delta") {
            const delta = obj.delta;
            if (delta?.type === "text_delta") {
              yield { delta: delta.text ?? "", done: false };
            }
          }

          if (eventType === "content_block_start" && obj.content_block?.type === "tool_use") {
            const block = obj.content_block;
            yield {
              delta: "",
              done: false,
              toolCallDeltas: [{
                index: block.index ?? 0,
                id: block.id,
                name: block.name,
                argumentsDelta: JSON.stringify(block.input ?? {}),
              }],
            };
          }

          if (eventType === "message_stop" || eventType === "message_complete") {
            yield { delta: "", done: true };
            return;
          }
        } catch {
          // skip malformed SSE
        }
      }
    }

    yield { delta: "", done: true };
  }

  private formatMessages(
    messages: Message[]
  ): Array<Record<string, unknown>> {
    const out: Array<Record<string, unknown>> = [];

    for (const m of messages) {
      if (m.role === "system") continue; // handled separately
      if (m.role === "assistant" && m.toolCalls?.length) {
        const content: any[] = [];
        if (m.content) content.push({ type: "text", text: m.content });
        for (const tc of m.toolCalls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        out.push({ role: "assistant", content });
      } else if (m.role === "tool") {
        out.push({
          role: "user",
          content: [{
            type: "tool_result",
            tool_use_id: m.toolCallId,
            content: m.content,
          }],
        });
      } else {
        out.push({ role: m.role, content: m.content });
      }
    }

    return out;
  }
}

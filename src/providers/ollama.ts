import type {
  Provider,
  ProviderConfig,
  ProviderRequest,
  ProviderStreamChunk,
  ToolCallDelta,
  Message,
} from "../core/types.js";
import { toolToOpenAIFunction } from "../core/schema.js";

export class OllamaProvider implements Provider {
  name: string;
  model: string;
  supportsNativeTools = true;
  private baseURL: string;

  constructor(name: string, cfg: ProviderConfig) {
    this.name = name;
    this.model = cfg.model;
    this.baseURL = cfg.baseURL.replace(/\/$/, "");
  }

  async *stream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk> {
    const messages = this.formatMessages(req.messages, req.systemPrompt);
    const body: Record<string, unknown> = {
      model: req.model ?? this.model,
      messages,
      stream: true,
      options: {
        temperature: req.temperature ?? 0.2,
      },
    };

    // Native tool calling: Ollama uses the same schema format as OpenAI
    if (req.tools?.length) {
      body.tools = req.tools.map((t) => toolToOpenAIFunction(t));
    }

    const res = await fetch(`${this.baseURL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: req.signal,
    });

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama error ${res.status}: ${text}`);
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
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          const delta: string = obj.message?.content ?? "";

          // Ollama returns tool_calls in the message when done
          const rawToolCalls: any[] = obj.message?.tool_calls ?? [];
          let toolCallDeltas: ToolCallDelta[] | undefined;
          if (rawToolCalls.length > 0) {
            toolCallDeltas = rawToolCalls.map((tc: any, i: number) => ({
              index: i,
              id: `ollama_call_${i}_${Date.now()}`,
              name: tc.function?.name,
              // Ollama provides arguments as an object, not a string
              argumentsDelta: typeof tc.function?.arguments === "string"
                ? tc.function.arguments
                : JSON.stringify(tc.function?.arguments ?? {}),
            }));
          }

          if (delta || toolCallDeltas) {
            yield { delta, done: false, toolCallDeltas };
          }

          if (obj.done) {
            yield { delta: "", done: true };
            return;
          }
        } catch {
          // skip malformed line
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
        out.push({
          role: "assistant",
          content: m.content || "",
          tool_calls: m.toolCalls.map((tc) => ({
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
        });
      } else if (m.role === "tool" && m.toolCallId) {
        out.push({
          role: "tool",
          content: m.content,
        });
      } else if (m.role === "tool") {
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

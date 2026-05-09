import type {
  Provider,
  Message,
  LoomConfig,
  ToolResult,
  ToolContext,
  ToolCall,
  ToolCallDelta,
} from "../core/types.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { SafetyGate } from "../safety/gate.js";
import { TypedEmitter } from "../core/events.js";
import { parseAssistantOutput } from "./parser.js";
import { buildSystemPrompt } from "./prompt.js";
import { truncate } from "../core/util.js";
import { newId, safeJSON } from "../core/util.js";
import { VerificationRunner } from "./verifier.js";
import { routeTask, getFallbackChain } from "./router.js";
import { createRoutedProvider } from "../providers/factory.js";

export interface AgentOptions {
  provider: Provider;
  registry: ToolRegistry;
  safety: SafetyGate;
  config: LoomConfig;
  workspaceRoot: string;
  workspaceContext?: string;
  systemPrompt?: string | null;
  forceLocal?: boolean;
  /** Skip task routing — use the provided provider directly (for testing) */
  skipRouting?: boolean;
}

/**
 * Tracks tool call deltas being accumulated across streaming chunks.
 * OpenAI streams tool call arguments incrementally; we accumulate them here.
 */
interface AccumulatedToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

export class Agent extends TypedEmitter {
  readonly history: Message[] = [];
  private aborter: AbortController | null = null;

  constructor(private opts: AgentOptions) {
    super();
  }

  get provider(): Provider {
    return this.opts.provider;
  }

  setProvider(p: Provider) {
    this.opts.provider = p;
  }

  abort() {
    this.aborter?.abort();
  }

  loadHistory(messages: Message[]) {
    this.history.length = 0;
    this.history.push(...messages);
  }

  async run(userInput: string): Promise<string> {
    this.history.push({
      role: "user",
      content: userInput,
      timestamp: Date.now(),
    });

    // Route the task to the appropriate model/provider
    // Skip routing if explicitly disabled (e.g., in tests with mock providers)
    let activeProvider: Provider;
    if (this.opts.skipRouting) {
      activeProvider = this.opts.provider;
    } else {
      const routing = routeTask(
        userInput,
        this.opts.config,
        this.opts.forceLocal
      );
      this.emitTyped(
        "log",
        `[router] ${routing.category} → ${routing.model} (${routing.reason})`
      );

      try {
        activeProvider = createRoutedProvider(routing, this.opts.config);
      } catch {
        activeProvider = this.opts.provider;
      }
    }

    const useNativeTools = activeProvider.supportsNativeTools;

    const systemPrompt = buildSystemPrompt({
      base: this.opts.systemPrompt ?? this.opts.config.systemPrompt,
      registry: this.opts.registry,
      workspaceRoot: this.opts.workspaceRoot,
      workspaceContext: this.opts.workspaceContext,
      nativeToolCalling: useNativeTools,
    });

    const verifier = new VerificationRunner(this.opts.config.verification);
    const maxIter = this.opts.config.agent.maxIterations;
    let verifyRetries = 0;

    for (let i = 0; i < maxIter; i++) {
      this.emitTyped("turn:start", i + 1);
      this.aborter = new AbortController();

      let fullText = "";
      const accumulated = new Map<number, AccumulatedToolCall>();

      // Build fallback chain (only used when routing is active)
      if (this.opts.skipRouting) {
        // No fallback chain — use mock provider directly
        try {
          await this.streamFromProvider(
            activeProvider,
            systemPrompt,
            accumulated,
            (delta) => { fullText += delta; }
          );
        } catch (e: any) {
          this.emitTyped("agent:error", e);
          throw e;
        }
      } else {
        const primaryDecision = routeTask(
          userInput,
          this.opts.config,
          this.opts.forceLocal
        );
        const chain = getFallbackChain(primaryDecision, this.opts.config);
        let succeeded = false;

        for (let ci = 0; ci < chain.length; ci++) {
          const candidate = chain[ci];
          try {
            const candidateProvider = createRoutedProvider(
              candidate,
              this.opts.config
            );
            activeProvider = candidateProvider;

            await this.streamFromProvider(
              candidateProvider,
              systemPrompt,
              accumulated,
              (delta) => { fullText += delta; }
            );

            // Log if we fell back from the primary
            if (ci > 0) {
              this.emitTyped(
                "log",
                `[router] using ${candidate.model} (${candidate.reason})`
              );
            }
            succeeded = true;
            break;
          } catch (err: any) {
            const status =
              err?.status ??
              err?.response?.status ??
              extractStatusFromError(err);
            // 400 = invalid model ID
            // 404 = model not found or doesn't support features (tool calling)
            // 429/5xx = rate limit or transient server error
            const retryable =
              typeof status === "number" &&
              [400, 404, 429, 500, 502, 503, 504].includes(status);

            if (!retryable) {
              this.emitTyped("agent:error", err);
              throw err;
            }

            // Log the fallback progression
            const next = chain[ci + 1];
            if (next) {
              this.emitTyped(
                "log",
                `[router] ${candidate.model} failed (${status}) → trying ${next.model}`
              );
            } else {
              // Last candidate also failed
              this.emitTyped("agent:error", err);
              throw err;
            }
          }
        }

        if (!succeeded) {
          throw new Error("All fallback candidates exhausted");
        }
      }

      this.emitTyped("stream:done", fullText);

      // Resolve tool calls: prefer native, fall back to text-fence parsing
      let toolCalls: ToolCall[];

      if (accumulated.size > 0) {
        // Native tool calls from provider
        toolCalls = this.finalizeAccumulatedCalls(accumulated);
      } else {
        // Fallback: parse text fences from model output
        const parsed = parseAssistantOutput(fullText);
        toolCalls = parsed.toolCalls;
        if (toolCalls.length > 0) {
          fullText = parsed.text; // strip fences from display text
        }
      }

      // Record assistant message in history
      this.history.push({
        role: "assistant",
        content: fullText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: Date.now(),
      });

      // No tool calls → final answer
      if (toolCalls.length === 0) {
        this.emitTyped("turn:end", i + 1);
        this.emitTyped("agent:done", fullText);
        return fullText;
      }

      // Execute tool calls
      const calls = toolCalls.slice(
        0,
        this.opts.config.agent.maxToolCallsPerTurn
      );
      const results: ToolResult[] = [];
      let fileModified = false;

      for (const call of calls) {
        this.emitTyped("tool:call", call);
        const ctx: ToolContext = {
          workspaceRoot: this.opts.workspaceRoot,
          cwd: this.opts.workspaceRoot,
          log: (m) => this.emitTyped("log", m),
          confirm: (m) => this.opts.safety.confirmGeneric(m),
          signal: this.aborter.signal,
        };
        try {
          const out = await this.opts.registry.execute(
            call.name,
            call.arguments,
            ctx
          );
          const result: ToolResult = {
            toolCallId: call.id,
            name: call.name,
            ok: true,
            output: out,
          };
          results.push(result);
          this.emitTyped("tool:result", result);

          // Track if any file-modifying tool succeeded
          if (verifier.shouldTrigger(call.name)) {
            fileModified = true;
          }
        } catch (e: any) {
          const result: ToolResult = {
            toolCallId: call.id,
            name: call.name,
            ok: false,
            output: "",
            error: e.message ?? String(e),
          };
          results.push(result);
          this.emitTyped("tool:result", result);
        }
      }

      // Append tool results to history (one message per result for native mode)
      if (useNativeTools) {
        for (const r of results) {
          this.history.push({
            role: "tool",
            toolCallId: r.toolCallId,
            name: r.name,
            content: truncate(
              r.ok ? r.output : `Error: ${r.error}`,
              30000
            ),
            timestamp: Date.now(),
          });
        }
      } else {
        // Legacy: single combined tool results message
        const summary = results
          .map(
            (r) =>
              `Tool: ${r.name}\nStatus: ${r.ok ? "ok" : "error"}\n${r.ok ? r.output : r.error}`
          )
          .join("\n\n---\n\n");

        this.history.push({
          role: "tool",
          name: "tool_results",
          content: truncate(summary, 30000),
          timestamp: Date.now(),
        });
      }

      // Verification loop: if files were modified and verification is enabled
      if (fileModified && verifier.enabled && verifyRetries < verifier.maxRetries) {
        this.emitTyped("log", "Running verification...");
        const vResult = await verifier.run(
          this.opts.workspaceRoot,
          this.aborter.signal
        );

        if (!vResult.passed) {
          verifyRetries++;
          this.emitTyped("log", `Verification failed (attempt ${verifyRetries}/${verifier.maxRetries})`);

          // Inject verification failure into context so agent can self-correct
          this.history.push({
            role: "user",
            content: `[VERIFICATION FAILED — attempt ${verifyRetries}/${verifier.maxRetries}]\n\n${vResult.summary}\n\nPlease fix the errors above.`,
            timestamp: Date.now(),
          });
          // Continue the loop — agent will see the errors and try to fix them
        } else {
          this.emitTyped("log", "Verification passed ✓");
          verifyRetries = 0; // reset on success
        }
      }

      this.emitTyped("turn:end", i + 1);
    }

    const msg = `Reached maxIterations (${maxIter}) without a final answer.`;
    this.emitTyped("agent:done", msg);
    return msg;
  }

  /**
   * Accumulate a streaming tool call delta into the accumulated map.
   * OpenAI streams tool call arguments in fragments across multiple chunks.
   */
  private accumulateToolCallDelta(
    accumulated: Map<number, AccumulatedToolCall>,
    delta: ToolCallDelta
  ) {
    const existing = accumulated.get(delta.index);
    if (existing) {
      // Append argument fragment
      if (delta.argumentsDelta) {
        existing.argumentsJson += delta.argumentsDelta;
      }
      // Update name/id if provided (usually only in first chunk)
      if (delta.name) existing.name = delta.name;
      if (delta.id) existing.id = delta.id;
    } else {
      // First chunk for this tool call index
      accumulated.set(delta.index, {
        id: delta.id ?? newId("call"),
        name: delta.name ?? "",
        argumentsJson: delta.argumentsDelta ?? "",
      });
    }
  }

  /**
   * Convert accumulated tool call fragments into finalized ToolCall objects.
   */
  private finalizeAccumulatedCalls(
    accumulated: Map<number, AccumulatedToolCall>
  ): ToolCall[] {
    const calls: ToolCall[] = [];
    const sorted = [...accumulated.entries()].sort(([a], [b]) => a - b);

    for (const [, acc] of sorted) {
      if (!acc.name) continue; // skip incomplete calls

      let args: Record<string, unknown> = {};
      if (acc.argumentsJson) {
        const parsed = safeJSON<Record<string, unknown>>(acc.argumentsJson);
        if (parsed && typeof parsed === "object") {
          args = parsed;
        }
      }

      calls.push({
        id: acc.id || newId("call"),
        name: acc.name,
        arguments: args,
      });
    }

    return calls;
  }

  private compactHistory(): Message[] {
    const ctxLimit = 60;
    if (this.history.length <= ctxLimit) return [...this.history];
    const head = this.history.slice(0, 2);
    const tail = this.history.slice(-ctxLimit);
    const omitted = this.history.length - head.length - tail.length;
    return [
      ...head,
      {
        role: "system",
        content: `[…${omitted} earlier messages omitted for context window…]`,
      },
      ...tail,
    ];
  }

  /**
   * Stream from a provider, accumulating text and tool call deltas.
   * Extracted to avoid duplicating the streaming loop in both
   * the skipRouting path and each fallback chain candidate.
   */
  private async streamFromProvider(
    provider: Provider,
    systemPrompt: string,
    accumulated: Map<number, AccumulatedToolCall>,
    onDelta: (delta: string) => void
  ): Promise<void> {
    const stream = provider.stream({
      messages: this.compactHistory(),
      systemPrompt,
      temperature: this.opts.config.agent.temperature,
      signal: this.aborter!.signal,
      tools: provider.supportsNativeTools
        ? this.opts.registry.list()
        : undefined,
    });

    for await (const chunk of stream) {
      if (chunk.delta) {
        onDelta(chunk.delta);
        this.emitTyped("stream:delta", chunk.delta);
      }
      if (chunk.toolCallDeltas) {
        for (const delta of chunk.toolCallDeltas) {
          this.accumulateToolCallDelta(accumulated, delta);
        }
      }
      if (chunk.done) break;
    }
  }
}

/**
 * Try to extract an HTTP status code from an error message like
 * "OpenAI provider error 429: ..."
 */
function extractStatusFromError(err: any): number | undefined {
  const msg = err?.message ?? "";
  const match = msg.match(/error\s+(\d{3})/i);
  if (match) return parseInt(match[1], 10);
  return undefined;
}

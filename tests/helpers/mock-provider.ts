/**
 * MockProvider — configurable fake provider for testing.
 *
 * Supports both text-based responses and structured tool call responses,
 * allowing tests to exercise both native and fallback code paths.
 */
import type {
  Provider,
  ProviderRequest,
  ProviderStreamChunk,
  ToolCallDelta,
} from "../../src/core/types.js";

export interface MockResponse {
  /** Text content the model "generates" */
  text?: string;
  /** Structured tool calls (simulates native function calling) */
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
  /** If set, the stream will throw this error */
  error?: Error;
  /** Per-chunk delay in ms (simulates streaming latency) */
  chunkDelayMs?: number;
}

export class MockProvider implements Provider {
  name = "mock";
  model = "mock-model";
  supportsNativeTools = true;

  /** Queue of responses — each call to stream() pops the next one */
  private responses: MockResponse[] = [];
  /** Record of all requests made */
  readonly requests: ProviderRequest[] = [];
  /** Default response if queue is empty */
  defaultResponse: MockResponse = { text: "Mock response." };

  /** Push one or more responses onto the queue */
  enqueue(...responses: MockResponse[]): void {
    this.responses.push(...responses);
  }

  /** Clear all queued responses and recorded requests */
  reset(): void {
    this.responses = [];
    this.requests.length = 0;
  }

  async *stream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk> {
    this.requests.push(req);
    const resp = this.responses.shift() ?? { ...this.defaultResponse };

    if (resp.error) {
      throw resp.error;
    }

    // Emit text content as character-by-character deltas (chunked for realism)
    if (resp.text) {
      const chunkSize = 20;
      for (let i = 0; i < resp.text.length; i += chunkSize) {
        const delta = resp.text.slice(i, i + chunkSize);
        yield { delta, done: false };
        if (resp.chunkDelayMs) {
          await sleep(resp.chunkDelayMs);
        }
      }
    }

    // Emit structured tool calls
    if (resp.toolCalls?.length) {
      for (const tc of resp.toolCalls) {
        const argsJson = JSON.stringify(tc.arguments);
        // Simulate OpenAI-style incremental deltas
        yield {
          delta: "",
          done: false,
          toolCallDeltas: [
            {
              index: 0,
              id: tc.id,
              name: tc.name,
              argumentsDelta: argsJson,
            },
          ],
        };
      }
    }

    yield { delta: "", done: true };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Create a provider that returns a single text response.
 */
export function textProvider(text: string): MockProvider {
  const p = new MockProvider();
  p.defaultResponse = { text };
  return p;
}

/**
 * Create a provider that returns a response with toolcall fences
 * (for testing the text-fence fallback path).
 */
export function fencedToolCallProvider(
  toolName: string,
  args: Record<string, unknown>,
  narrative = ""
): MockProvider {
  const fence = `${narrative}\n\`\`\`toolcall\n${JSON.stringify({ name: toolName, arguments: args })}\n\`\`\``;
  return textProvider(fence);
}

/**
 * Create a provider that returns structured native tool calls.
 */
export function nativeToolCallProvider(
  calls: Array<{ id: string; name: string; arguments: Record<string, unknown> }>
): MockProvider {
  const p = new MockProvider();
  p.enqueue({ toolCalls: calls });
  return p;
}

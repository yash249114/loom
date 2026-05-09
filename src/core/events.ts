import { EventEmitter } from "node:events";
import type { ToolCall, ToolResult } from "./types.js";

export interface AgentEvents {
  "turn:start": (iteration: number) => void;
  "turn:end": (iteration: number) => void;
  "stream:delta": (delta: string) => void;
  "stream:done": (full: string) => void;
  "tool:call": (call: ToolCall) => void;
  "tool:result": (result: ToolResult) => void;
  "agent:done": (final: string) => void;
  "agent:error": (err: Error) => void;
  "log": (msg: string) => void;
}

export class TypedEmitter extends EventEmitter {
  emitTyped<E extends keyof AgentEvents>(event: E, ...args: Parameters<AgentEvents[E]>): boolean {
    return super.emit(event, ...args);
  }
  onTyped<E extends keyof AgentEvents>(event: E, listener: AgentEvents[E]): this {
    return super.on(event, listener as (...a: any[]) => void);
  }
  offTyped<E extends keyof AgentEvents>(event: E, listener: AgentEvents[E]): this {
    return super.off(event, listener as (...a: any[]) => void);
  }
}

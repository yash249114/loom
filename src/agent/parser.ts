import type { ToolCall } from "../core/types.js";
import { newId, safeJSON } from "../core/util.js";

// Matches ```toolcall ... ``` fenced blocks in assistant output
// Using String.raw to safely embed backtick sequences
const TOOL_BLOCK_RE = /```toolcall\s*\n([\s\S]*?)```/g;

export interface ParsedAssistantOutput {
  text: string;
  toolCalls: ToolCall[];
}

export function parseAssistantOutput(raw: string): ParsedAssistantOutput {
  const toolCalls: ToolCall[] = [];
  const matches = [...raw.matchAll(TOOL_BLOCK_RE)];
  for (const m of matches) {
    const body = m[1]!.trim();
    const obj = safeJSON<{ name: string; arguments?: Record<string, unknown> }>(body);
    if (obj && typeof obj.name === "string") {
      toolCalls.push({
        id: newId("call"),
        name: obj.name,
        arguments: obj.arguments ?? {},
      });
    }
  }
  // Strip toolcall blocks from text shown to user; keep narrative
  const text = raw.replace(TOOL_BLOCK_RE, "").trim();
  return { text, toolCalls };
}

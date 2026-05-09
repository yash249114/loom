import type { ToolRegistry } from "../tools/registry.js";
import { DEFAULT_SYSTEM_PROMPT } from "../config/defaults.js";

export function buildSystemPrompt(opts: {
  base?: string | null;
  registry: ToolRegistry;
  workspaceRoot: string;
  workspaceContext?: string;
  nativeToolCalling?: boolean;
}): string {
  const base = opts.base ?? DEFAULT_SYSTEM_PROMPT;
  const tools = opts.registry.list();

  // When using native tool calling, tools are passed separately via the API.
  // We still list them in the prompt for context awareness but omit the
  // fenced-block format instructions.
  const toolDocs = tools
    .map((t) => {
      const schema = describeZodSchema(t.parameters);
      return `### ${t.name}\n${t.description}\nArguments: ${schema}`;
    })
    .join("\n\n");

  let toolInstructions = "";
  if (!opts.nativeToolCalling) {
    // Text-fence fallback: teach the model the toolcall format
    toolInstructions = `
## Tool Calling Format

To call a tool, emit a fenced JSON block exactly like this:

\`\`\`toolcall
{"name":"toolname","arguments":{"key":"value"}}
\`\`\`

You may emit multiple toolcall blocks in a single response.
Tool results will be returned in the next turn.
`;
  } else {
    toolInstructions = `
## Tool Calling

You have tools available through native function calling.
Call tools when needed. Tool results will be provided after execution.
`;
  }

  return `${base}

## Workspace
Working directory: ${opts.workspaceRoot}
${opts.workspaceContext ? `\n${opts.workspaceContext}` : ""}

## Available Tools

${toolDocs}
${toolInstructions}
When the task is complete:
- stop calling tools
- provide a concise final summary
- mention important files changed
- mention verification steps performed
`;
}

// FIX: Zod v3 stores schema internals at `._def`, not `.def`
function describeZodSchema(schema: any): string {
  try {
    const def = schema._def;
    if (def?.typeName === "ZodObject") {
      const shape =
        typeof def.shape === "function" ? def.shape() : def.shape;
      const parts: string[] = [];
      for (const [key, val] of Object.entries(shape)) {
        const v: any = val;
        const optional = v.isOptional?.() ? "?" : "";
        const inner =
          v._def?.typeName?.replace(/^Zod/, "").toLowerCase() ?? "any";
        parts.push(`${key}${optional}: ${inner}`);
      }
      return `{ ${parts.join(", ")} }`;
    }
  } catch {
    // fall through
  }
  return "object";
}

import { describe, it, expect } from "vitest";
import { parseAssistantOutput } from "../../../src/agent/parser.js";

describe("parseAssistantOutput", () => {
  it("returns plain text when no tool calls", () => {
    const result = parseAssistantOutput("Hello, I can help you with that.");
    expect(result.text).toBe("Hello, I can help you with that.");
    expect(result.toolCalls).toHaveLength(0);
  });

  it("extracts a single tool call", () => {
    const raw = `Let me read that file.

\`\`\`toolcall
{"name":"readfile","arguments":{"path":"src/index.ts"}}
\`\`\``;
    const result = parseAssistantOutput(raw);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("readfile");
    expect(result.toolCalls[0].arguments).toEqual({ path: "src/index.ts" });
    expect(result.text).toContain("Let me read that file.");
    expect(result.text).not.toContain("toolcall");
  });

  it("extracts multiple tool calls", () => {
    const raw = `Reading two files.

\`\`\`toolcall
{"name":"readfile","arguments":{"path":"a.ts"}}
\`\`\`

\`\`\`toolcall
{"name":"readfile","arguments":{"path":"b.ts"}}
\`\`\``;
    const result = parseAssistantOutput(raw);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].arguments).toEqual({ path: "a.ts" });
    expect(result.toolCalls[1].arguments).toEqual({ path: "b.ts" });
  });

  it("handles tool calls with no arguments", () => {
    const raw = `\`\`\`toolcall
{"name":"listdir"}
\`\`\``;
    const result = parseAssistantOutput(raw);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("listdir");
    expect(result.toolCalls[0].arguments).toEqual({});
  });

  it("skips malformed JSON in tool blocks", () => {
    const raw = `\`\`\`toolcall
{not valid json}
\`\`\``;
    const result = parseAssistantOutput(raw);
    expect(result.toolCalls).toHaveLength(0);
  });

  it("skips blocks missing the name field", () => {
    const raw = `\`\`\`toolcall
{"arguments":{"path":"x"}}
\`\`\``;
    const result = parseAssistantOutput(raw);
    expect(result.toolCalls).toHaveLength(0);
  });

  it("generates unique IDs for each call", () => {
    const raw = `\`\`\`toolcall
{"name":"a"}
\`\`\`
\`\`\`toolcall
{"name":"b"}
\`\`\``;
    const result = parseAssistantOutput(raw);
    expect(result.toolCalls[0].id).not.toBe(result.toolCalls[1].id);
  });

  it("strips toolcall fences from displayed text", () => {
    const raw = `Before\n\`\`\`toolcall\n{"name":"x"}\n\`\`\`\nAfter`;
    const result = parseAssistantOutput(raw);
    expect(result.text).toContain("Before");
    expect(result.text).toContain("After");
    expect(result.text).not.toContain("toolcall");
  });
});

import { describe, it, expect } from "vitest";
import { z } from "zod";
import { zodToJsonSchema, toolToOpenAIFunction } from "../../../src/core/schema.js";

describe("zodToJsonSchema", () => {
  it("converts a simple object schema", () => {
    const schema = z.object({
      path: z.string(),
      count: z.number(),
    });
    const result = zodToJsonSchema(schema);
    expect(result).toEqual({
      type: "object",
      properties: {
        path: { type: "string" },
        count: { type: "number" },
      },
      required: ["path", "count"],
    });
  });

  it("marks optional fields as not required", () => {
    const schema = z.object({
      required: z.string(),
      optional: z.string().optional(),
    });
    const result = zodToJsonSchema(schema);
    expect(result.required).toEqual(["required"]);
    expect(result.properties!.optional).toEqual({ type: "string" });
  });

  it("handles default values", () => {
    const schema = z.object({
      name: z.string(),
      limit: z.number().default(100),
    });
    const result = zodToJsonSchema(schema);
    expect(result.required).toEqual(["name"]);
    expect(result.properties!.limit).toEqual({ type: "number", default: 100 });
  });

  it("converts integer types", () => {
    const schema = z.object({
      n: z.number().int(),
    });
    const result = zodToJsonSchema(schema);
    expect(result.properties!.n).toEqual({ type: "integer" });
  });

  it("converts boolean types", () => {
    const schema = z.object({ flag: z.boolean() });
    const result = zodToJsonSchema(schema);
    expect(result.properties!.flag).toEqual({ type: "boolean" });
  });

  it("converts array types", () => {
    const schema = z.object({
      items: z.array(z.string()),
    });
    const result = zodToJsonSchema(schema);
    expect(result.properties!.items).toEqual({
      type: "array",
      items: { type: "string" },
    });
  });

  it("converts enum types", () => {
    const schema = z.object({
      mode: z.enum(["fast", "slow"]),
    });
    const result = zodToJsonSchema(schema);
    expect(result.properties!.mode).toEqual({
      type: "string",
      enum: ["fast", "slow"],
    });
  });

  it("preserves descriptions", () => {
    const schema = z.object({
      path: z.string().describe("The file path"),
    });
    const result = zodToJsonSchema(schema);
    expect(result.properties!.path).toEqual({
      type: "string",
      description: "The file path",
    });
  });

  it("handles nested objects", () => {
    const schema = z.object({
      outer: z.object({
        inner: z.string(),
      }),
    });
    const result = zodToJsonSchema(schema);
    expect(result.properties!.outer).toEqual({
      type: "object",
      properties: { inner: { type: "string" } },
      required: ["inner"],
    });
  });

  it("handles complex tool schema (readfile-like)", () => {
    const schema = z.object({
      path: z.string().describe("Path relative to workspace root"),
      maxBytes: z.number().int().positive().optional().default(200000),
    });
    const result = zodToJsonSchema(schema);
    expect(result.required).toEqual(["path"]);
    expect(result.properties!.path.description).toBe(
      "Path relative to workspace root"
    );
  });
});

describe("toolToOpenAIFunction", () => {
  it("converts a tool definition to OpenAI function format", () => {
    const tool = {
      name: "readfile",
      description: "Read a file",
      parameters: z.object({ path: z.string() }),
    };
    const result = toolToOpenAIFunction(tool);
    expect(result.type).toBe("function");
    expect(result.function.name).toBe("readfile");
    expect(result.function.description).toBe("Read a file");
    expect(result.function.parameters.type).toBe("object");
  });
});

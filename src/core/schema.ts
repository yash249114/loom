/**
 * Convert Zod schemas to JSON Schema for native OpenAI/Ollama function calling.
 *
 * Handles the Zod types actually used in Loom tool definitions:
 * ZodObject, ZodString, ZodNumber, ZodBoolean, ZodArray,
 * ZodOptional, ZodDefault, ZodEnum, ZodLiteral.
 */
import type { z } from "zod";

export interface JsonSchema {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  default?: unknown;
  [key: string]: unknown;
}

/**
 * Convert a Zod schema to a JSON Schema object suitable for OpenAI/Ollama
 * function calling `parameters` field.
 */
export function zodToJsonSchema(schema: z.ZodType): JsonSchema {
  return convertNode(schema);
}

function convertNode(node: any): JsonSchema {
  const def = node?._def;
  if (!def) return { type: "object" };

  const typeName: string = def.typeName ?? "";

  switch (typeName) {
    case "ZodObject": {
      const shape =
        typeof def.shape === "function" ? def.shape() : def.shape;
      const properties: Record<string, JsonSchema> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(shape)) {
        properties[key] = convertNode(value);
        if (!isOptionalLike(value)) {
          required.push(key);
        }
      }

      const result: JsonSchema = { type: "object", properties };
      if (required.length > 0) result.required = required;
      return withDescription(result, def);
    }

    case "ZodString": {
      return withDescription({ type: "string" }, def);
    }

    case "ZodNumber": {
      const checks: Array<{ kind: string }> = def.checks ?? [];
      const isInt = checks.some((c) => c.kind === "int");
      return withDescription({ type: isInt ? "integer" : "number" }, def);
    }

    case "ZodBoolean": {
      return withDescription({ type: "boolean" }, def);
    }

    case "ZodArray": {
      const items = def.type ? convertNode(def.type) : { type: "string" };
      return withDescription({ type: "array", items }, def);
    }

    case "ZodEnum": {
      return withDescription(
        { type: "string", enum: def.values ?? [] },
        def
      );
    }

    case "ZodLiteral": {
      const val = def.value;
      return withDescription(
        { type: typeof val as string, enum: [val] },
        def
      );
    }

    case "ZodOptional": {
      return convertNode(def.innerType);
    }

    case "ZodDefault": {
      const inner = convertNode(def.innerType);
      inner.default = def.defaultValue?.();
      return inner;
    }

    case "ZodNullable": {
      const inner = convertNode(def.innerType);
      inner.type = inner.type ? [inner.type, "null"] as any : "null";
      return inner;
    }

    case "ZodEffects": {
      // .refine(), .transform(), .preprocess() — convert the inner schema
      return convertNode(def.schema);
    }

    case "ZodUnion": {
      const options = (def.options ?? []).map(convertNode);
      return { anyOf: options };
    }

    case "ZodRecord": {
      const valueSchema = def.valueType
        ? convertNode(def.valueType)
        : { type: "string" };
      return withDescription(
        { type: "object", additionalProperties: valueSchema },
        def
      );
    }

    default: {
      return { type: "object" };
    }
  }
}

function isOptionalLike(node: any): boolean {
  const tn = node?._def?.typeName ?? "";
  if (tn === "ZodOptional") return true;
  if (tn === "ZodDefault") return true;
  return false;
}

function withDescription(schema: JsonSchema, def: any): JsonSchema {
  const desc = def.description;
  if (desc) schema.description = desc;
  return schema;
}

/**
 * Convert a ToolDefinition into the OpenAI function calling format.
 */
export function toolToOpenAIFunction(tool: {
  name: string;
  description: string;
  parameters: z.ZodType;
}): {
  type: "function";
  function: { name: string; description: string; parameters: JsonSchema };
} {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
    },
  };
}

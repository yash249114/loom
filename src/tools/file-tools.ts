import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ToolDefinition } from "../core/types.js";
import { truncate } from "../core/util.js";

const resolveSafe = (root: string, p: string): string => {
  const abs = path.resolve(root, p);
  if (!abs.startsWith(path.resolve(root))) {
    throw new Error(`Path '${p}' escapes workspace root`);
  }
  return abs;
};

export const readFileTool: ToolDefinition = {
  name: "readfile",
  description: "Read the contents of a text file from the workspace.",
  parameters: z.object({
    path: z.string().describe("Path relative to workspace root"),
    maxBytes: z.number().int().positive().optional().default(200000),
  }),
  handler: async ({ path: p, maxBytes }, ctx) => {
    const abs = resolveSafe(ctx.workspaceRoot, p);
    const stat = await fs.stat(abs);
    if (!stat.isFile()) throw new Error(`Not a file: ${p}`);
    const content = await fs.readFile(abs, "utf8");
    return truncate(content, maxBytes);
  },
};

export const writeFileTool: ToolDefinition = {
  name: "writefile",
  description: "Create or overwrite a file with the given content.",
  parameters: z.object({
    path: z.string(),
    content: z.string(),
  }),
  dangerous: true,
  handler: async ({ path: p, content }, ctx) => {
    const abs = resolveSafe(ctx.workspaceRoot, p);
    const ok = await ctx.confirm(`Write ${content.length} bytes to ${p}?`);
    if (!ok) return "Write cancelled by user.";
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, "utf8");
    return `Wrote ${content.length} bytes to ${p}`;
  },
};

export const editFileTool: ToolDefinition = {
  name: "editfile",
  description:
    "Replace the contents between two anchor strings in a file. Both anchors must occur exactly once.",
  parameters: z.object({
    path: z.string(),
    startAnchor: z
      .string()
      .describe("Unique substring marking start of region (inclusive)"),
    endAnchor: z
      .string()
      .describe("Unique substring marking end of region (inclusive)"),
    replacement: z.string(),
  }),
  dangerous: true,
  handler: async ({ path: p, startAnchor, endAnchor, replacement }, ctx) => {
    const abs = resolveSafe(ctx.workspaceRoot, p);
    const original = await fs.readFile(abs, "utf8");
    const start = original.indexOf(startAnchor);
    if (start === -1) throw new Error(`startAnchor not found in ${p}`);
    if (original.indexOf(startAnchor, start + 1) !== -1)
      throw new Error(`startAnchor not unique in ${p}`);
    const end = original.indexOf(endAnchor, start + startAnchor.length);
    if (end === -1)
      throw new Error(`endAnchor not found after startAnchor in ${p}`);
    const next =
      original.slice(0, start) +
      replacement +
      original.slice(end + endAnchor.length);
    const regionLen = end - start + endAnchor.length;
    const ok = await ctx.confirm(
      `Edit region in ${p} (${regionLen} → ${replacement.length} chars)?`
    );
    if (!ok) return "Edit cancelled by user.";
    await fs.writeFile(abs, next, "utf8");
    return `Edited ${p}: replaced ${regionLen} chars with ${replacement.length}.`;
  },
};

export const patchFileTool: ToolDefinition = {
  name: "patchfile",
  description:
    "Apply one or more search/replace patches to a file. Each search string must occur exactly once.",
  parameters: z.object({
    path: z.string(),
    patches: z
      .array(
        z.object({
          search: z.string(),
          replace: z.string(),
        })
      )
      .min(1),
  }),
  dangerous: true,
  handler: async ({ path: p, patches }, ctx) => {
    const abs = resolveSafe(ctx.workspaceRoot, p);
    let content = await fs.readFile(abs, "utf8");
    const applied: string[] = [];
    for (const [i, { search, replace }] of patches.entries()) {
      const idx = content.indexOf(search);
      if (idx === -1) throw new Error(`Patch #${i + 1}: search string not found`);
      if (content.indexOf(search, idx + 1) !== -1)
        throw new Error(`Patch #${i + 1}: search string not unique`);
      content = content.slice(0, idx) + replace + content.slice(idx + search.length);
      applied.push(`#${i + 1}: ${search.length}→${replace.length} chars`);
    }
    const ok = await ctx.confirm(
      `Apply ${patches.length} patch(es) to ${p}?`
    );
    if (!ok) return "Patch cancelled by user.";
    await fs.writeFile(abs, content, "utf8");
    return `Applied patches to ${p}: ${applied.join(", ")}`;
  },
};

export const listDirTool: ToolDefinition = {
  name: "listdir",
  description: "List the contents of a directory (non-recursive by default).",
  parameters: z.object({
    path: z.string().default("."),
    recursive: z.boolean().optional().default(false),
    maxEntries: z.number().int().positive().optional().default(500),
  }),
  handler: async ({ path: p, recursive, maxEntries }, ctx) => {
    const abs = resolveSafe(ctx.workspaceRoot, p);
    const out: string[] = [];
    const walk = async (dir: string, depth: number): Promise<void> => {
      if (out.length >= maxEntries) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (out.length >= maxEntries) return;
        if (e.name.startsWith(".git") || e.name === "node_modules") continue;
        const full = path.join(dir, e.name);
        const rel = path.relative(ctx.workspaceRoot, full);
        out.push(`${e.isDirectory() ? "d" : "f"} ${rel}`);
        if (recursive && e.isDirectory() && depth < 8)
          await walk(full, depth + 1);
      }
    };
    await walk(abs, 0);
    return out.join("\n") || "(empty)";
  },
};

import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import fg from "fast-glob";
import type { ToolDefinition } from "../core/types.js";

export const searchFilesTool: ToolDefinition = {
  name: "searchfiles",
  description:
    "Recursive file search by glob pattern, optionally grepping content.",
  parameters: z.object({
    pattern: z
      .string()
      .describe("Glob pattern, e.g. '**/*.ts'")
      .default("**/*"),
    contains: z
      .string()
      .optional()
      .describe("Optional regex; only files containing a match are returned"),
    maxResults: z.number().int().positive().optional().default(100),
  }),
  handler: async ({ pattern, contains, maxResults }, ctx) => {
    const matches = await fg(pattern, {
      cwd: ctx.workspaceRoot,
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.loom/**"],
      onlyFiles: true,
      dot: false,
    });

    const results: string[] = [];
    if (contains) {
      let re: RegExp;
      try {
        re = new RegExp(contains, "i");
      } catch {
        return `Error: Invalid regex pattern "${contains}"`;
      }

      for (const m of matches) {
        if (results.length >= maxResults) break;
        const full = path.join(ctx.workspaceRoot, m);
        try {
          const stat = await fs.stat(full);
          if (stat.size > 2_000_000) continue;
          const ext = path.extname(m).toLowerCase();
          if (/\.(png|jpe?g|gif|bmp|ico|webp|mp[34]|wav|ogg|flac|wasm|exe|dll|so|dylib|zip|tar|gz|rar|7z|pdf|woff2?|ttf|otf)$/i.test(ext)) continue;
          const text = await fs.readFile(full, "utf8");
          const lines = text.split("\n");
          const hits: string[] = [];
          lines.forEach((ln, i) => {
            if (re.test(ln) && hits.length < 5)
              hits.push(`  ${i + 1}: ${ln.trim().slice(0, 200)}`);
          });
          if (hits.length) results.push(`${m}\n${hits.join("\n")}`);
        } catch {
          // skip unreadable files
        }
      }
    } else {
      results.push(...matches.slice(0, maxResults));
    }

    return results.length ? results.join("\n") : "(no matches)";
  },
};

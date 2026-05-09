import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ToolRegistry } from "../tools/registry.js";

export async function loadPlugins(
  dir: string,
  registry: ToolRegistry
): Promise<string[]> {
  if (!fs.existsSync(dir)) return [];
  const loaded: string[] = [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
  for (const f of files) {
    const full = path.join(dir, f);
    try {
      const mod = await import(pathToFileURL(full).href);
      const fn = mod.default ?? mod.register;
      if (typeof fn === "function") {
        await fn(registry);
        loaded.push(f);
      }
    } catch (e: any) {
      console.error(`Plugin ${f} failed:`, e.message);
    }
  }
  return loaded;
}

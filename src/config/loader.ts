import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { LoomConfigSchema } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { interpolateEnv } from "../core/util.js";
import type { LoomConfig } from "../core/types.js";

export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    const targetVal = result[key];
    const sourceVal = source[key];
    if (
      targetVal &&
      sourceVal &&
      typeof targetVal === "object" &&
      typeof sourceVal === "object" &&
      !Array.isArray(targetVal) &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result;
}

export function findConfigPath(workspace: string): string | null {
  const candidates = [
    path.join(workspace, ".loomrc.json"),
    path.join(workspace, ".loom", "config.json"),
    path.join(os.homedir(), ".loomrc.json"),
    path.join(os.homedir(), ".loom", "config.json"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

export function loadConfig(
  workspace: string = process.cwd()
): { config: LoomConfig; path: string | null } {
  const p = findConfigPath(workspace);
  if (!p) return { config: DEFAULT_CONFIG, path: null };

  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
    const interpolated = interpolateEnv(raw) as Record<string, unknown>;
    const merged = deepMerge(DEFAULT_CONFIG as unknown as Record<string, unknown>, interpolated);
    const parsed = LoomConfigSchema.parse(merged);
    return { config: parsed as LoomConfig, path: p };
  } catch (e: any) {
    if (e instanceof SyntaxError) {
      console.error(`Warning: Invalid JSON in config file ${p}, using defaults.`);
    } else if (e.code === "EACCES" || e.code === "EPERM") {
      console.error(`Warning: Permission denied reading config ${p}, using defaults.`);
    } else if (e.code === "ENOENT") {
      console.error(`Warning: Config file ${p} not found, using defaults.`);
    } else {
      console.error(`Warning: Error loading config ${p}: ${e.message}, using defaults.`);
    }
    return { config: DEFAULT_CONFIG, path: null };
  }
}

export function writeConfig(filepath: string, config: LoomConfig): void {
  try {
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    fs.writeFileSync(filepath, JSON.stringify(config, null, 2));
  } catch (e: any) {
    console.error(`Warning: Failed to write config file ${filepath}: ${e.message}`);
  }
}

export function resolveProvider(
  config: LoomConfig,
  name?: string
): { key: string; cfg: LoomConfig["providers"][string] } {
  let key = name ?? config.defaultProvider;
  if (config.aliases[key]) key = config.aliases[key]!;
  const cfg = config.providers[key];
  if (!cfg) throw new Error(`Provider '${key}' not found in config`);
  return { key, cfg };
}

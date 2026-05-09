import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { LoomConfigSchema } from "./schema.js";
import { DEFAULT_CONFIG } from "./defaults.js";
import { interpolateEnv } from "../core/util.js";
import type { LoomConfig } from "../core/types.js";

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
  const raw = JSON.parse(fs.readFileSync(p, "utf8"));
  const interpolated = interpolateEnv(raw);
  const merged = { ...DEFAULT_CONFIG, ...interpolated };
  const parsed = LoomConfigSchema.parse(merged);
  return { config: parsed as LoomConfig, path: p };
}

export function writeConfig(filepath: string, config: LoomConfig): void {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(config, null, 2));
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

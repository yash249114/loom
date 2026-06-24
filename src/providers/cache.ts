/**
 * Provider Cache — caches discovered models to disk with TTL.
 *
 * Cache location:
 *   1. Workspace `.loom/models/` directory
 *   2. Global `~/.loom/models/` fallback
 *
 * Each provider gets its own JSON file. Cache is invalidated
 * based on TTL (default 1 hour, configurable).
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { ProviderCacheEntry, ModelInfo, ProviderKey } from "../core/types.js";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface CacheOptions {
  workspaceDir?: string;
  ttlMs?: number;
}

export class ModelCache {
  private cacheDir: string;
  private ttlMs: number;

  constructor(opts: CacheOptions = {}) {
    const ws = opts.workspaceDir
      ? path.join(opts.workspaceDir, ".loom", "models")
      : "";
    this.cacheDir = ws || path.join(os.homedir(), ".loom", "models");
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  private cachePath(provider: ProviderKey): string {
    return path.join(this.cacheDir, `${provider}-models.json`);
  }

  /** Read cached models for a provider. Returns null if expired or missing. */
  read(provider: ProviderKey): ModelInfo[] | null {
    try {
      const file = this.cachePath(provider);
      if (!fs.existsSync(file)) return null;
      const raw = fs.readFileSync(file, "utf8");
      const entry: ProviderCacheEntry = JSON.parse(raw);
      const age = Date.now() - entry.fetchedAt;
      if (age > entry.ttlMs) {
        fs.unlinkSync(file);
        return null;
      }
      return entry.models;
    } catch {
      return null;
    }
  }

  /** Write models to cache */
  write(provider: ProviderKey, models: ModelInfo[], ttlMs?: number): void {
    try {
      const entry: ProviderCacheEntry = {
        provider,
        models,
        fetchedAt: Date.now(),
        ttlMs: ttlMs ?? this.ttlMs,
      };
      fs.writeFileSync(this.cachePath(provider), JSON.stringify(entry, null, 2));
    } catch {
      // silently fail — cache is non-critical
    }
  }

  /** Invalidate cache for a provider */
  invalidate(provider: ProviderKey): void {
    try {
      const file = this.cachePath(provider);
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      // ignore
    }
  }

  /** Invalidate all caches */
  invalidateAll(): void {
    try {
      const providers: ProviderKey[] = [
        "openrouter", "gemini", "groq", "openai", "anthropic", "ollama",
      ];
      for (const p of providers) this.invalidate(p);
    } catch {
      // ignore
    }
  }

  /** Get cache age for a provider in ms. Returns -1 if no cache. */
  age(provider: ProviderKey): number {
    try {
      const file = this.cachePath(provider);
      if (!fs.existsSync(file)) return -1;
      const raw = fs.readFileSync(file, "utf8");
      const entry: ProviderCacheEntry = JSON.parse(raw);
      return Date.now() - entry.fetchedAt;
    } catch {
      return -1;
    }
  }
}

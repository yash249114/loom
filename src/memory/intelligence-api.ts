import { EventBus, Events } from "../core/events.js";
import type { MemoryPipeline } from "./pipeline.js";
import type { GraphStats } from "./types.js";
import { SymbolType } from "../repository/types.js";

/* ── Unified Dashboard Stats ────────────────────────────────── */

export interface FileStats {
  total: number;
  byLanguage: Record<string, number>;
  indexedAt: number;
}

export interface SymbolStats {
  total: number;
  byType: Record<string, number>;
}

export interface DependencyStats {
  total: number;
  byType: Record<string, number>;
  cycles: number;
}

export interface GraphMeta {
  edges: number;
  lastIndexed: number;
  indexDuration: number;
}

export interface MemoryStats {
  total: number;
  byType: Record<string, number>;
}

export interface ArchStats {
  adrs: number;
  patterns: number;
}

export interface TokenBudgetStats {
  total: number;
  used: number;
  available: number;
}

export interface DashboardStats {
  files: FileStats;
  symbols: SymbolStats;
  dependencies: DependencyStats;
  graph: GraphMeta;
  memory: MemoryStats;
  arch: ArchStats;
  tokenBudget: TokenBudgetStats;
  languages: string[];
  timestamp: number;
}

export type StatsChangeCallback = (stats: DashboardStats) => void;

/* ── RepositoryIntelligence ─────────────────────────────────── */

export class RepositoryIntelligence {
  private pipeline: MemoryPipeline;
  private eventBus?: EventBus;
  private snapshot: DashboardStats | null = null;
  private subscribers: Set<StatsChangeCallback> = new Set();
  private autoRefreshTimer: ReturnType<typeof setInterval> | null = null;
  private refreshInterval = 5000;
  private dirty = true;

  constructor(pipeline: MemoryPipeline, eventBus?: EventBus) {
    this.pipeline = pipeline;
    this.eventBus = eventBus;
  }

  /* ── Core Snapshot ─────────────────────────────────────────── */

  getSnapshot(): DashboardStats {
    if (!this.snapshot) {
      this.snapshot = this.computeStats();
    }
    return this.snapshot;
  }

  async refresh(): Promise<DashboardStats> {
    this.dirty = true;
    return this.computeStats();
  }

  markDirty(): void {
    this.dirty = true;
  }

  /* ── Four API Endpoints ────────────────────────────────────── */

  getRepositoryStats(): { files: FileStats; languages: string[] } {
    const s = this.getSnapshot();
    return { files: s.files, languages: s.languages };
  }

  getGraphStats(): GraphMeta {
    return this.getSnapshot().graph;
  }

  getMemoryStats(): MemoryStats {
    return this.getSnapshot().memory;
  }

  getContextStats(): TokenBudgetStats {
    return this.getSnapshot().tokenBudget;
  }

  /* ── Live Updates ──────────────────────────────────────────── */

  subscribe(callback: StatsChangeCallback): () => void {
    this.subscribers.add(callback);
    if (this.snapshot) {
      callback(this.snapshot);
    }
    return () => this.subscribers.delete(callback);
  }

  startAutoRefresh(intervalMs = 5000): () => void {
    this.refreshInterval = intervalMs;
    if (this.autoRefreshTimer) clearInterval(this.autoRefreshTimer);
    this.autoRefreshTimer = setInterval(() => this.tick(), intervalMs);
    return () => this.stopAutoRefresh();
  }

  stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  /* ── Internal ──────────────────────────────────────────────── */

  private computeStats(): DashboardStats {
    const now = Date.now();
    const graphStats: GraphStats = this.pipeline.workspaceGraph.getStats();
    const memStats = this.pipeline.longTermMemory.getStats();
    const adrs = this.pipeline.architectureKnowledge.getAllADRs();
    const patterns = this.pipeline.architectureKnowledge.getAllPatterns();

    const byLanguage = this.computeLanguageBreakdown(graphStats);
    const byType = this.computeSymbolTypeBreakdown();
    const depByType = this.computeDepTypeBreakdown();
    const cycles = this.pipeline.workspaceGraph.findCycles().length;

    const budget = {
      total: 24000,
      used: graphStats.symbolCount * 4 + graphStats.fileCount * 10 + memStats.total * 20,
      available: 0,
    };
    budget.available = Math.max(0, budget.total - budget.used);

    this.snapshot = {
      files: {
        total: graphStats.fileCount,
        byLanguage,
        indexedAt: graphStats.lastIndexed,
      },
      symbols: {
        total: graphStats.symbolCount,
        byType,
      },
      dependencies: {
        total: graphStats.depCount,
        byType: depByType,
        cycles,
      },
      graph: {
        edges: graphStats.edgeCount,
        lastIndexed: graphStats.lastIndexed,
        indexDuration: graphStats.indexDuration,
      },
      memory: memStats,
      arch: {
        adrs: adrs.length,
        patterns: patterns.length,
      },
      tokenBudget: budget,
      languages: graphStats.languages,
      timestamp: now,
    };

    this.dirty = false;
    this.notifySubscribers();
    this.emitEvent();

    return this.snapshot;
  }

  private computeLanguageBreakdown(graphStats: GraphStats): Record<string, number> {
    const byLanguage: Record<string, number> = {};
    for (const lang of graphStats.languages) {
      byLanguage[lang] = byLanguage[lang] || 0;
    }
    const allSyms = this.pipeline.workspaceGraph.searchSymbols({ limit: 100000 });
    for (const sym of allSyms) {
      const lang = String(sym.language);
      byLanguage[lang] = (byLanguage[lang] || 0) + 1;
    }
    return byLanguage;
  }

  private computeSymbolTypeBreakdown(): Record<string, number> {
    const byType: Record<string, number> = {};
    const allSyms = this.pipeline.workspaceGraph.searchSymbols({ limit: 100000 });
    for (const sym of allSyms) {
      const t = String(sym.type);
      byType[t] = (byType[t] || 0) + 1;
    }
    return byType;
  }

  private computeDepTypeBreakdown(): Record<string, number> {
    const byType: Record<string, number> = {};
    const allDeps = this.pipeline.workspaceGraph.findDependencies({ limit: 100000 });
    for (const dep of allDeps) {
      const t = String(dep.type);
      byType[t] = (byType[t] || 0) + 1;
    }
    return byType;
  }

  private notifySubscribers(): void {
    if (!this.snapshot) return;
    for (const cb of this.subscribers) {
      try { cb(this.snapshot); } catch { /* squash */ }
    }
  }

  private emitEvent(): void {
    if (!this.eventBus || !this.snapshot) return;
    this.eventBus.emit(Events.INTELLIGENCE_UPDATE, this.snapshot);
  }

  private tick(): void {
    if (!this.dirty) return;
    this.computeStats();
  }
}

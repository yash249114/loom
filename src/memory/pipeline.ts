import type { IndexResult, ContextRequest, EnrichedContext, Observation, ContextBudget } from "./types.js";
import { WorkspaceGraph } from "./workspace-graph.js";
import { SymbolGraph } from "./symbol-graph.js";
import { LongTermMemory } from "./project-memory.js";
import { ArchitectureKnowledge } from "./arch-knowledge.js";
import { ContextEngine } from "./context-engine.js";
import { Indexer } from "../indexer/indexer.js";
import { RepositoryIntelligence } from "./intelligence-api.js";
import type { EventBus } from "../core/events.js";
import { Events } from "../core/events.js";

export interface PipelineConfig {
  rootDir: string;
  verbose?: boolean;
  budget?: Partial<ContextBudget>;
  scoring?: {
    relevanceWeight?: number;
    freshnessWeight?: number;
    importanceWeight?: number;
    halflifeDays?: number;
    recencyBoost?: number;
  };
  extractKnowledge?: boolean;
  eventBus?: EventBus;
}

export interface PipelineStats {
  graph: { fileCount: number; symbolCount: number; edgeCount: number };
  memory: { total: number; byType: Record<string, number> };
  arch: { adrs: number; patterns: number };
  lastIndexDuration: number;
}

export class MemoryPipeline {
  private config: PipelineConfig;
  private graph: WorkspaceGraph;
  private symGraph: SymbolGraph;
  private memory: LongTermMemory;
  private arch: ArchitectureKnowledge;
  private context: ContextEngine;
  private indexer: Indexer;
  private verbose: boolean;
  private eventBus?: EventBus;
  private _intelligence: RepositoryIntelligence;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.verbose = config.verbose ?? false;
    this.eventBus = config.eventBus;
    this.graph = new WorkspaceGraph(config.rootDir);
    this.symGraph = new SymbolGraph(this.graph);
    this.memory = new LongTermMemory(config.rootDir);
    this.arch = new ArchitectureKnowledge(config.rootDir);
    this.context = new ContextEngine(this.graph, this.symGraph, this.arch, config.scoring);
    this.indexer = new Indexer({ rootDir: config.rootDir, verbose: this.verbose });
    this._intelligence = new RepositoryIntelligence(this, this.eventBus);
  }

  get workspaceGraph(): WorkspaceGraph { return this.graph; }
  get symbolGraph(): SymbolGraph { return this.symGraph; }
  get longTermMemory(): LongTermMemory { return this.memory; }
  get architectureKnowledge(): ArchitectureKnowledge { return this.arch; }
  get contextEngine(): ContextEngine { return this.context; }
  get intelligence(): RepositoryIntelligence { return this._intelligence; }

  /* ── Initialization ────────────────────────────────────────── */

  async init(): Promise<void> {
    if (this.verbose) console.error("Loading memory systems...");
    await this.graph.load();
    await this.memory.load();
    await this.arch.load();
    this._intelligence.markDirty();
    if (this.verbose) {
      const stats = this.graph.getStats();
      console.error(`  Graph: ${stats.fileCount} files, ${stats.symbolCount} symbols, ${stats.edgeCount} edges`);
      const mem = this.memory.getStats();
      console.error(`  Memory: ${mem.total} observations`);
      console.error(`  Arch: ${this.arch.getAllADRs().length} ADRs, ${this.arch.getAllPatterns().length} patterns`);
    }
  }

  /* ── Indexing ──────────────────────────────────────────────── */

  async index(force = false): Promise<IndexResult> {
    if (this.verbose) console.error(force ? "Running full index..." : "Running incremental index...");
    if (this.eventBus) this.eventBus.emit(Events.INDEX_START, { force });
    const result = await this.graph.index(force);
    if (this.eventBus) {
      this.eventBus.emit(Events.INDEX_COMPLETE, result);
      this.eventBus.emit(Events.INTELLIGENCE_UPDATE, { type: "index-complete", result });
    }
    this._intelligence.markDirty();
    return result;
  }

  /* ── Context Building ──────────────────────────────────────── */

  async buildContext(request: ContextRequest): Promise<EnrichedContext> {
    if (this.verbose) console.error(`Building context for: ${request.query || "no query"}`);
    return this.context.buildContext(request);
  }

  /* ── Knowledge Extraction ──────────────────────────────────── */

  async extractKnowledge(
    messages: Array<{ role: string; content: string }>,
    sessionId: string
  ): Promise<Observation[]> {
    if (!this.config.extractKnowledge) return [];
    const observations = this.memory.extractFromConversation(messages, sessionId);
    if (observations.length > 0) {
      await this.memory.persist(observations);
      if (this.verbose) console.error(`Extracted ${observations.length} observations`);
    }
    return observations;
  }

  /* ── Status ────────────────────────────────────────────────── */

  getStats(): PipelineStats {
    const graphStats = this.graph.getStats();
    return {
      graph: {
        fileCount: graphStats.fileCount,
        symbolCount: graphStats.symbolCount,
        edgeCount: graphStats.edgeCount,
      },
      memory: this.memory.getStats(),
      arch: {
        adrs: this.arch.getAllADRs().length,
        patterns: this.arch.getAllPatterns().length,
      },
      lastIndexDuration: graphStats.indexDuration,
    };
  }

  /* ── Combined Search ───────────────────────────────────────── */

  async searchAll(query: string, limit = 20): Promise<{
    symbols: any[];
    memory: any[];
    arch: any[];
  }> {
    const symbols = this.graph.searchSymbols({ name: query, limit });
    const memory = await this.memory.query({ text: query, limit });
    const archADRs = this.arch
      .getAllADRs()
      .filter(a => a.title.toLowerCase().includes(query.toLowerCase()) || a.context.toLowerCase().includes(query.toLowerCase()))
      .slice(0, limit);
    return {
      symbols,
      memory: memory.map(m => m.observation),
      arch: archADRs,
    };
  }
}

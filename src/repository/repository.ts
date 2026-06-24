import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { GraphBuilder } from "./graph-builder.js";
import { TokenBudgetManager } from "./token-budget-manager.js";
import { RepositoryIndexer } from "./indexer.js";
import type { IndexStatus, SymbolQuery, DependencyQuery, ContextRequest } from "./types.js";

export interface RepositoryConfig {
  root: string;
  patterns?: string[];
  exclude?: string[];
  maxFileSize?: number;
  maxParallelWorkers?: number;
  cacheSize?: number;
  enableIncremental?: boolean;
  enableStreaming?: boolean;
  tokenBudget?: {
    maxTokens: number;
    buffer: number;
    warningThreshold: number;
  };
}

export interface RepositoryInfo {
  root: string;
  fileCount: number;
  lineCount: number;
  symbolCount: number;
  dependencyCount: number;
  lastIndexed: number;
  languages: string[];
}

export class Repository {
  private config: RepositoryConfig;
  private indexer: RepositoryIndexer;
  private graphBuilder: GraphBuilder;
  private tokenBudgetManager: TokenBudgetManager;
  private indexStatus: IndexStatus;
  private isInitialized = false;

  constructor(config: RepositoryConfig) {
    this.config = {
      maxFileSize: 10 * 1024 * 1024,
      maxParallelWorkers: 4,
      cacheSize: 100 * 1024 * 1024,
      enableIncremental: true,
      enableStreaming: true,
      ...config,
    };

    this.indexer = new RepositoryIndexer(this.config);
    this.graphBuilder = new GraphBuilder();
    this.tokenBudgetManager = new TokenBudgetManager({
      maxTokens: this.config.tokenBudget?.maxTokens ?? 8192,
      buffer: this.config.tokenBudget?.buffer ?? 512,
      warningThreshold: this.config.tokenBudget?.warningThreshold ?? 0.8,
    });

    this.indexStatus = {
      isComplete: false,
      lastUpdated: 0,
      fileCount: 0,
      symbolCount: 0,
      dependencyCount: 0,
      progress: 0,
      estimatedTimeRemaining: 0,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    const loomDir = path.join(this.config.root, ".loom");
    if (!fsSync.existsSync(loomDir)) {
      await fs.mkdir(loomDir, { recursive: true });
    }

    this.isInitialized = true;
  }

  isIndexed(): boolean {
    return this.indexStatus.isComplete;
  }

  getIndexStatus(): IndexStatus {
    return { ...this.indexStatus };
  }

  async buildContext(request: ContextRequest): Promise<string> {
    await this.initialize();

    const contextParts: string[] = [];

    const symbols = await this.searchSymbols({ name: request.query, limit: 50 });
    if (symbols.length > 0) {
      contextParts.push(`### Relevant Symbols\n${symbols.map(s => `- ${s.name} (${s.type}): ${s.file}:${s.line}`).join("\n")}`);
    }

    if (request.includeDependencies) {
      const deps = await this.findDependencies({ source: request.query, limit: 20 });
      if (deps.length > 0) {
        contextParts.push(`### Dependencies\n${deps.map(d => `- ${d.source} → ${d.target} (${d.type})`).join("\n")}`);
      }
    }

    if (contextParts.length === 0) {
      contextParts.push("No repository context available for this query.");
    }

    return contextParts.join("\n\n");
  }

  async searchSymbols(query: SymbolQuery): Promise<SymbolNode[]> {
    return this.graphBuilder.searchSymbols(query);
  }

  async findDependencies(query: DependencyQuery): Promise<DependencyNode[]> {
    return this.graphBuilder.findDependencies(query);
  }

  async getRepositoryInfo(): Promise<RepositoryInfo> {
    return {
      root: this.config.root,
      fileCount: this.indexStatus.fileCount,
      lineCount: 0,
      symbolCount: this.indexStatus.symbolCount,
      dependencyCount: this.indexStatus.dependencyCount,
      lastIndexed: this.indexStatus.lastUpdated,
      languages: [],
    };
  }

  estimateTokenUsage(context: string): number {
    return this.tokenBudgetManager.estimateTokens(context);
  }
}

export type SymbolNode = import("./types.js").SymbolNode;
export type DependencyNode = import("./types.js").DependencyNode;
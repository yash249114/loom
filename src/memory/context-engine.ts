import { WorkspaceGraph } from "./workspace-graph.js";
import { SymbolGraph } from "./symbol-graph.js";
import { ArchitectureKnowledge } from "./arch-knowledge.js";
import type { ContextRequest, ContextBudget, ContextPackage, EnrichedContext, ScoringConfig } from "./types.js";

const DEFAULT_SCORING: ScoringConfig = {
  relevanceWeight: 0.5,
  freshnessWeight: 0.2,
  importanceWeight: 0.3,
  halflifeDays: 14,
  recencyBoost: 1.5,
};

const DEFAULT_BUDGET_ALLOCATION: ContextBudget = {
  total: 24000,
  used: 0,
  system: 1000,
  identity: 500,
  memory: 4000,
  arch: 2000,
  symbols: 3000,
  files: 4000,
  deps: 3000,
  tools: 2000,
  history: 2000,
};

export class ContextEngine {
  private graph: WorkspaceGraph;
  private symbolGraph: SymbolGraph;
  private arch: ArchitectureKnowledge;
  private scoring: ScoringConfig;

  constructor(
    graph: WorkspaceGraph,
    symbolGraph: SymbolGraph,
    arch: ArchitectureKnowledge,
    scoring?: Partial<ScoringConfig>
  ) {
    this.graph = graph;
    this.symbolGraph = symbolGraph;
    this.arch = arch;
    this.scoring = { ...DEFAULT_SCORING, ...scoring };
  }

  /* ── Main Entry Point ──────────────────────────────────────── */

  async buildContext(request: ContextRequest): Promise<EnrichedContext> {
    const budget = this.computeBudget(request.budget);
    const relevanceScores = new Map<string, number>();

    const relevantFiles = request.files || [];
    const relevantSymbols = request.symbols || [];

    for (const file of relevantFiles) {
      relevanceScores.set(file, this.scoreFile(file, request));
    }
    for (const sym of relevantSymbols) {
      relevanceScores.set(sym, this.scoreSymbol(sym, request));
    }

    if (request.query && request.query.length > 2) {
      const scored = await this.graph.retrieve(request.query, 30);
      for (const item of scored) {
        const key = item.file.path;
        if (key && !relevanceScores.has(key)) {
          relevanceScores.set(key, item.score * 0.8);
        }
      }
    }

    const packages = this.assembleContextPackages(request, relevanceScores, budget);

    const archContext = await this.arch.getArchitectureContext(relevantFiles, relevantSymbols);

    let summary = "";
    if (request.query) {
      summary = this.generateSummary(packages, request);
    }

    return {
      systemPrompt: "",
      identity: "",
      memoryEntries: "",
      archEntries: "",
      symbolEntries: "",
      fileEntries: "",
      depEntries: "",
      toolEntries: "",
      historyEntries: "",
      packages,
      graph: {
        nodes: this.graph.getStats().symbolCount,
        edges: this.graph.getStats().edgeCount,
        files: this.graph.getStats().fileCount,
      },
      architecture: archContext,
      summary,
      budget: this.computeBudgetUsage(packages, budget),
      stats: {
        filesUsed: relevantFiles.length,
        symbolsUsed: relevantSymbols.length,
        memoryUsed: 0,
        archUsed: 0,
        compressionRatio: 1,
      },
      metadata: {
        query: request.query,
        fileCount: relevantFiles.length,
        symbolCount: relevantSymbols.length,
        packageCount: packages.length,
        timestamp: Date.now(),
      },
    };
  }

  /* ── Package Assembly ──────────────────────────────────────── */

  private assembleContextPackages(
    request: ContextRequest,
    scores: Map<string, number>,
    budget: ContextBudget
  ): ContextPackage[] {
    const packages: ContextPackage[] = [];
    let remaining = budget.total;

    // 1. Files (highest priority)
    if (request.files && request.files.length > 0) {
      const sortedFiles = request.files
        .sort((a, b) => (scores.get(b) || 0) - (scores.get(a) || 0))
        .slice(0, Math.floor(budget.files / 80));
      const content = sortedFiles.join("\n");
      packages.push({
        id: "files",
        type: "files",
        priority: 1,
        content,
        tokens: content.length,
        source: "request",
      });
      remaining -= content.length;
    }

    // 2. Symbols
    if (request.symbols && request.symbols.length > 0) {
      const sortedSyms = request.symbols
        .sort((a, b) => (scores.get(b) || 0) - (scores.get(a) || 0))
        .slice(0, Math.floor(budget.symbols / 60));
      const content = sortedSyms.join("\n");
      packages.push({
        id: "symbols",
        type: "symbols",
        priority: 2,
        content,
        tokens: content.length,
        source: "request",
      });
      remaining -= content.length;
    }

    // 3. Dependencies
    if (request.files && request.files.length > 0 && remaining > 0) {
      const allDeps: string[] = [];
      for (const file of request.files) {
        const deps = this.graph.findDependencies({ source: file, limit: 10 });
        allDeps.push(...deps.map(d => `${d.source} → ${d.target}`));
      }
      if (allDeps.length > 0) {
        const content = allDeps.slice(0, 50).join("\n");
        packages.push({
          id: "dependencies",
          type: "dependencies",
          priority: 3,
          content,
          tokens: content.length,
          source: "graph",
        });
        remaining -= content.length;
      }
    }

    // 4. Relationships (symbol graph)
    if (request.symbols && request.symbols.length > 0 && remaining > 0) {
      const allRel = new Set<string>();
      for (const sym of request.symbols) {
        const rels = this.symbolGraph.getRelationships(sym);
        for (const r of rels) {
          const src = r.sourceSymbol?.name || r.source;
          const tgt = r.targetSymbol?.name || r.target;
          allRel.add(`${r.type} ${src} → ${tgt}`);
        }
      }
      if (allRel.size > 0) {
        const content = Array.from(allRel).slice(0, 30).join("\n");
        packages.push({
          id: "relationships",
          type: "relationships",
          priority: 4,
          content,
          tokens: content.length,
          source: "graph",
        });
        remaining -= content.length;
      }
    }

    // 5. Architecture context
    if (remaining > 1000) {
      const archLines = request.files && request.symbols
        ? `Architecture decisions and patterns available for ${request.files.length} files and ${request.symbols.length} symbols`
        : "";
      if (archLines) {
        packages.push({
          id: "architecture",
          type: "architecture",
          priority: 5,
          content: archLines,
          tokens: archLines.length,
          source: "arch",
        });
        remaining -= archLines.length;
      }
    }

    // 6. Instructions
    if (request.instructions && remaining > 0) {
      packages.push({
        id: "instructions",
        type: "instructions",
        priority: 6,
        content: request.instructions,
        tokens: request.instructions.length,
        source: "request",
      });
      remaining -= request.instructions.length;
    }

    return packages;
  }

  /* ── Scoring ───────────────────────────────────────────────── */

  private scoreFile(file: string, request: ContextRequest): number {
    let score = 0.5;
    if (request.query) {
      const q = request.query.toLowerCase();
      const f = file.toLowerCase();
      const words = q.split(/\s+/).filter(w => w.length > 2);
      const matchCount = words.filter(w => f.includes(w)).length;
      score += (matchCount / Math.max(words.length, 1)) * this.scoring.relevanceWeight;
    }
    if (request.focusArea) {
      const area = request.focusArea.toLowerCase();
      if (file.toLowerCase().includes(area)) {
        score += 0.3;
      }
    }
    return score;
  }

  private scoreSymbol(sym: string, request: ContextRequest): number {
    let score = 0.5;
    if (request.query) {
      const q = request.query.toLowerCase();
      const s = sym.toLowerCase();
      if (s.includes(q) || q.includes(s)) {
        score += 0.4;
      }
    }
    if (request.focusArea) {
      const area = request.focusArea.toLowerCase();
      if (sym.toLowerCase().includes(area)) {
        score += 0.2;
      }
    }
    return score;
  }

  /* ── Budget ────────────────────────────────────────────────── */

  computeBudget(budgetOverride?: Partial<ContextBudget>): ContextBudget {
    return { ...DEFAULT_BUDGET_ALLOCATION, ...budgetOverride };
  }

  private computeBudgetUsage(packages: ContextPackage[], _budget: ContextBudget): ContextBudget {
    const total = packages.reduce((sum, pkg) => sum + pkg.tokens, 0);
    return { ...DEFAULT_BUDGET_ALLOCATION, used: total };
  }

  /* ── Summary ───────────────────────────────────────────────── */

  private generateSummary(packages: ContextPackage[], request: ContextRequest): string {
    const filePkg = packages.find(p => p.type === "files");
    const symPkg = packages.find(p => p.type === "symbols");
    const depPkg = packages.find(p => p.type === "dependencies");

    const parts: string[] = [];
    if (request.query) parts.push(`Query: ${request.query}`);
    if (filePkg) parts.push(`Files: ${filePkg.content.split("\n").length}`);
    if (symPkg) parts.push(`Symbols: ${symPkg.content.split("\n").length}`);
    if (depPkg) parts.push(`Dependencies: ${depPkg.content.split("\n").length}`);
    const total = packages.reduce((s, p) => s + p.tokens, 0);
    parts.push(`Total tokens: ${total}`);

    return parts.join(" | ");
  }

  /* ── Stream Assembly (large repos) ─────────────────────────── */

  async *streamContext(request: ContextRequest): AsyncIterable<ContextPackage> {
    const budget = this.computeBudget(request.budget);
    const relevanceScores = new Map<string, number>();

    const files = request.files || [];
    const symbols = request.symbols || [];

    for (const file of files) {
      relevanceScores.set(file, this.scoreFile(file, request));
    }
    for (const sym of symbols) {
      relevanceScores.set(sym, this.scoreSymbol(sym, request));
    }

    let remaining = budget.total;

    if (files.length > 0) {
      const sorted = files.sort((a, b) => (relevanceScores.get(b) || 0) - (relevanceScores.get(a) || 0));
      const limit = Math.floor(budget.files / 80);
      const batch = sorted.slice(0, limit);
      const pkg: ContextPackage = {
        id: "files",
        type: "files",
        priority: 1,
        content: batch.join("\n"),
        tokens: batch.join("\n").length,
        source: "request",
      };
      remaining -= pkg.tokens;
      yield pkg;
    }

    if (symbols.length > 0) {
      const sorted = symbols.sort((a, b) => (relevanceScores.get(b) || 0) - (relevanceScores.get(a) || 0));
      const limit = Math.floor(budget.symbols / 60);
      const batch = sorted.slice(0, limit);
      const pkg: ContextPackage = {
        id: "symbols",
        type: "symbols",
        priority: 2,
        content: batch.join("\n"),
        tokens: batch.join("\n").length,
        source: "request",
      };
      remaining -= pkg.tokens;
      yield pkg;
    }

    if (files.length > 0 && remaining > 0) {
      const allDeps: string[] = [];
      for (const file of files) {
        const deps = this.graph.findDependencies({ source: file, limit: 5 });
        allDeps.push(...deps.map(d => `${d.source} → ${d.target}`));
      }
      if (allDeps.length > 0) {
        const pkg: ContextPackage = {
          id: "dependencies",
          type: "dependencies",
          priority: 3,
          content: allDeps.slice(0, 30).join("\n"),
          tokens: allDeps.slice(0, 30).join("\n").length,
          source: "graph",
        };
        yield pkg;
      }
    }

    if (request.instructions && remaining > 0) {
      const pkg: ContextPackage = {
        id: "instructions",
        type: "instructions",
        priority: 6,
        content: request.instructions,
        tokens: request.instructions.length,
        source: "request",
      };
      yield pkg;
    }
  }
}

import fs from "node:fs";
import path from "node:path";
import { Indexer } from "../indexer/indexer.js";
import { GraphBuilder } from "../repository/graph-builder.js";
import { SymbolType, DependencyType, Language, type SymbolNode, type DependencyNode, type SymbolQuery, type DependencyQuery } from "../repository/types.js";
import type { IndexOutput, IndexSymbol, FileDependency } from "../indexer/types.js";
import { buildGraph } from "../retrieval/graph.js";
import { rankFiles } from "../retrieval/retriever.js";
import type { ScoredItem, RepoFile } from "../retrieval/types.js";
import type { IndexResult, GraphStats, GraphEdge, Relationship, GraphAnalysis } from "./types.js";
import { newId } from "../core/util.js";

const GRAPH_VERSION = "2.0";
const GRAPH_DIR = ".loom/graph";

interface Metadata {
  version: string;
  root: string;
  createdAt: number;
  lastUpdated: number;
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  edgeCount: number;
  indexDuration: number;
}

export class WorkspaceGraph {
  private rootDir: string;
  private graphDir: string;
  private metadata: Metadata;
  private symbols: Map<string, SymbolNode> = new Map();
  private deps: Map<string, DependencyNode> = new Map();
  private edges: GraphEdge[] = [];
  private graphBuilder: GraphBuilder;
  private loaded = false;
  private indexer: Indexer;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.graphDir = path.join(rootDir, GRAPH_DIR);
    this.indexer = new Indexer({ rootDir, verbose: false });
    this.graphBuilder = new GraphBuilder();
    this.metadata = {
      version: GRAPH_VERSION,
      root: rootDir,
      createdAt: 0,
      lastUpdated: 0,
      fileCount: 0,
      symbolCount: 0,
      dependencyCount: 0,
      edgeCount: 0,
      indexDuration: 0,
    };
  }

  get root(): string { return this.rootDir; }

  /* ── Lifecycle ──────────────────────────────────────────────── */

  async load(): Promise<void> {
    if (!fs.existsSync(this.graphDir)) {
      this.loaded = true;
      return;
    }

    const readFile = async (p: string): Promise<string> => {
      try { return await fs.promises.readFile(p, "utf-8"); } catch { return ""; }
    };

    const [metaRaw, symbolsRaw, depsRaw, edgesRaw] = await Promise.all([
      readFile(path.join(this.graphDir, "metadata.json")),
      readFile(path.join(this.graphDir, "symbols.ndjson")),
      readFile(path.join(this.graphDir, "deps.ndjson")),
      readFile(path.join(this.graphDir, "edges.ndjson")),
    ]);

    if (metaRaw) {
      try { this.metadata = JSON.parse(metaRaw); } catch { /* use defaults */ }
    }

    for (const line of symbolsRaw.split("\n").filter(Boolean)) {
      try {
        const node = JSON.parse(line) as SymbolNode;
        this.symbols.set(node.id, node);
        this.graphBuilder.addSymbol(node);
      } catch { /* skip corrupt line */ }
    }

    for (const line of depsRaw.split("\n").filter(Boolean)) {
      try {
        const node = JSON.parse(line) as DependencyNode;
        this.deps.set(node.id, node);
        this.graphBuilder.addDependency(node);
      } catch { /* skip corrupt line */ }
    }

    for (const line of edgesRaw.split("\n").filter(Boolean)) {
      try {
        this.edges.push(JSON.parse(line));
      } catch { /* skip corrupt line */ }
    }

    this.loaded = true;
  }

  async save(): Promise<void> {
    await fs.promises.mkdir(this.graphDir, { recursive: true });

    const symbolsLines = Array.from(this.symbols.values()).map(s => JSON.stringify(s)).join("\n");
    const depsLines = Array.from(this.deps.values()).map(d => JSON.stringify(d)).join("\n");
    const edgesLines = this.edges.map(e => JSON.stringify(e)).join("\n");

    await Promise.all([
      fs.promises.writeFile(path.join(this.graphDir, "metadata.json"), JSON.stringify(this.metadata, null, 2), "utf-8"),
      fs.promises.writeFile(path.join(this.graphDir, "symbols.ndjson"), symbolsLines, "utf-8"),
      fs.promises.writeFile(path.join(this.graphDir, "deps.ndjson"), depsLines, "utf-8"),
      fs.promises.writeFile(path.join(this.graphDir, "edges.ndjson"), edgesLines, "utf-8"),
    ]);
  }

  /* ── Indexing ───────────────────────────────────────────────── */

  async index(force = false): Promise<IndexResult> {
    const start = Date.now();
    const output = await this.indexer.run(force);
    const isIncremental = !force && output.files.length < this.metadata.fileCount * 1.1;

    this.ingestIndexOutput(output);
    this.buildEdgesFromDeps(output.dependencies);

    this.metadata.lastUpdated = Date.now();
    this.metadata.fileCount = output.files.length;
    this.metadata.symbolCount = output.symbols.length;
    this.metadata.dependencyCount = output.dependencies.length;
    this.metadata.edgeCount = this.edges.length;
    this.metadata.indexDuration = Date.now() - start;

    if (!this.metadata.createdAt) {
      this.metadata.createdAt = Date.now();
    }

    await this.save();

    return {
      fileCount: output.files.length,
      symbolCount: output.symbols.length,
      depCount: output.dependencies.length,
      edgeCount: this.edges.length,
      durationMs: Date.now() - start,
      isIncremental,
      errors: [],
    };
  }

  private ingestIndexOutput(output: IndexOutput): void {
    this.symbols.clear();
    this.deps.clear();
    this.graphBuilder.clear();

    for (const sym of output.symbols) {
      const node = this.indexSymbolToNode(sym);
      this.symbols.set(node.id, node);
      this.graphBuilder.addSymbol(node);
    }

    for (const dep of output.dependencies) {
      const node = this.fileDepToNode(dep);
      this.deps.set(node.id, node);
      this.graphBuilder.addDependency(node);
    }
  }

  private buildEdgesFromDeps(deps: FileDependency[]): void {
    this.edges = [];
    for (const dep of deps) {
      if (!dep.target) continue;
      this.edges.push({
        from: dep.source,
        to: dep.target,
        type: dep.type === "type-import" ? "IMPORTS" as Relationship : "IMPORTS" as Relationship,
        weight: 1,
      });
    }
    const seen = new Set<string>();
    this.edges = this.edges.filter(e => {
      const key = `${e.from}:${e.to}:${e.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    this.metadata.edgeCount = this.edges.length;
  }

  private indexSymbolToNode(sym: IndexSymbol): SymbolNode {
    return {
      id: `${sym.file}:${sym.name}`,
      name: sym.name,
      type: this.toSymbolType(sym.kind),
      qualifiedName: sym.parent ? `${sym.parent}.${sym.name}` : sym.name,
      file: sym.file,
      line: sym.line,
      column: sym.column,
      signature: "",
      doc: "",
      modifiers: sym.visibility ? [sym.visibility] : [],
      tags: [],
      exports: sym.visibility === "exported" || sym.visibility === "default",
      imports: [],
      language: this.toLangEnum(sym.file),
      metadata: {},
    };
  }

  private fileDepToNode(dep: FileDependency): DependencyNode {
    return {
      id: `${dep.source}:→:${dep.target}`,
      source: dep.source,
      target: dep.target,
      type: this.toDepType(dep.type),
      strength: 1,
      metadata: { symbols: dep.symbols },
      language: this.toLangEnum(dep.source),
    };
  }

  private toSymbolType(kind: IndexSymbol["kind"]): SymbolType {
    const map: Record<string, SymbolType> = {
      function: SymbolType.FUNCTION,
      method: SymbolType.METHOD,
      class: SymbolType.CLASS,
      interface: SymbolType.INTERFACE,
      type: SymbolType.TYPE_ALIAS,
      enum: SymbolType.ENUM,
      variable: SymbolType.VARIABLE,
      constant: SymbolType.CONSTANT,
    };
    return map[kind] ?? SymbolType.VARIABLE;
  }

  private toLangEnum(_file: string): Language {
    return Language.TYPESCRIPT;
  }

  private toDepType(type: FileDependency["type"]): DependencyType {
    const map: Record<string, DependencyType> = {
      import: DependencyType.IMPORT,
      require: DependencyType.REQUIRE,
      "dynamic-import": DependencyType.DYNAMIC_IMPORT,
      "type-import": DependencyType.IMPORT_TYPE,
    };
    return map[type] ?? DependencyType.IMPORT;
  }

  /* ── Queries ────────────────────────────────────────────────── */

  searchSymbols(query: SymbolQuery): SymbolNode[] {
    if (!this.loaded) return [];
    return this.graphBuilder.searchSymbols(query);
  }

  getSymbol(id: string): SymbolNode | undefined {
    return this.symbols.get(id);
  }

  getFileSymbols(file: string): SymbolNode[] {
    return Array.from(this.symbols.values()).filter(s => s.file === file);
  }

  findDependencies(query: DependencyQuery): DependencyNode[] {
    if (!this.loaded) return [];
    return this.graphBuilder.findDependencies(query);
  }

  getReachable(from: string, depth = 10): SymbolNode[] {
    const reachableIds = this.graphBuilder.getReachableSymbols(from);
    const result: SymbolNode[] = [];
    for (const id of reachableIds.slice(0, depth)) {
      const node = this.symbols.get(id);
      if (node) result.push(node);
    }
    return result;
  }

  findPath(from: string, to: string): string[] {
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [{ node: from, path: [from] }];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      if (current.node === to) return current.path;
      if (visited.has(current.node)) continue;
      visited.add(current.node);
      const edges = this.edges.filter(e => e.from === current.node || e.to === current.node);
      for (const edge of edges) {
        const next = edge.from === current.node ? edge.to : edge.from;
        if (!visited.has(next)) {
          queue.push({ node: next, path: [...current.path, next] });
        }
      }
    }
    return [];
  }

  analyze(module: string): GraphAnalysis {
    const analysis = this.graphBuilder.analyze(module);
    const reachable = analysis.reachableSymbols(module);
    const closure = analysis.transitiveClosure([module]);
    const cycles = analysis.findCycles();
    const critical = analysis.criticalPath();
    const imp = analysis.importanceScore(module);
    const coupling = analysis.coupling(module);
    const cohesion = analysis.cohesion(module);
    const edges = this.edges.filter(e => e.from === module || e.to === module);
    return {
      module,
      reachableSymbols: reachable,
      transitiveClosure: closure,
      cycles,
      criticalPath: critical,
      importanceScore: imp,
      coupling,
      cohesion,
      fanOut: edges.filter(e => e.from === module).length,
      fanIn: edges.filter(e => e.to === module).length,
    };
  }

  findCycles(): string[][] {
    return this.graphBuilder.findCycles();
  }

  getCriticalPath(): string[] {
    return this.graphBuilder.analyze("").criticalPath();
  }

  importanceScore(node: string): number {
    return this.graphBuilder.analyze("").importanceScore(node);
  }

  getStats(): GraphStats {
    const langSet = new Set<string>();
    for (const sym of this.symbols.values()) {
      langSet.add(String(sym.language));
    }
    return {
      fileCount: this.metadata.fileCount,
      symbolCount: this.metadata.symbolCount,
      depCount: this.metadata.dependencyCount,
      edgeCount: this.metadata.edgeCount,
      languages: Array.from(langSet).filter(Boolean),
      lastIndexed: this.metadata.lastUpdated,
      indexDuration: this.metadata.indexDuration,
    };
  }

  /* ── TF-IDF Retrieval ──────────────────────────────────────── */

  async retrieve(query: string, topK = 20): Promise<ScoredItem[]> {
    if (!this.loaded) return [];
    const graph = await buildGraph(this.rootDir);
    return rankFiles(query, graph.files, graph.symbols, topK);
  }

  /* ── Cleanup ────────────────────────────────────────────────── */

  clear(): void {
    this.symbols.clear();
    this.deps.clear();
    this.edges = [];
    this.graphBuilder.clear();
    this.metadata = {
      version: GRAPH_VERSION,
      root: this.rootDir,
      createdAt: 0,
      lastUpdated: 0,
      fileCount: 0,
      symbolCount: 0,
      dependencyCount: 0,
      edgeCount: 0,
      indexDuration: 0,
    };
  }

  destroy(): void {
    this.clear();
    this.loaded = false;
  }
}

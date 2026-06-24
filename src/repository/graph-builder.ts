import type { SymbolNode, DependencyNode, SymbolQuery, DependencyQuery, SymbolType, Language } from "./types.js";

export interface SymbolEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface DependencyAnalysis {
  reachableSymbols: (source: string) => string[];
  transitiveClosure: (sources: string[]) => string[];
  findCycles: () => string[][];
  criticalPath: () => string[];
  importanceScore: (node: string) => number;
  coupling: (module: string) => number;
  cohesion: (module: string) => number;
}

export class GraphBuilder {
  private symbols: Map<string, SymbolNode> = new Map();
  private dependencies: Map<string, DependencyNode> = new Map();
  private adjacency: Map<string, string[]> = new Map();
  private reverseAdjacency: Map<string, string[]> = new Map();

  constructor() {}

  addSymbol(symbol: SymbolNode): void {
    this.symbols.set(symbol.id, symbol);
    if (!this.adjacency.has(symbol.id)) {
      this.adjacency.set(symbol.id, []);
    }
    if (!this.reverseAdjacency.has(symbol.id)) {
      this.reverseAdjacency.set(symbol.id, []);
    }
  }

  addDependency(dependency: DependencyNode): void {
    this.dependencies.set(dependency.id, dependency);

    const sourceEdges = this.adjacency.get(dependency.source) ?? [];
    sourceEdges.push(dependency.target);
    this.adjacency.set(dependency.source, sourceEdges);

    const targetEdges = this.reverseAdjacency.get(dependency.target) ?? [];
    targetEdges.push(dependency.source);
    this.reverseAdjacency.set(dependency.target, targetEdges);
  }

  searchSymbols(query: SymbolQuery): SymbolNode[] {
    let results = Array.from(this.symbols.values());

    if (query.name) {
      const nameLower = query.name.toLowerCase();
      results = results.filter(s => s.name.toLowerCase().includes(nameLower) || s.qualifiedName.toLowerCase().includes(nameLower));
    }

    if (query.type) {
      results = results.filter(s => s.type === query.type);
    }

    if (query.language) {
      results = results.filter(s => s.language === query.language);
    }

    if (query.file) {
      results = results.filter(s => s.file.includes(query.file!));
    }

    if (query.exports !== undefined) {
      results = results.filter(s => s.exports === query.exports);
    }

    if (query.tags && query.tags.length > 0) {
      results = results.filter(s => query.tags!.some(t => s.tags.includes(t)));
    }

    if (query.modifiers && query.modifiers.length > 0) {
      results = results.filter(s => query.modifiers!.every(m => s.modifiers.includes(m)));
    }

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  findDependencies(query: DependencyQuery): DependencyNode[] {
    let results = Array.from(this.dependencies.values());

    if (query.source) {
      const sourceLower = query.source.toLowerCase();
      results = results.filter(d => d.source.toLowerCase().includes(sourceLower));
    }

    if (query.target) {
      const targetLower = query.target.toLowerCase();
      results = results.filter(d => d.target.toLowerCase().includes(targetLower));
    }

    if (query.type) {
      results = results.filter(d => d.type === query.type);
    }

    if (query.language) {
      results = results.filter(d => d.language === query.language);
    }

    if (query.strength) {
      results = results.filter(d => d.strength >= query.strength!.min && d.strength <= query.strength!.max);
    }

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  getReachableSymbols(source: string): string[] {
    const visited = new Set<string>();
    const queue = [source];
    const reachable: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      reachable.push(current);

      const edges = this.adjacency.get(current) ?? [];
      for (const edge of edges) {
        if (!visited.has(edge)) {
          queue.push(edge);
        }
      }
    }

    return reachable;
  }

  findCycles(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string) => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const edges = this.adjacency.get(node) ?? [];
      for (const edge of edges) {
        if (!visited.has(edge)) {
          dfs(edge);
        } else if (recStack.has(edge)) {
          const cycleStart = path.indexOf(edge);
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart));
          }
        }
      }

      path.pop();
      recStack.delete(node);
    };

    for (const node of this.symbols.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  analyze(module: string): DependencyAnalysis {
    return {
      reachableSymbols: (source: string) => this.getReachableSymbols(source),
      transitiveClosure: (sources: string[]) => {
        const closure = new Set<string>();
        for (const source of sources) {
          const reachable = this.getReachableSymbols(source);
          reachable.forEach(r => closure.add(r));
        }
        return Array.from(closure);
      },
      findCycles: () => this.findCycles(),
      criticalPath: () => this.getCriticalPath(),
      importanceScore: (node: string) => this.getImportanceScore(node),
      coupling: (module: string) => this.getCoupling(module),
      cohesion: (module: string) => this.getCohesion(module),
    };
  }

  private getCriticalPath(): string[] {
    const scores = new Map<string, number>();
    for (const node of this.symbols.keys()) {
      scores.set(node, this.getImportanceScore(node));
    }
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([node]) => node);
  }

  private getImportanceScore(node: string): number {
    const inDegree = (this.reverseAdjacency.get(node) ?? []).length;
    const outDegree = (this.adjacency.get(node) ?? []).length;
    return inDegree * 2 + outDegree;
  }

  private getCoupling(module: string): number {
    const outgoing = (this.adjacency.get(module) ?? []).length;
    const incoming = (this.reverseAdjacency.get(module) ?? []).length;
    return outgoing + incoming;
  }

  private getCohesion(module: string): number {
    const symbols = Array.from(this.symbols.values()).filter(s => s.file === module);
    if (symbols.length === 0) return 0;

    const internalRefs = symbols.filter(s => {
      const edges = this.adjacency.get(s.id) ?? [];
      return edges.some(e => e.startsWith(module));
    }).length;

    return internalRefs / symbols.length;
  }

  getSymbolCount(): number {
    return this.symbols.size;
  }

  getDependencyCount(): number {
    return this.dependencies.size;
  }

  clear(): void {
    this.symbols.clear();
    this.dependencies.clear();
    this.adjacency.clear();
    this.reverseAdjacency.clear();
  }
}
import { WorkspaceGraph } from "./workspace-graph.js";
import type { SymbolNode, DependencyNode } from "../repository/types.js";
import type { GraphEdge, Relationship } from "./types.js";

export interface SymbolRelationship {
  source: string;
  target: string;
  type: Relationship;
  weight: number;
  sourceSymbol: SymbolNode | undefined;
  targetSymbol: SymbolNode | undefined;
}

export class SymbolGraph {
  private graph: WorkspaceGraph;

  constructor(graph: WorkspaceGraph) {
    this.graph = graph;
  }

  /**
   * Get all relationships for a symbol (incoming + outgoing).
   */
  getRelationships(symbolId: string): SymbolRelationship[] {
    const result: SymbolRelationship[] = [];
    const symbol = this.graph.getSymbol(symbolId);
    if (!symbol) return [];

    for (const edge of this.getEdges()) {
      if (edge.from === symbolId || edge.to === symbolId) {
        const otherId = edge.from === symbolId ? edge.to : edge.from;
        result.push({
          source: edge.from,
          target: edge.to,
          type: edge.type,
          weight: edge.weight,
          sourceSymbol: this.graph.getSymbol(edge.from),
          targetSymbol: this.graph.getSymbol(edge.to),
        });
      }
    }
    return result;
  }

  /**
   * Get all outgoing edges from a symbol.
   */
  getOutgoingEdges(symbolId: string): GraphEdge[] {
    return this.getEdges().filter(e => e.from === symbolId);
  }

  /**
   * Get all incoming edges to a symbol.
   */
  getIncomingEdges(symbolId: string): GraphEdge[] {
    return this.getEdges().filter(e => e.to === symbolId);
  }

  /**
   * Get all symbols that depend on a given symbol.
   */
  getDependents(symbolId: string): SymbolNode[] {
    const dependents: SymbolNode[] = [];
    for (const sym of this.getAllSymbols()) {
      const deps = this.graph.findDependencies({ source: sym.name });
      for (const dep of deps) {
        if (dep.target === symbolId || dep.target.includes(symbolId)) {
          dependents.push(sym);
          break;
        }
      }
    }
    return dependents;
  }

  /**
   * Get all symbols that a given symbol depends on.
   */
  getDependencies(symbolId: string): SymbolNode[] {
    const result: SymbolNode[] = [];
    const edges = this.getOutgoingEdges(symbolId);
    for (const edge of edges) {
      const target = this.graph.getSymbol(edge.to);
      if (target) result.push(target);
    }
    return result;
  }

  /**
   * Find the shortest dependency path between two symbols.
   */
  findSymbolPath(fromSymbol: string, toSymbol: string): SymbolNode[] {
    const path = this.graph.findPath(fromSymbol, toSymbol);
    const result: SymbolNode[] = [];
    for (const id of path) {
      const node = this.graph.getSymbol(id);
      if (node) result.push(node);
    }
    return result;
  }

  /**
   * Get the most important symbols (highest in-degree / PageRank-like).
   */
  getImportantSymbols(limit = 10): SymbolNode[] {
    const scores = new Map<string, number>();
    for (const sym of this.getAllSymbols()) {
      const deps = this.getDependents(sym.id);
      scores.set(sym.id, deps.length);
    }
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => this.graph.getSymbol(id))
      .filter(Boolean) as SymbolNode[];
  }

  /**
   * Get symbols that reference a given file path.
   */
  getSymbolsReferencingFile(filePath: string): SymbolNode[] {
    return this.getAllSymbols().filter(s => {
      const deps = this.graph.findDependencies({ source: s.name, limit: 20 });
      return deps.some(d => d.target === filePath || d.source === filePath);
    });
  }

  /**
   * Get symbols defined in a given file.
   */
  getSymbolsInFile(filePath: string): SymbolNode[] {
    return this.graph.getFileSymbols(filePath);
  }

  /**
   * Count cross-file relationships.
   */
  getCrossFileRelationships(): number {
    return this.getEdges().filter(e => {
      const src = this.graph.getSymbol(e.from);
      const tgt = this.graph.getSymbol(e.to);
      return src && tgt && src.file !== tgt.file;
    }).length;
  }

  /**
   * Detect circular dependencies in the symbol graph.
   */
  detectCircularDependencies(): SymbolNode[][] {
    return this.graph.findCycles()
      .map(cycle => cycle.map(id => this.graph.getSymbol(id)).filter(Boolean) as SymbolNode[])
      .filter(c => c.length > 1);
  }

  private getAllSymbols(): SymbolNode[] {
    const result: SymbolNode[] = [];
    for (const sym of this.graph.searchSymbols({ limit: 100000 })) {
      result.push(sym);
    }
    return result;
  }

  private getEdges(): GraphEdge[] {
    return (this.graph as any).edges ?? [];
  }
}

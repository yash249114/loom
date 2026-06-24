import { GraphBuilder } from "./graph-builder.js";
import type { SymbolNode, DependencyNode, SymbolQuery, DependencyQuery } from "./types.js";

export interface Query {
  type: QueryType;
  filters?: QueryFilter[];
  conditions?: QueryCondition[];
  sort?: SortOption[];
  limit?: number;
  offset?: number;
}

export enum QueryType {
  SYMBOL_SEARCH = "symbol_search",
  FILE_SEARCH = "file_search",
  DEPENDENCY_QUERY = "dependency_query",
  PATH_FINDER = "path_finder",
  ANALYSIS_QUERY = "analysis_query",
  CONTEXT_BUILDER = "context_builder",
}

export interface QueryFilter {
  field: string;
  operator: string;
  value: unknown;
}

export interface QueryCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface SortOption {
  field: string;
  direction: "asc" | "desc";
}

export class Retriever {
  private graphBuilder: GraphBuilder;

  constructor(graphBuilder: GraphBuilder) {
    this.graphBuilder = graphBuilder;
  }

  async execute(query: Query): Promise<unknown> {
    switch (query.type) {
      case QueryType.SYMBOL_SEARCH:
        return this.executeSymbolSearch(query);
      case QueryType.FILE_SEARCH:
        return this.executeFileSearch(query);
      case QueryType.DEPENDENCY_QUERY:
        return this.executeDependencyQuery(query);
      case QueryType.PATH_FINDER:
        return this.executePathFinder(query);
      case QueryType.ANALYSIS_QUERY:
        return this.executeAnalysisQuery(query);
      case QueryType.CONTEXT_BUILDER:
        return this.executeContextBuilder(query);
      default:
        return [];
    }
  }

  private async executeSymbolSearch(query: Query): Promise<SymbolNode[]> {
    const symbolQuery: SymbolQuery = {};

    if (query.filters) {
      for (const filter of query.filters) {
        switch (filter.field) {
          case "name":
            symbolQuery.name = filter.value as string;
            break;
          case "type":
            symbolQuery.type = filter.value as import("./types.js").SymbolType;
            break;
          case "language":
            symbolQuery.language = filter.value as import("./types.js").Language;
            break;
          case "file":
            symbolQuery.file = filter.value as string;
            break;
        }
      }
    }

    if (query.limit) {
      symbolQuery.limit = query.limit;
    }

    return this.graphBuilder.searchSymbols(symbolQuery);
  }

  private async executeFileSearch(query: Query): Promise<SymbolNode[]> {
    const symbolQuery: SymbolQuery = {};

    if (query.filters) {
      for (const filter of query.filters) {
        if (filter.field === "file") {
          symbolQuery.file = filter.value as string;
        }
      }
    }

    if (query.limit) {
      symbolQuery.limit = query.limit;
    }

    return this.graphBuilder.searchSymbols(symbolQuery);
  }

  private async executeDependencyQuery(query: Query): Promise<DependencyNode[]> {
    const dependencyQuery: DependencyQuery = {};

    if (query.filters) {
      for (const filter of query.filters) {
        switch (filter.field) {
          case "source":
            dependencyQuery.source = filter.value as string;
            break;
          case "target":
            dependencyQuery.target = filter.value as string;
            break;
          case "type":
            dependencyQuery.type = filter.value as import("./types.js").DependencyType;
            break;
        }
      }
    }

    if (query.limit) {
      dependencyQuery.limit = query.limit;
    }

    return this.graphBuilder.findDependencies(dependencyQuery);
  }

  private async executePathFinder(query: Query): Promise<string[]> {
    if (!query.filters || query.filters.length < 2) {
      return [];
    }

    const sourceFilter = query.filters.find(f => f.field === "source");
    const targetFilter = query.filters.find(f => f.field === "target");

    if (!sourceFilter || !targetFilter) {
      return [];
    }

    const source = sourceFilter.value as string;
    const target = targetFilter.value as string;

    const path = this.findPath(source, target);
    return path;
  }

  private findPath(source: string, target: string): string[] {
    const visited = new Set<string>();
    const queue: Array<{ node: string; path: string[] }> = [{ node: source, path: [source] }];

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;

      if (current.node === target) {
        return current.path;
      }

      if (visited.has(current.node)) continue;
      visited.add(current.node);

      const edges = this.graphBuilder["adjacency"].get(current.node) ?? [];
      for (const edge of edges) {
        if (!visited.has(edge)) {
          queue.push({ node: edge, path: [...current.path, edge] });
        }
      }
    }

    return [];
  }

  private async executeAnalysisQuery(query: Query): Promise<unknown> {
    if (!query.filters || query.filters.length === 0) {
      return {};
    }

    const moduleFilter = query.filters.find(f => f.field === "module");
    if (!moduleFilter) {
      return {};
    }

    const module = moduleFilter.value as string;
    const analysis = this.graphBuilder.analyze(module);

    return {
      module,
      reachableSymbols: analysis.reachableSymbols(module),
      cycles: analysis.findCycles(),
      criticalPath: analysis.criticalPath(),
      importanceScore: analysis.importanceScore(module),
      coupling: analysis.coupling(module),
      cohesion: analysis.cohesion(module),
    };
  }

  private async executeContextBuilder(query: Query): Promise<unknown[]> {
    const symbols = await this.executeSymbolSearch(query);
    const dependencies = await this.executeDependencyQuery(query);

    const contextParts: string[] = [];

    if (symbols.length > 0) {
      contextParts.push("### Symbols\n" + symbols.map(s => `- ${s.name} (${s.type}): ${s.file}:${s.line}`).join("\n"));
    }

    if (dependencies.length > 0) {
      contextParts.push("### Dependencies\n" + dependencies.map(d => `- ${d.source} → ${d.target} (${d.type})`).join("\n"));
    }

    return [contextParts.join("\n\n") || "No context available."];
  }
}
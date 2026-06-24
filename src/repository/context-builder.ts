import { TokenBudgetManager } from "./token-budget-manager.js";
import { Retriever, QueryType } from "./retriever.js";
import { GraphBuilder } from "./graph-builder.js";
import type { ContextRequest, Priority, SymbolNode, DependencyNode } from "./types.js";

export interface ContextOptimizer {
  optimizeContext: (context: string, maxTokens: number) => string;
  compressContext: (context: string, targetTokens: number) => string;
  prioritizeContext: (context: string, priority: Priority[]) => string;
}

export class ContextBuilder {
  private retriever: Retriever;
  private tokenBudgetManager: TokenBudgetManager;

  constructor(graphBuilder: GraphBuilder, tokenBudgetManager: TokenBudgetManager) {
    this.retriever = new Retriever(graphBuilder);
    this.tokenBudgetManager = tokenBudgetManager;
  }

  async buildContext(request: ContextRequest): Promise<string> {
    const contextParts: string[] = [];

    const symbolQuery = {
      type: QueryType.SYMBOL_SEARCH,
      filters: [{ field: "name", operator: "contains", value: request.query }],
      limit: 50,
    };

    const symbols = await this.retriever.execute(symbolQuery) as SymbolNode[];
    if (symbols.length > 0) {
      contextParts.push(this.formatSymbols(symbols));
    }

    if (request.includeDependencies) {
      const depQuery = {
        type: QueryType.DEPENDENCY_QUERY,
        filters: [{ field: "source", operator: "contains", value: request.query }],
        limit: 20,
      };

      const dependencies = await this.retriever.execute(depQuery) as DependencyNode[];
      if (dependencies.length > 0) {
        contextParts.push(this.formatDependencies(dependencies));
      }
    }

    let context = contextParts.join("\n\n") || "No repository context available for this query.";

    if (request.priority && request.priority.length > 0) {
      context = this.prioritizeContext(context, request.priority);
    }

    context = this.tokenBudgetManager.optimizeContext(context);

    return context;
  }

  private formatSymbols(symbols: SymbolNode[]): string {
    const lines = ["### Relevant Symbols", ""];

    for (const symbol of symbols.slice(0, 20)) {
      lines.push(`- **${symbol.name}** (${symbol.type})`);
      lines.push(`  File: ${symbol.file}:${symbol.line}`);
      if (symbol.signature) {
        lines.push(`  Signature: \`${symbol.signature}\``);
      }
      if (symbol.doc) {
        lines.push(`  Doc: ${symbol.doc}`);
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  private formatDependencies(dependencies: DependencyNode[]): string {
    const lines = ["### Dependencies", ""];

    for (const dep of dependencies.slice(0, 10)) {
      lines.push(`- ${dep.source} → ${dep.target} (${dep.type})`);
    }

    return lines.join("\n");
  }

  private prioritizeContext(context: string, priorities: Priority[]): string {
    const lines = context.split("\n");
    const priorityMap = new Map<string, number>();

    for (const priority of priorities) {
      priorityMap.set(priority.field, priority.weight);
    }

    const scoredLines = lines.map(line => {
      let score = 0;
      for (const [field, weight] of priorityMap) {
        if (line.toLowerCase().includes(field.toLowerCase())) {
          score += weight;
        }
      }
      return { line, score };
    });

    scoredLines.sort((a, b) => b.score - a.score);
    return scoredLines.map(s => s.line).join("\n");
  }

  estimateTokenUsage(context: string): number {
    return this.tokenBudgetManager.estimateTokens(context);
  }
}
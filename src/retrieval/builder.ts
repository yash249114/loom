import type { ScoredItem, ContextPackage, RepoFile, Symbol, Dependency } from "./types.js";

const TOKEN_RATIO = 0.25; // ~4 chars per token
const SYMBOL_OVERHEAD = 4;
const DEP_OVERHEAD = 2;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length * TOKEN_RATIO);
}

export interface BuildOptions {
  maxTokens: number;
  includeSymbols: boolean;
  includeDependencies: boolean;
  symbolHeader: string;
  depHeader: string;
  fileHeader: (file: RepoFile) => string;
}

const DEFAULT_OPTIONS: BuildOptions = {
  maxTokens: 32000,
  includeSymbols: true,
  includeDependencies: true,
  symbolHeader: "## Relevant Symbols",
  depHeader: "## Relevant Dependencies",
  fileHeader: (file) => `--- ${file.path} ---`,
};

export function buildContext(
  scored: ScoredItem[],
  options: Partial<BuildOptions> = {}
): ContextPackage {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const selectedFiles: RepoFile[] = [];
  const selectedSymbols: Symbol[] = [];
  const selectedDeps: Dependency[] = [];
  const symbolSeen = new Set<string>();
  const depSeen = new Set<string>();

  let budget = opts.maxTokens;

  const renderFile = (file: RepoFile): string => {
    return `${opts.fileHeader(file)}\n${file.content}\n`;
  };

  const renderSymbols = (symbols: Symbol[]): string => {
    if (!symbols.length) return "";
    const grouped = new Map<string, Symbol[]>();
    for (const s of symbols) {
      const list = grouped.get(s.file) || [];
      list.push(s);
      grouped.set(s.file, list);
    }
    const lines: string[] = [opts.symbolHeader];
    for (const [file, syms] of grouped) {
      for (const s of syms) {
        lines.push(`  ${s.kind} ${s.name} @ ${file}:${s.line}`);
      }
    }
    return lines.join("\n") + "\n";
  };

  const renderDeps = (deps: Dependency[]): string => {
    if (!deps.length) return "";
    const grouped = new Map<string, Dependency[]>();
    for (const d of deps) {
      const list = grouped.get(d.source) || [];
      list.push(d);
      grouped.set(d.source, list);
    }
    const lines: string[] = [opts.depHeader];
    for (const [file, ds] of grouped) {
      for (const d of ds) {
        const names = d.names.length ? ` {${d.names.join(", ")}}` : "";
        lines.push(`  ${d.type} ${d.target}${names} @ ${file}`);
      }
    }
    return lines.join("\n") + "\n";
  };

  for (const item of scored) {
    const fileCost = estimateTokens(renderFile(item.file));
    let symCost = 0;
    let depCost = 0;

    if (opts.includeSymbols && item.matchedSymbols.length > 0) {
      const newSyms = item.matchedSymbols.filter((s) => !symbolSeen.has(s.name + s.file));
      symCost = newSyms.length * SYMBOL_OVERHEAD;
    }

    if (opts.includeDependencies && item.matchedDeps.length > 0) {
      const newDeps = item.matchedDeps.filter((d) => !depSeen.has(d.target + d.source));
      depCost = newDeps.length * DEP_OVERHEAD;
    }

    const totalCost = fileCost + symCost + depCost;
    if (totalCost > budget) continue;

    selectedFiles.push(item.file);
    budget -= fileCost;

    if (opts.includeSymbols) {
      for (const s of item.matchedSymbols) {
        const key = s.name + s.file;
        if (!symbolSeen.has(key)) {
          symbolSeen.add(key);
          selectedSymbols.push(s);
        }
      }
    }

    if (opts.includeDependencies) {
      for (const d of item.matchedDeps) {
        const key = d.target + d.source;
        if (!depSeen.has(key)) {
          depSeen.add(key);
          selectedDeps.push(d);
        }
      }
    }
  }

  const context = renderContext(selectedFiles, selectedSymbols, selectedDeps, opts);
  const totalTokens = estimateTokens(context);
  const originalTokens = scored.reduce(
    (sum, s) => sum + estimateTokens(s.file.content),
    0
  );

  return {
    files: selectedFiles,
    symbols: selectedSymbols,
    dependencies: selectedDeps,
    totalTokens,
    originalTokens,
    compressionRatio: originalTokens > 0
      ? Number((1 - totalTokens / originalTokens).toFixed(4))
      : 0,
  };
}

function renderContext(
  files: RepoFile[],
  symbols: Symbol[],
  deps: Dependency[],
  opts: BuildOptions
): string {
  const parts: string[] = [];

  if (symbols.length > 0) {
    const grouped = new Map<string, Symbol[]>();
    for (const s of symbols) {
      const list = grouped.get(s.file) || [];
      list.push(s);
      grouped.set(s.file, list);
    }
    const symLines: string[] = [opts.symbolHeader];
    for (const [file, syms] of grouped) {
      for (const s of syms) {
        symLines.push(`  ${s.kind} ${s.name} @ ${file}:${s.line}`);
      }
    }
    parts.push(symLines.join("\n"));
  }

  if (deps.length > 0) {
    const grouped = new Map<string, Dependency[]>();
    for (const d of deps) {
      const list = grouped.get(d.source) || [];
      list.push(d);
      grouped.set(d.source, list);
    }
    const depLines: string[] = [opts.depHeader];
    for (const [file, ds] of grouped) {
      for (const d of ds) {
        const names = d.names.length ? ` {${d.names.join(", ")}}` : "";
        depLines.push(`  ${d.type} ${d.target}${names} @ ${file}`);
      }
    }
    parts.push(depLines.join("\n"));
  }

  for (const file of files) {
    parts.push(opts.fileHeader(file));
    parts.push(file.content);
  }

  return parts.join("\n\n");
}

export function formatContextPackage(pkg: ContextPackage): string {
  const lines: string[] = [
    `Context Package`,
    `  Files: ${pkg.files.length}`,
    `  Symbols: ${pkg.symbols.length}`,
    `  Dependencies: ${pkg.dependencies.length}`,
    `  Total tokens: ${pkg.totalTokens}`,
    `  Original tokens: ${pkg.originalTokens}`,
    `  Compression ratio: ${(pkg.compressionRatio * 100).toFixed(1)}%`,
  ];
  return lines.join("\n");
}

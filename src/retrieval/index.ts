export { buildGraph, resolveLocalDependency } from "./graph.js";
export { rankFiles, tokenize } from "./retriever.js";
export { buildContext, estimateTokens, formatContextPackage } from "./builder.js";
export { compressContent, compressFile, compressPackage } from "./compressor.js";
export type {
  RepoFile,
  Symbol,
  SymbolKind,
  Dependency,
  ScoredItem,
  RetrievalQuery,
  ContextPackage,
  RepositoryGraph,
} from "./types.js";
export { compressPackage as compressContext, estimateTokens as countTokens } from "./compressor.js";

import { buildGraph } from "./graph.js";
import { rankFiles } from "./retriever.js";
import { buildContext } from "./builder.js";
import { compressPackage } from "./compressor.js";
import type { RetrievalQuery, ContextPackage } from "./types.js";

/**
 * Full retrieval pipeline:
 *
 *   User Query
 *       ↓
 *   Repository Graph   ← buildGraph(rootDir)
 *       ↓
 *   Retriever           ← rankFiles(query, graph, topK)
 *       ↓
 *   Context Builder     ← buildContext(scored, maxTokens)
 *       ↓
 *   Compressor          ← compressPackage(pkg)
 *       ↓
 *   Context Package
 */
export async function retrieve(
  rootDir: string,
  query: RetrievalQuery
): Promise<ContextPackage> {
  const graph = await buildGraph(rootDir);

  const scored = rankFiles(
    query.text,
    graph.files,
    graph.symbols,
    query.topK,
    query.includeSymbols,
    query.includeDependencies
  );

  const pkg = buildContext(scored, {
    maxTokens: query.maxTokens,
    includeSymbols: query.includeSymbols,
    includeDependencies: query.includeDependencies,
  });

  return compressPackage(pkg, {
    stripComments: true,
    stripBlankLines: true,
    stripEmptyImports: true,
  });
}

export async function retrieveStream(
  rootDir: string,
  query: RetrievalQuery,
  onProgress?: (phase: string, detail: string) => void
): Promise<ContextPackage> {
  onProgress?.("graph", "Building repository graph...");
  const graph = await buildGraph(rootDir);
  onProgress?.("graph", `Indexed ${graph.files.size} files`);

  onProgress?.("retrieve", "Ranking files by relevance...");
  const scored = rankFiles(
    query.text,
    graph.files,
    graph.symbols,
    query.topK,
    query.includeSymbols,
    query.includeDependencies
  );
  onProgress?.("retrieve", `Top ${scored.length} results`);

  onProgress?.("build", "Assembling context within token budget...");
  const pkg = buildContext(scored, {
    maxTokens: query.maxTokens,
    includeSymbols: query.includeSymbols,
    includeDependencies: query.includeDependencies,
  });
  onProgress?.("build", `${pkg.files.length} files, ~${pkg.totalTokens} tokens`);

  onProgress?.("compress", "Compressing context...");
  const compressed = compressPackage(pkg, {
    stripComments: true,
    stripBlankLines: true,
    stripEmptyImports: true,
  });
  onProgress?.("compress", `${(compressed.compressionRatio * 100).toFixed(1)}% compression`);

  return compressed;
}

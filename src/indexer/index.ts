export { Indexer } from "./indexer.js";
export { registerIndexCommand } from "./cli.js";
export { detectLanguage, getScanPatterns, isSupported } from "./language.js";
export { parseFile } from "./parse.js";
export type {
  Language,
  SymbolKind,
  IndexSymbol,
  DepType,
  FileDependency,
  IndexedFile,
  IndexOutput,
  IndexCache,
  IndexOptions,
  ParseResult,
} from "./types.js";

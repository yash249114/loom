export type Language = "typescript" | "javascript" | "python" | "go" | "unknown";

export type SymbolKind =
  | "function"
  | "method"
  | "class"
  | "interface"
  | "type"
  | "enum"
  | "variable"
  | "constant";

export interface IndexSymbol {
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  column: number;
  parent?: string;
  visibility?: "public" | "private" | "exported" | "default";
}

export type DepType = "import" | "require" | "dynamic-import" | "type-import";

export interface FileDependency {
  source: string;
  target: string;
  type: DepType;
  symbols?: string[];
}

export interface IndexedFile {
  path: string;
  language: Language;
  size: number;
  mtimeMs: number;
  symbols: IndexSymbol[];
  dependencies: FileDependency[];
}

export interface IndexOutput {
  version: string;
  generatedAt: string;
  files: IndexedFile[];
  symbols: IndexSymbol[];
  dependencies: FileDependency[];
}

export interface IndexCache {
  version: string;
  generatedAt: string;
  files: Record<string, { mtimeMs: number; size: number }>;
}

export interface IndexOptions {
  rootDir: string;
  force?: boolean;
  outputDir?: string;
  verbose?: boolean;
}

export interface ParseResult {
  symbols: IndexSymbol[];
  dependencies: FileDependency[];
}

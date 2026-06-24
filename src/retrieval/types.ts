export interface RepoFile {
  path: string;
  size: number;
  language: string;
  content: string;
  symbols: Symbol[];
  dependencies: Dependency[];
}

export interface Symbol {
  name: string;
  kind: SymbolKind;
  file: string;
  line: number;
  doc?: string;
}

export type SymbolKind =
  | "class"
  | "function"
  | "method"
  | "variable"
  | "type"
  | "interface"
  | "enum"
  | "component";

export interface Dependency {
  source: string;
  target: string;
  type: "import" | "require" | "dynamic";
  names: string[];
}

export interface ScoredItem {
  file: RepoFile;
  score: number;
  matchedSymbols: Symbol[];
  matchedDeps: Dependency[];
}

export interface RetrievalQuery {
  text: string;
  topK: number;
  maxTokens: number;
  includeDependencies: boolean;
  includeSymbols: boolean;
}

export interface ContextPackage {
  files: RepoFile[];
  symbols: Symbol[];
  dependencies: Dependency[];
  totalTokens: number;
  originalTokens: number;
  compressionRatio: number;
}

export interface RepositoryGraph {
  files: Map<string, RepoFile>;
  symbols: Map<string, Symbol[]>;
  dependencyIndex: Map<string, string[]>;
  reverseDeps: Map<string, string[]>;
}

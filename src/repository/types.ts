export enum Language {
  JAVASCRIPT = "javascript",
  TYPESCRIPT = "typescript",
  PYTHON = "python",
  GO = "go",
  RUST = "rust",
  JAVA = "java",
  CPP = "cpp",
  CSHARP = "csharp",
  RUBY = "ruby",
  PHP = "php",
  SWIFT = "swift",
  KOTLIN = "kotlin",
  UNKNOWN = "unknown",
}

export interface SymbolNode {
  id: string;
  name: string;
  type: SymbolType;
  qualifiedName: string;
  file: string;
  line: number;
  column: number;
  signature: string;
  doc: string;
  modifiers: string[];
  tags: string[];
  exports: boolean;
  imports: string[];
  language: Language;
  metadata: Record<string, unknown>;
}

export enum SymbolType {
  CLASS = "class",
  FUNCTION = "function",
  METHOD = "method",
  CONSTRUCTOR = "constructor",
  VARIABLE = "variable",
  CONSTANT = "constant",
  INTERFACE = "interface",
  TYPE_ALIAS = "type_alias",
  ENUM = "enum",
  ENUM_MEMBER = "enum_member",
  NAMESPACE = "namespace",
  MODULE = "module",
  TRAIT = "trait",
  STRUCT = "struct",
  UNION = "union",
  GENERIC = "generic",
  OVERLOAD = "overload",
  ANONYMOUS = "anonymous",
}

export interface DependencyNode {
  id: string;
  source: string;
  target: string;
  type: DependencyType;
  strength: number;
  metadata: Record<string, unknown>;
  language: Language;
}

export enum DependencyType {
  IMPORT = "import",
  EXPORT = "export",
  REEXPORT = "reexport",
  DYNAMIC_IMPORT = "dynamic_import",
  REQUIRE = "require",
  IMPORT_TYPE = "import_type",
  EXPORT_TYPE = "export_type",
  EXTENDS = "extends",
  IMPLEMENTS = "implements",
  MIXIN = "mixin",
  COMPOSES = "composes",
  CALLS = "calls",
  RETURNS = "returns",
  USES = "uses",
}

export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  language: Language;
  size: number;
  lineCount: number;
  symbolCount: number;
  dependencyCount: number;
  lastModified: number;
  isTest: boolean;
  isConfig: boolean;
  isDocumentation: boolean;
  isBuildArtifact: boolean;
  contentHash: string;
  astHash: string;
}

export interface RepositoryIndex {
  version: string;
  root: string;
  createdAt: number;
  lastUpdated: number;
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  lineCount: number;
  
  files: FileInfo[];
  symbols: SymbolNode[];
  dependencies: DependencyNode[];
}

export interface IndexStatus {
  isComplete: boolean;
  lastUpdated: number;
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  progress: number;
  estimatedTimeRemaining: number;
}

export interface SymbolQuery {
  name?: string;
  type?: SymbolType;
  language?: Language;
  file?: string;
  qualifiedName?: string;
  tags?: string[];
  modifiers?: string[];
  exports?: boolean;
  imports?: string[];
  lineRange?: { start: number; end: number };
  limit?: number;
  offset?: number;
}

export interface DependencyQuery {
  source?: string;
  target?: string;
  type?: DependencyType;
  language?: Language;
  strength?: { min: number; max: number };
  limit?: number;
  offset?: number;
}

export interface ContextRequest {
  query: string;
  workspace: string;
  maxTokens: number;
  includeDependencies: boolean;
  includeExamples: boolean;
  priority?: Priority[];
  sessionId?: string;
}

export interface Priority {
  field: string;
  weight: number;
  type: PriorityType;
}

export enum PriorityType {
  RELEVANCE = "relevance",
  COMPLETENESS = "completeness",
  FRESHNESS = "freshness",
  IMPORTANCE = "importance",
}

export interface TokenUsage {
  total: number;
  context: number;
  symbols: number;
  dependencies: number;
  compression: number;
  timestamp: number;
}

export interface BudgetStatus {
  totalBudget: number;
  used: number;
  remaining: number;
  isExhausted: boolean;
  warnings: string[];
}

export interface RepositorySize {
  fileCount: number;
  lineCount: number;
  symbolCount: number;
  dependencyCount: number;
}
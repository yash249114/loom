import type { SymbolNode, DependencyNode, FileInfo, SymbolQuery, DependencyQuery } from "../repository/types.js";
import type { ScoredItem } from "../retrieval/types.js";
import type { IndexOutput, IndexSymbol, FileDependency } from "../indexer/types.js";

export {
  SymbolNode, DependencyNode, FileInfo,
  SymbolQuery, DependencyQuery,
  ScoredItem,
  IndexOutput, IndexSymbol, FileDependency,
};

export type MemoryComponent =
  | "workspace-graph"
  | "project-memory"
  | "arch-knowledge"
  | "symbol-graph"
  | "context-engine";

export interface MemoryConfig {
  rootDir: string;
  enabled: MemoryComponent[];
  maxMemoryTokens: number;
  maxArchTokens: number;
  maxContextTokens: number;
  graphAutoIndex: boolean;
  knowledgeExtraction: boolean;
}

export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  rootDir: "",
  enabled: ["workspace-graph", "project-memory", "arch-knowledge", "symbol-graph", "context-engine"],
  maxMemoryTokens: 4000,
  maxArchTokens: 2000,
  maxContextTokens: 32000,
  graphAutoIndex: true,
  knowledgeExtraction: true,
};

export interface IndexResult {
  fileCount: number;
  symbolCount: number;
  depCount: number;
  edgeCount: number;
  durationMs: number;
  isIncremental: boolean;
  errors: string[];
}

export interface GraphStats {
  fileCount: number;
  symbolCount: number;
  depCount: number;
  edgeCount: number;
  languages: string[];
  lastIndexed: number;
  indexDuration: number;
}

export interface GraphAnalysis {
  module: string;
  reachableSymbols: string[];
  transitiveClosure: string[];
  cycles: string[][];
  criticalPath: string[];
  importanceScore: number;
  coupling: number;
  cohesion: number;
  fanOut: number;
  fanIn: number;
}

export type Relationship =
  | "IMPORTS"
  | "EXPORTS"
  | "DEFINES"
  | "CALLS"
  | "EXTENDS"
  | "IMPLEMENTS"
  | "COMPOSES"
  | "REFERENCES";

export interface GraphEdge {
  from: string;
  to: string;
  type: Relationship;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface Observation {
  id: string;
  type: "decision" | "pattern" | "relationship" | "convention" | "fact";
  content: string;
  confidence: number;
  importance: number;
  files: string[];
  symbols: string[];
  timestamp: number;
  sessionId: string;
  tags: string[];
}

export interface ADR {
  id: string;
  title: string;
  status: "proposed" | "accepted" | "deprecated" | "superseded";
  context: string;
  decision: string;
  consequences: string[];
  rationale: string;
  reasoning: string;
  files: string[];
  symbols: string[];
  tags: string[];
  timestamp: number;
  createdAt: number;
  updatedAt: number;
  supersededBy?: string;
}

export interface ArchPattern {
  id: string;
  name: string;
  description: string;
  category: "layering" | "data-flow" | "module-structure" | "dependency" | "convention";
  files: string[];
  confidence: number;
  firstObserved: number;
  lastObserved: number;
  occurrenceCount: number;
  evidence: { files: string[]; symbols: string[] };
}

export interface PatternResult {
  pattern: ArchPattern;
  confidence: number;
  evidence: string[];
}

export interface ScoringConfig {
  relevanceWeight: number;
  freshnessWeight: number;
  importanceWeight: number;
  halflifeDays: number;
  recencyBoost: number;
}

export interface ContextPackage {
  id: string;
  type: string;
  priority: number;
  content: string;
  tokens: number;
  source: string;
}

export interface KnowledgeQuery {
  text: string;
  types?: Observation["type"][];
  files?: string[];
  symbols?: string[];
  limit?: number;
  minConfidence?: number;
  minImportance?: number;
}

export interface KnowledgeEntry {
  observation: Observation;
  adrs: ADR[];
  patterns: ArchPattern[];
}

export interface ContextRequest {
  query: string;
  workspace: string;
  taskCategory?: string;
  maxTokens: number;
  includeMemory?: boolean;
  includeArch?: boolean;
  includeSymbols?: boolean;
  includeFiles?: boolean;
  includeDeps?: boolean;
  includeTools?: boolean;
  includeHistory?: boolean;
  sessionId?: string;
  recentFiles?: string[];
  files?: string[];
  symbols?: string[];
  instructions?: string;
  focusArea?: string;
  budget?: Partial<ContextBudget>;
}

export interface ContextBudget {
  total: number;
  used: number;
  system: number;
  identity: number;
  memory: number;
  arch: number;
  symbols: number;
  files: number;
  deps: number;
  tools: number;
  history: number;
}

export interface EnrichedContext {
  systemPrompt: string;
  identity: string;
  memoryEntries: string;
  archEntries: string;
  symbolEntries: string;
  fileEntries: string;
  depEntries: string;
  toolEntries: string;
  historyEntries: string;
  budget: ContextBudget;
  stats: {
    filesUsed: number;
    symbolsUsed: number;
    memoryUsed: number;
    archUsed: number;
    compressionRatio: number;
  };
  packages: ContextPackage[];
  architecture: string;
  summary: string;
  graph: {
    nodes: number;
    edges: number;
    files: number;
  };
  metadata: {
    query?: string;
    fileCount: number;
    symbolCount: number;
    packageCount: number;
    timestamp: number;
  };
}

export function computeBudget(maxTokens: number, contextLength?: number): ContextBudget {
  const effective = contextLength ? Math.min(maxTokens, contextLength) : maxTokens;
  return {
    total: effective,
    used: 0,
    system: Math.min(1000, Math.floor(effective * 0.03)),
    identity: Math.min(500, Math.floor(effective * 0.01)),
    memory: Math.min(4000, Math.floor(effective * 0.15)),
    arch: Math.min(2000, Math.floor(effective * 0.05)),
    symbols: Math.min(3000, Math.floor(effective * 0.10)),
    files: Math.min(8000, Math.floor(effective * 0.20)),
    deps: Math.min(2000, Math.floor(effective * 0.05)),
    tools: Math.min(2000, Math.floor(effective * 0.10)),
    history: Math.max(2000, effective - Math.floor(effective * 0.69)),
  };
}

# Graph Engine

**Date:** 2026-06-22  
**Engineer:** Loom Graph Intelligence Team  
**Version:** 0.1.0  

---

## Executive Summary

The Graph Engine is the core component of Loom's repository intelligence system. It constructs and manages symbol and dependency graphs that represent the structure and relationships within code repositories. The engine provides efficient storage, querying, and analysis of code relationships while maintaining memory efficiency for repositories with 1k to 100k+ files.

**Key Features:**
- **Memory-Efficient Storage:** Uses adjacency lists and compressed representations
- **Streaming Queries:** Returns results incrementally for large datasets
- **Advanced Algorithms:** Implements graph algorithms for code analysis
- **Incremental Updates:** Efficiently updates graphs when repositories change
- **Multi-Language Support:** Handles various programming language syntaxes

---

## 1. Architecture Overview

### 1.1 Core Components

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Symbol    │    │ Dependency  │    │   File      │
│   Store     │───▶│   Store     │───▶│   Index     │
└─────────────┘    └─────────────┘    └─────────────┘
         │                   │                   │
         └─────────────────┼───────────────────┘
                           ▼
                    ┌─────────────┐
                    │   Graph     │
                    │   Builder   │
                    └─────────────┘
                           ▼
                    ┌─────────────┐
                    │   Query     │
                    │   Engine    │
                    └─────────────┘
```

### 1.2 Data Flow

1. **Data Collection:** Symbol and dependency data is collected from the Indexer
2. **Graph Construction:** Data is transformed into graph structures
3. **Graph Optimization:** Graphs are optimized for query performance
4. **Query Processing:** Queries are processed against the optimized graphs
5. **Result Streaming:** Results are returned incrementally

---

## 2. Symbol Store

### 2.1 Symbol Representation

```typescript
export interface Symbol {
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
  
  // Language-specific data
  language: Language;
  metadata: Record<string, unknown>;
}
```

### 2.2 Symbol Types

```typescript
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
```

### 2.3 Storage Optimization

- **Compressed Storage:** Symbols are stored in compressed format
- **Columnar Storage:** Similar fields are stored in separate arrays
- **Dictionary Encoding:** Common values are encoded as integers
- **Delta Encoding:** Line numbers and positions use delta encoding

```typescript
export interface SymbolStore {
  // Columnar storage
  ids: Uint32Array;
  names: StringArray;
  types: Uint8Array; // SymbolType enum
  qualifiedNames: StringArray;
  files: StringArray;
  lines: Uint32Array;
  columns: Uint32Array;
  
  // Additional metadata
  signatures: StringArray;
  docs: StringArray;
  modifiers: StringArray;
  tags: StringArray;
  exports: BitArray;
  
  // Indexes
  nameIndex: Map<string, number[]>;
  fileIndex: Map<string, number[]>;
  typeIndex: Map<SymbolType, number[]>;
}
```

---

## 3. Dependency Store

### 3.1 Dependency Representation

```typescript
export interface Dependency {
  id: string;
  source: string;
  target: string;
  type: DependencyType;
  strength: number;
  metadata: Record<string, unknown>;
  
  // Language-specific data
  language: Language;
}
```

### 3.2 Dependency Types

```typescript
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
```

### 3.3 Graph Algorithms

- **Reachability Analysis:** Find all symbols reachable from a starting point
- **Transitive Closure:** Compute all indirect dependencies
- **Cycle Detection:** Identify circular dependencies
- **Critical Path:** Find most important dependencies
- **Coupling Analysis:** Measure module coupling
- **Cohesion Analysis:** Measure module cohesion

```typescript
export interface DependencyAnalysis {
  // Reachability
  reachableSymbols(source: string): string[];
  transitiveClosure(sources: string[]): string[];
  
  // Cycles
  findCycles(): string[][];
  isCyclic(module: string): boolean;
  
  // Critical path
  criticalPath(): string[];
  importanceScore(node: string): number;
  
  // Coupling/cohesion
  coupling(module: string): number;
  cohesion(module: string): number;
}
```

---

## 4. File Index

### 4.1 File Metadata

```typescript
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
  
  // Structural info
  isTest: boolean;
  isConfig: boolean;
  isDocumentation: boolean;
  isBuildArtifact: boolean;
  
  // Content hash
  contentHash: string;
  astHash: string;
}
```

### 4.2 Index Structure

```typescript
export interface FileIndex {
  // Primary lookup
  byPath: Map<string, FileInfo>;
  byName: Map<string, FileInfo[]>;
  byExtension: Map<string, FileInfo[]>;
  byLanguage: Map<Language, FileInfo[]>;
  
  // Secondary indexes
  byTest: FileInfo[];
  byConfig: FileInfo[];
  byDocumentation: FileInfo[];
  
  // Search indexes
  fullText: InvertedIndex;
  symbolPresence: SymbolPresenceIndex;
}
```

---

## 5. Graph Builder

### 5.1 Construction Pipeline

```typescript
export class GraphBuilder {
  constructor(
    symbolStore: SymbolStore,
    dependencyStore: DependencyStore,
    fileIndex: FileIndex
  );
  
  // Construction methods
  buildFromIndex(index: RepositoryIndex): void;
  updateIncremental(changes: ChangeSet): void;
  optimize(): void;
  
  // Query methods
  findSymbols(query: SymbolQuery): Symbol[];
  findDependencies(query: DependencyQuery): Dependency[];
  findPaths(source: string, target: string): Dependency[];
  analyze(module: string): ModuleAnalysis;
}
```

### 5.2 Construction Algorithms

- **Topological Sort:** Order modules by dependencies
- **Strongly Connected Components:** Identify circular dependencies
- **Minimum Spanning Tree:** Find critical dependency paths
- **Community Detection:** Identify related modules
- **PageRank:** Rank symbol importance

### 5.3 Performance Optimizations

- **Lazy Construction:** Build graph parts on-demand
- **Incremental Updates:** Only update changed parts
- **Parallel Processing:** Process independent modules concurrently
- **Memory Management:** Free unused graph parts

---

## 6. Query Engine

### 6.1 Query Language

```typescript
export interface Query {
  type: QueryType;
  filters: QueryFilter[];
  conditions: QueryCondition[];
  sort: SortOption[];
  limit: number;
  offset: number;
  
  // Advanced features
  includeMetadata: boolean;
  includeContext: boolean;
  streaming: boolean;
}

export enum QueryType {
  SYMBOL_SEARCH = "symbol_search",
  FILE_SEARCH = "file_search",
  DEPENDENCY_QUERY = "dependency_query",
  PATH_FINDER = "path_finder",
  ANALYSIS_QUERY = "analysis_query",
  CONTEXT_BUILDER = "context_builder",
}
```

### 6.2 Query Examples

```typescript
// Find all functions that handle authentication
{
  type: "symbol_search",
  filters: [
    { field: "type", operator: "=", value: "function" },
    { field: "name", operator: "contains", value: "auth" },
    { field: "file", operator: "endsWith", value: ".ts" }
  ]
}

// Find all imports from express module
{
  type: "dependency_query",
  conditions: [
    { field: "target", operator: "=", value: "express" },
    { field: "type", operator: "=", value: "import" }
  ]
}

// Find the shortest path between two symbols
{
  type: "path_finder",
  filters: [
    { field: "source", operator: "=", value: "UserController" },
    { field: "target", operator: "=", value: "UserService" }
  ]
}

// Analyze module coupling
{
  type: "analysis_query",
  filters: [
    { field: "module", operator: "=", value: "src/auth" }
  ],
  conditions: [
    { field: "analysis", operator: "=", value: "coupling" }
  ]
}
```

### 6.3 Query Processing

- **Query Parsing:** Parse and validate queries
- **Index Lookup:** Look up data in indexes
- **Result Filtering:** Apply filters and conditions
- **Result Sorting:** Sort results by specified criteria
- **Pagination:** Handle limit/offset
- **Streaming:** Yield results incrementally

### 6.4 Query Optimization

- **Query Planning:** Generate optimal execution plans
- **Index Selection:** Choose best indexes for queries
- **Result Caching:** Cache frequent queries
- **Parallel Execution:** Execute independent query parts concurrently

---

## 7. Analysis Engine

### 7.1 Module Analysis

```typescript
export interface ModuleAnalysis {
  name: string;
  complexity: number;
  coupling: number;
  cohesion: number;
  
  // Dependencies
  imports: string[];
  exports: string[];
  dependents: string[];
  
  // Symbols
  symbols: Symbol[];
  functions: Symbol[];
  classes: Symbol[];
  
  // Quality metrics
  cyclomaticComplexity: number;
  linesOfCode: number;
  documentationRatio: number;
  testCoverage: number;
}
```

### 7.2 Analysis Algorithms

- **Cyclomatic Complexity:** Measure function complexity
- **Lines of Code:** Count lines in modules
- **Documentation Ratio:** Measure documentation coverage
- **Test Coverage:** Analyze test file relationships
- **Architecture Layers:** Detect architectural patterns
- **Design Patterns:** Identify common patterns

### 7.3 Quality Metrics

```typescript
export interface QualityMetrics {
  // Code quality
  maintainability: number;
  readability: number;
  testability: number;
  security: number;
  
  // Architectural quality
  modularity: number;
  separationOfConcerns: number;
  dependencyInversion: number;
  
  // Performance quality
  complexity: number;
  coupling: number;
  cohesion: number;
}
```

---

## 8. Storage Management

### 8.1 Persistent Storage

```typescript
export interface StorageManager {
  // Symbol storage
  saveSymbols(symbols: Symbol[]): Promise<void>;
  loadSymbols(): Promise<Symbol[]>;
  updateSymbols(symbols: Symbol[]): Promise<void>;
  deleteSymbols(ids: string[]): Promise<void>;
  
  // Dependency storage
  saveDependencies(dependencies: Dependency[]): Promise<void>;
  loadDependencies(): Promise<Dependency[]>;
  
  // File index storage
  saveFileIndex(index: FileIndex): Promise<void>;
  loadFileIndex(): Promise<FileIndex>;
  
  // Graph storage
  saveGraph(graph: Graph): Promise<void>;
  loadGraph(): Promise<Graph>;
  
  // Backup and recovery
  backup(): Promise<void>;
  restore(backupPath: string): Promise<void>;
}
```

### 8.2 Cache Management

- **LRU Cache:** Least recently used cache for frequent queries
- **Memory Cache:** In-memory cache for hot data
- **Persistent Cache:** SSD cache for large datasets
- **Distributed Cache:** Network cache for multi-node deployments

### 8.3 Memory Management

- **Garbage Collection:** Automatic cleanup of unused data
- **Memory Pools:** Reusable memory buffers
- **Streaming Processing:** Process data in chunks
- **Lazy Loading:** Load data on-demand

---

## 9. Integration with Loom

### 9.1 Agent Integration

```typescript
export class GraphEngine {
  constructor(config: GraphConfig);
  
  // Repository operations
  async indexRepository(workspace: string): Promise<void>;
  async updateRepository(workspace: string): Promise<void>;
  async getRepositoryInfo(workspace: string): Promise<RepositoryInfo>;
  
  // Query operations
  async searchSymbols(query: SymbolQuery): Promise<Symbol[]>;
  async findDependencies(query: DependencyQuery): Promise<Dependency[]>;
  async findPaths(source: string, target: string): Promise<Dependency[]>;
  
  // Analysis operations
  async analyzeModule(module: string): Promise<ModuleAnalysis>;
  async analyzeRepository(workspace: string): Promise<RepositoryAnalysis>;
  
  // Context building
  async buildContext(request: ContextRequest): Promise<string>;
}
```

### 9.2 Workflow Integration

```typescript
// In the agent loop
const graphEngine = new GraphEngine(config);

// Index repository on first access
await graphEngine.indexRepository(workspaceRoot);

// Build context for user query
const context = await graphEngine.buildContext({
  query: "How do I implement authentication?",
  workspace: workspaceRoot,
  maxTokens: config.agent.contextWindow,
  includeDependencies: true,
  includeExamples: true
});

// Run agent with enriched context
const result = await agent.run(userInput, {
  systemPrompt: context,
  // ... other options
});
```

---

## 10. Performance Characteristics

### 10.1 Resource Usage

| Repository Size | Memory Usage | Index Size | Query Latency |
|----------------|--------------|------------|---------------|
| 1k files | ~50MB | ~5MB | <10ms |
| 5k files | ~200MB | ~25MB | <50ms |
| 10k files | ~400MB | ~50MB | <100ms |
| 100k files | ~2GB | ~200MB | <500ms |

### 10.2 Scaling Considerations

- **Horizontal Scaling:** Multiple workers can process different repositories
- **Distributed Indexing:** Large repositories can be split across workers
- **Caching Layers:** Multiple cache tiers (L1: memory, L2: SSD, L3: network)
- **Incremental Updates:** Only changed files need re-indexing

---

## 11. Implementation Roadmap

### 11.1 Phase 1 (v0.1.0)
- [ ] Symbol store implementation
- [ ] Dependency store implementation
- [ ] File index implementation
- [ ] Basic graph construction
- [ ] Simple query engine

### 11.2 Phase 2 (v0.2.0)
- [ ] Advanced graph algorithms
- [ ] Query optimization
- [ ] Incremental updates
- [ ] Parallel processing
- [ ] Integration with Loom agent

### 11.3 Phase 3 (v0.3.0)
- [ ] Distributed storage
- [ ] Advanced analysis
- [ ] Performance optimizations
- [ ] Multi-language support

---

## 12. Testing

### 12.1 Test Suite

```typescript
// Unit tests
- Symbol store operations
- Dependency store operations
- File index operations
- Graph algorithms
- Query processing

// Integration tests
- End-to-end graph construction
- Large repository handling
- Performance benchmarks
- Memory usage verification

// E2E tests
- Real-world repository indexing
- Incremental update verification
- Concurrent access patterns
```

### 12.2 Benchmarks

Tests run against:
- **Small:** 1k files, 10k LOC
- **Medium:** 5k files, 50k LOC
- **Large:** 10k files, 100k LOC
- **Massive:** 100k files, 1M+ LOC

---

## 13. Future Enhancements

### 13.1 Advanced Features
- **AI-Powered Analysis:** Use ML to analyze code patterns
- **Semantic Search:** Vector embeddings for code search
- **Architecture Detection:** Automatically detect architectural patterns
- **Code Generation:** Generate code from repository structure

### 13.2 Performance Improvements
- **GPU Acceleration:** Parallel processing on GPU
- **NVMe Storage:** Faster I/O for large repositories
- **Edge Computing:** Distributed indexing across nodes
- **Adaptive Algorithms:** Dynamic algorithm selection based on repository size

---

## 14. Conclusion

The Graph Engine provides a powerful foundation for analyzing code repositories at scale. By efficiently storing and querying symbol and dependency relationships, it enables Loom to understand complex codebases and provide context-aware assistance to developers.

This engine transforms Loom from a local-first coding assistant into a repository-aware AI agent capable of:
- Understanding code structure and relationships
- Providing context-aware suggestions
- Managing dependencies intelligently
- Optimizing for large-scale projects

The Graph Engine is a critical component for Loom's evolution into a production-grade AI coding assistant.
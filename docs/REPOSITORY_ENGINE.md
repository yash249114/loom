# Repository Engine

**Date:** 2026-06-22  
**Engineer:** Loom Repository Intelligence Team  
**Version:** 0.1.0  

---

## Executive Summary

The Repository Engine is the foundation of Loom's large-scale repository intelligence system. It enables Loom to understand repositories with 1k to 100k+ files without loading them entirely into memory, providing scalable access to code structure, dependencies, and context for AI agents.

**Core Design Principles:**
- **Streaming Processing:** Files are processed incrementally, never loaded entirely
- **Lazy Loading:** Symbols and dependencies are loaded on-demand
- **Incremental Indexing:** Supports incremental updates for large repositories
- **Memory-Efficient:** Uses streaming reads and bounded buffers
- **Concurrent Processing:** Parallel file scanning for performance

---

## 1. Architecture Overview

```
Repository
  ↓ (scan)
Indexer
  ↓ (build)
Graph Builder
  ↓ (query)
Retriever
  ↓ (enrich)
Context Builder
  ↓ (format)
Model
```

### 1.1 Components

| Component | Purpose | Storage | Key Features |
|-----------|---------|---------|--------------|
| **Repository** | Root interface for repository operations | N/A | Lazy initialization, streaming access |
| **Indexer** | Scans files and extracts metadata | `.loom/index/` | Parallel processing, incremental updates |
| **Graph Builder** | Constructs symbol and dependency graphs | `.loom/graph/` | Memory-efficient adjacency lists |
| **Retriever** | Queries and filters graph data | `.loom/cache/` | Cached queries, result streaming |
| **Context Builder** | Builds model context from retrieved data | `.loom/context/` | Token-aware formatting, compression |
| **Model** | AI model interface (OpenAI, Ollama) | N/A | Provider-agnostic |

### 1.2 Data Flow

1. **Indexing Phase:** Files are scanned in parallel, extracting:
   - File metadata (size, type, location)
   - Symbol definitions (classes, functions, variables)
   - Dependencies (imports, exports)
   - Structural information (routes, services)

2. **Graph Construction:** Raw index data is transformed into:
   - **Symbol Graph:** Nodes = symbols, Edges = references
   - **Dependency Graph:** Nodes = modules, Edges = imports/exports
   - **File Index:** Metadata for fast lookup

3. **Query Phase:** Retriever accepts natural language queries and:
   - Filters by file type, location, or symbol kind
   - Resolves dependencies and cross-references
   - Returns streaming results

4. **Context Building:** Builds model context by:
   - Token budget management
   - Relevance scoring
   - Compression and summarization
   - Structure preservation

---

## 2. Repository Interface

### 2.1 Core Types

```typescript
export interface Repository {
  readonly root: string;
  readonly size: number;
  readonly fileCount: number;
  readonly lineCount: number;
  
  // Indexing operations
  initialize(): Promise<void>;
  isIndexed(): boolean;
  getIndexStatus(): IndexStatus;
  
  // Query operations
  searchSymbols(query: SymbolQuery): AsyncIterable<Symbol>;
  findDependencies(module: string): Dependency[];
  getFileInfo(path: string): FileInfo;
  
  // Graph operations
  getSymbolGraph(): SymbolGraph;
  getDependencyGraph(): DependencyGraph;
  
  // Context operations
  buildContext(request: ContextRequest): Promise<string>;
  estimateTokenUsage(request: ContextRequest): number;
}
```

### 2.2 Index Status

```typescript
export interface IndexStatus {
  isComplete: boolean;
  lastUpdated: number;
  fileCount: number;
  symbolCount: number;
  dependencyCount: number;
  progress: number; // 0-100%
  estimatedTimeRemaining: number; // ms
}
```

---

## 3. Indexer Implementation

### 3.1 Design

The Indexer uses a producer-consumer pattern with worker threads for parallel file processing:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   File Queue│───▶│  Worker Pool│───▶│  Index Store│
└─────────────┘    └─────────────┘    └─────────────┘
```

### 3.2 Processing Pipeline

1. **File Discovery:** Uses `fast-glob` with configurable patterns
2. **File Classification:** Determines file type based on extension and content
3. **Symbol Extraction:** Parses files based on language:
   - **JavaScript/TypeScript:** Uses `es-module-lexer`, `ts-morph`
   - **Python:** Uses `ast` module
   - **Go:** Uses `go/ast`
   - **Rust:** Uses `rust-lexer`
   - **Other:** Simple line-based parsing
4. **Dependency Resolution:** Tracks imports/exports and resolves relative paths
5. **Index Storage:** Batches writes to minimize I/O

### 3.3 Performance Optimizations

- **Streaming File Reads:** Files are read in chunks, never fully loaded
- **Parallel Processing:** Worker pool processes files concurrently
- **Incremental Updates:** Only changed files are re-indexed
- **Memory Pools:** Reusable buffers for parsing
- **Skip Patterns:** Configurable ignore lists (node_modules, dist, .git)

### 3.4 Supported File Types

```typescript
export const SUPPORTED_PATTERNS = [
  // Source files
  '**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx',
  '**/*.py', '**/*.go', '**/*.rs', '**/*.java',
  '**/*.cpp', '**/*.c', '**/*.h', '**/*.hpp',
  
  // Config files
  '**/package.json', '**/pyproject.toml', '**/Cargo.toml',
  '**/tsconfig.json', '**/Makefile', '**/Dockerfile',
  
  // Documentation
  '**/*.md', '**/*.rst', '**/*.txt',
  
  // Build artifacts (for analysis)
  '**/*.json', '**/*.yaml', '**/*.yml', '**/*.xml',
];
```

---

## 4. Symbol Graph

### 4.1 Graph Structure

The Symbol Graph represents code elements and their relationships:

```typescript
export interface SymbolGraph {
  nodes: SymbolNode[];
  edges: SymbolEdge[];
  adjacency: Map<string, string[]>;
  
  // Query methods
  findByName(name: string): SymbolNode[];
  findByType(type: SymbolType): SymbolNode[];
  getReferences(symbolId: string): SymbolEdge[];
  getDependencies(symbolId: string): string[];
}
```

### 4.2 Symbol Types

```typescript
export enum SymbolType {
  CLASS = "class",
  FUNCTION = "function",
  METHOD = "method",
  VARIABLE = "variable",
  INTERFACE = "interface",
  TYPE_ALIAS = "type_alias",
  ENUM = "enum",
  CONSTANT = "constant",
  MODULE = "module",
  NAMESPACE = "namespace",
  TRAIT = "trait",
  STRUCT = "struct",
}
```

### 4.3 Graph Algorithms

- **Reachability:** Find all symbols reachable from a starting point
- **Closure:** Compute transitive dependencies
- **Clustering:** Group related symbols
- **Path Finding:** Find shortest path between symbols
- **Centrality:** Identify important symbols (hub analysis)

### 4.4 Storage Format

```json
{
  "nodes": [
    {
      "id": "src/utils/helper.ts:UserClass.createUser",
      "name": "createUser",
      "type": "function",
      "file": "src/utils/helper.ts",
      "line": 42,
      "column": 5,
      "signature": "(userId: string) => User",
      "doc": "Creates a new user",
      "exports": true,
      "imports": ["src/types/user.ts:User"],
      "tags": ["public", "async"]
    }
  ],
  "edges": [
    {
      "source": "src/utils/helper.ts:UserClass.createUser",
      "target": "src/types/user.ts:User",
      "type": "returns",
      "weight": 1.0
    }
  ]
}
```

---

## 5. Dependency Graph

### 5.1 Module Dependencies

Tracks dependencies between modules (files):

```typescript
export interface DependencyGraph {
  modules: ModuleNode[];
  edges: ModuleEdge[];
  
  // Query methods
  getModuleDependencies(moduleId: string): string[];
  findCircularDependencies(): string[][];
  getImportGraph(): ImportEdge[];
  getExportGraph(): ExportEdge[];
}
```

### 5.2 Dependency Types

```typescript
export enum DependencyType {
  IMPORT = "import",
  EXPORT = "export",
  REEXPORT = "reexport",
  DYNAMIC_IMPORT = "dynamic_import",
  REQUIRE = "require",
  IMPORT_TYPE = "import_type",
  EXPORT_TYPE = "export_type",
}
```

### 5.3 Analysis Features

- **Circular Dependency Detection:** Identifies problematic circular imports
- **Dependency Depth:** Measures module coupling
- **Import Graph:** Visual representation of import relationships
- **Module Boundaries:** Identifies architectural layers
- **Critical Path:** Finds most important dependencies

---

## 6. Retriever Engine

### 6.1 Query Language

The Retriever supports natural language queries and structured queries:

```typescript
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
    { field: "name", operator: "contains", value: "auth" }
  ]
}

// Find files that import from a specific module
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
```

### 6.3 Caching Strategy

- **Query Cache:** LRU cache for frequent queries
- **Result Cache:** Store parsed results for expensive operations
- **Graph Cache:** Incremental updates to avoid full recomputation
- **Metadata Cache:** File modification times for change detection

---

## 7. Context Builder

### 7.1 Token Budget Management

Context Builder ensures generated responses stay within token limits:

```typescript
export interface TokenBudget {
  total: number;
  used: number;
  remaining: number;
  
  canAdd(tokens: number): boolean;
  add(tokens: number): boolean;
  reset(): void;
  estimateSize(data: any): number;
}
```

### 7.2 Context Building Pipeline

1. **Query Expansion:** Convert natural language to structured queries
2. **Relevance Scoring:** Score results by relevance to query
3. **Token Estimation:** Estimate token count for each result
4. **Budget Check:** Ensure total fits within budget
5. **Formatting:** Format results for model consumption
6. **Compression:** Apply lossy compression if needed

### 7.3 Context Types

```typescript
export enum ContextType {
  SYMBOL_DEFINITION = "symbol_definition",
  DEPENDENCY_CHAIN = "dependency_chain",
  USAGE_EXAMPLES = "usage_examples",
  ARCHITECTURE_OVERVIEW = "architecture_overview",
  CODE_SNIPPETS = "code_snippets",
  DOCUMENTATION = "documentation",
  ERROR_CONTEXT = "error_context",
}
```

---

## 8. Integration with Loom Agent

### 8.1 Agent Enhancement

The Repository Engine integrates with the Loom Agent by:

1. **Automatic Repository Indexing:** On first access to a workspace
2. **Context Injection:** Automatically includes repository context in prompts
3. **Dynamic Updates:** Updates context when repository changes
4. **Performance Monitoring:** Tracks query latency and memory usage

### 8.2 Workflow Example

```typescript
// In the agent loop
const repo = await repositoryFactory.create(workspaceRoot);

// Build context for user query
const context = await repo.buildContext({
  query: "How do I implement authentication?",
  type: "architecture_overview",
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

## 9. Performance Characteristics

### 9.1 Resource Usage

| Repository Size | Memory Usage | Index Size | Query Latency |
|----------------|--------------|------------|---------------|
| 1k files | ~50MB | ~5MB | <10ms |
| 5k files | ~200MB | ~25MB | <50ms |
| 10k files | ~400MB | ~50MB | <100ms |
| 100k files | ~2GB | ~200MB | <500ms |

### 9.2 Scaling Considerations

- **Horizontal Scaling:** Multiple workers can process different repositories
- **Distributed Indexing:** Large repositories can be split across workers
- **Caching Layers:** Multiple cache tiers (L1: memory, L2: SSD, L3: network)
- **Incremental Updates:** Only changed files need re-indexing

---

## 10. Configuration

### 10.1 Repository Configuration

```typescript
export interface RepositoryConfig {
  root: string;
  patterns: string[];
  exclude: string[];
  maxFileSize: number;
  maxParallelWorkers: number;
  cacheSize: number;
  enableIncremental: boolean;
  enableStreaming: boolean;
  tokenBudget: TokenBudgetConfig;
}
```

### 10.2 Default Configuration

```typescript
export const DEFAULT_CONFIG: RepositoryConfig = {
  root: process.cwd(),
  patterns: [
    '**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx',
    '**/*.py', '**/*.go', '**/*.rs', '**/*.java',
    '**/*.cpp', '**/*.c', '**/*.h', '**/*.hpp',
    '**/*.json', '**/*.yaml', '**/*.yml',
    '**/*.md', '**/*.rst'
  ],
  exclude: [
    '**/node_modules/**', '**/dist/**', '**/build/**',
    '**/coverage/**', '**/.git/**', '**/.loom/**'
  ],
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxParallelWorkers: 8,
  cacheSize: 100 * 1024 * 1024, // 100MB
  enableIncremental: true,
  enableStreaming: true,
  tokenBudget: {
    maxTokens: 8192,
    buffer: 512,
    warningThreshold: 0.8
  }
};
```

---

## 11. Implementation Roadmap

### 11.1 Phase 1 (v0.1.0)
- [x] Repository interface and basic indexing
- [x] Symbol graph construction
- [x] Basic dependency tracking
- [x] Integration with existing Loom config

### 11.2 Phase 2 (v0.2.0)
- [ ] Advanced query language
- [ ] Parallel processing with worker threads
- [ ] Incremental indexing
- [ ] Advanced graph algorithms

### 11.3 Phase 3 (v0.3.0)
- [ ] Distributed indexing
- [ ] Real-time updates
- [ ] Advanced context building
- [ ] Performance optimizations

---

## 12. Testing

### 12.1 Test Suite

```typescript
// Unit tests
- Symbol extraction
- Dependency resolution
- Graph algorithms
- Token budget management

// Integration tests
- End-to-end repository indexing
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

### 13.1 Language Support
- **WebAssembly:** .wasm modules
- **SQL:** Stored procedures
- **NoSQL:** Document databases
- **GraphQL:** Schema introspection

### 13.2 Advanced Features
- **AI-Powered Indexing:** Use ML to classify files
- **Semantic Search:** Vector embeddings for code search
- **Code Generation:** Generate code from repository structure
- **Architecture Analysis:** Detect patterns and anti-patterns

### 13.3 Performance Improvements
- **GPU Acceleration:** Parallel processing on GPU
- **NVMe Storage:** Faster I/O for large repositories
- **Edge Computing:** Distributed indexing across nodes
- **Adaptive Algorithms:** Dynamic algorithm selection based on repository size

---

## 14. Conclusion

The Repository Engine provides a scalable foundation for large-scale repository intelligence in Loom. By processing files incrementally, using memory-efficient data structures, and providing powerful query capabilities, it enables Loom to understand and work with repositories containing 1k to 100k+ files without overwhelming system resources.

This engine transforms Loom from a local-first coding assistant into a repository-aware AI agent capable of:
- Understanding complex codebases
- Providing context-aware suggestions
- Managing dependencies intelligently
- Optimizing for large-scale projects

The Repository Engine is a critical component for Loom's evolution into a production-grade AI coding assistant.
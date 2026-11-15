# Graph Memory

## Overview

Graph Memory is the structural layer of Loom's intelligence. It maintains a persistent, queryable graph of every file, symbol, and dependency relationship across all indexed workspaces.

```
                  ┌──────────────────────┐
                  │   Symbol Graph        │
                  │   (in-memory query)   │
                  └──────┬───────────────┘
                         │ search / traverse
                  ┌──────▼───────────────┐
                  │   Graph Builder       │
                  │   (adjacency + BFS)   │
                  └──────┬───────────────┘
                         │ build from parsed
                  ┌──────▼───────────────┐
                  │   RepositoryIndexer   │
                  │   (scan → parse)     │
                  └──────┬───────────────┘
                         │ persist to
                  ┌──────▼───────────────┐
                  │   NDJSON on disk      │
                  │   (.loom/graph/)     │
                  └──────────────────────┘
```

## Node Types

| Node Type | Fields | Example |
|-----------|--------|---------|
| `File` | id, path, language, size, lineCount, mtime, hash | `src/index.ts` |
| `Symbol` | id, name, qualifiedName, kind, file, line, column, signature, doc, modifiers, tags, exports, language | `class UserService` |
| `Module` | id, name, path, exports, imports | `@loom/core` |
| `Directory` | id, path, fileCount, childCount | `src/components/` |

## Edge Types

| Edge Type | Source → Target | Weight | Meaning |
|-----------|----------------|--------|---------|
| `IMPORTS` | File → File | 1 | Direct import |
| `EXPORTS` | File → Symbol | 1 | File exports symbol |
| `DEFINES` | File → Symbol | 1 | Symbol defined in file |
| `CALLS` | Symbol → Symbol | frequency | Function calls function |
| `EXTENDS` | Symbol → Symbol | 1 | Class extends class |
| `IMPLEMENTS` | Symbol → Symbol | 1 | Class implements interface |
| `COMPOSES` | Symbol → Symbol | composition depth | Object contains object |
| `REFERENCES` | Symbol → Symbol | occurrence count | Symbol mentions symbol |

## Graph Operations

### Symbol Search

```
searchSymbols(query: SymbolQuery) → SymbolNode[]

Filters: name, type, language, file, tags, modifiers, exports
Sort:    relevance (name match > qualified name match > tag match)
Limit:   configurable (default 50)
```

### Dependency Queries

```
findDependencies(query: DependencyQuery) → DependencyNode[]

Filters: source, target, type, language, strength
Traversal: BFS from source (depth-limited)
```

### Graph Analysis

```
analyze(module: string) → {
  reachableSymbols: string[]       // BFS from module
  transitiveClosure: string[]      // all transitive dependencies
  findCycles: string[][]           // circular dependency detection
  criticalPath: string[]           // highest-importance path
  importanceScore: number          // in-degree × 2 + out-degree
  coupling: number                 // external deps count
  cohesion: number                 // internal refs / total symbols
  fanOut: number                   // outgoing dependencies
  fanIn: number                    // incoming dependencies
}
```

### Reachability

```
reachable(from: string, depth: number) → SymbolNode[]

BFS from symbol `from`, up to `depth` edges deep.
Returns sorted by importance (in-degree) descending.
Used for "what does this symbol affect?" queries.
```

### Critical Path Detection

The critical path identifies the most important chain of symbols in the graph:

1. Compute PageRank-style importance for each symbol
2. Find the highest-importance path from entry points
3. Return top 10 symbols by importance score

`importance(node) = in_degree(node) × 2 + out_degree(node)`

Symbols with high in-degree (many dependents) are libraries. Symbols with high out-degree (many dependencies) are integration points.

## Incremental Graph Update

On each index run:

1. Stat all files (fast, uses file system cache)
2. Compare mtime+size with cache
3. For changed/new files:
   a. Re-parse content
   b. Diff symbols against cached version
   c. Add new nodes/edges, remove stale ones
   d. Update cache entry
4. For deleted files:
   a. Remove all nodes and edges
   b. Remove cache entry
5. Write updated NDJSON files
6. Update metadata.json

## Persistence Format

### metadata.json

```json
{
  "version": "2.0",
  "root": "/path/to/project",
  "createdAt": 1712345678000,
  "lastUpdated": 1712345678000,
  "fileCount": 1423,
  "symbolCount": 8921,
  "dependencyCount": 4567,
  "edgeCount": 12345,
  "indexDuration": 3456
}
```

### files.ndjson

```
{"path":"src/index.ts","language":"typescript","size":1234,"lineCount":56,"mtime":1712345678000,"hash":"abc123","symbolCount":12,"depCount":5}
{"path":"src/app.tsx","language":"typescript","size":5678,"lineCount":200,"mtime":1712345678000,"hash":"def456","symbolCount":8,"depCount":3}
```

### symbols.ndjson

```
{"id":"src/index.ts:App","name":"App","kind":"class","file":"src/index.ts","line":10,"col":1,"visibility":"exported","parent":null,"modifiers":["export","default"],"tags":[],"language":"typescript"}
{"id":"src/index.ts:render","name":"render","kind":"function","file":"src/index.ts","line":50,"col":1,"visibility":"public","parent":null,"modifiers":[],"tags":[],"language":"typescript"}
```

### deps.ndjson

```
{"source":"src/app.tsx","target":"react","type":"import","symbols":["useState","useEffect"]}
{"source":"src/app.tsx","target":"./components/Header.tsx","type":"import","symbols":["Header"]}
```

### edges.ndjson

```
{"from":"src/index.ts:App","to":"src/index.ts:render","type":"CALLS","weight":1}
{"from":"src/app.tsx:App","to":"src/components/Header.tsx:Header","type":"COMPOSES","weight":1}
```

## Query API

### `WorkspaceGraph` class

```typescript
class WorkspaceGraph {
  // Construction
  constructor(rootDir: string)
  async load(): Promise<void>                    // load from disk
  async save(): Promise<void>                    // persist to disk

  // Indexing
  async index(force?: boolean): Promise<IndexResult>
  async indexIncremental(): Promise<IndexResult>

  // Symbol queries
  searchSymbols(query: SymbolQuery): SymbolNode[]
  getSymbol(id: string): SymbolNode | undefined
  getFileSymbols(file: string): SymbolNode[]

  // Dependency queries  
  findDependencies(query: DependencyQuery): DependencyNode[]
  getReachable(from: string, depth?: number): SymbolNode[]
  findPath(from: string, to: string): string[]

  // Graph analysis
  analyze(module: string): GraphAnalysis
  findCycles(): string[][]
  getCriticalPath(): string[]
  importanceScore(node: string): number

  // Statistics
  getStats(): { fileCount: number; symbolCount: number; depCount: number; edgeCount: number }
}
```

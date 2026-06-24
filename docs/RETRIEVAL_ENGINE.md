# Retrieval Engine

## Overview

The Retrieval Engine solves the problem of dumping entire repositories into model context windows. Instead of feeding raw directory trees, it builds a structured **Repository Graph**, scores files against a **user query** using **TF-IDF cosine similarity**, and selects only the top-K most relevant results.

## Architecture

```
User Query
    ↓
Repository Graph  ←  src/retrieval/graph.ts
    ↓
Retriever          ←  src/retrieval/retriever.ts
    ↓
Context Builder    ←  src/retrieval/builder.ts
    ↓
Compressor         ←  src/retrieval/compressor.ts
    ↓
Model
```

## Components

### 1. Repository Graph (`graph.ts`)

Scans a workspace directory and builds three indices:

| Index | Description |
|---|---|
| `files: Map<string, RepoFile>` | File path → metadata + content + symbols + dependencies |
| `symbols: Map<string, Symbol[]>` | File path → array of exported/defined symbols |
| `dependencyIndex: Map<string, string[]>` | File path → list of import targets |

**Symbol extraction** supports: `class`, `function`, `method`, `variable`, `type`, `interface`, `enum`, `component` (JSX/TSX). JSDoc comments are associated with the immediately following symbol.

**Dependency extraction** supports: `import`, `require`, and `dynamic import()` expressions. Both local (`./foo`, `../bar`) and external package deps are tracked.

**File filtering**: ignores `node_modules`, `.git`, `dist`, `.loom`, minified files, binary files, and files over 1 MB.

```ts
const graph = await buildGraph("/path/to/repo");
console.log(graph.files.size); // 342 files
```

### 2. Retriever (`retriever.ts`)

TF-IDF (Term Frequency — Inverse Document Frequency) vector-space model.

**Document construction per file**:
- File path tokens (`src/tools/foo.ts` → `["src", "tools", "foo", "ts"]`)
- First 2000 chars of content
- Symbol names and their JSDoc comments
- Dependency target paths

**Ranking**:
- Tokenize query → compute TF-IDF vector
- Compute cosine similarity against each file's vector
- Bonus (`+0.3`) for path substring matches (e.g., query "file-tools" matches `src/tools/file-tools.ts`)
- Language weight multiplier (`.ts`/`.tsx` = 1.2, `.md` = 0.8, `.json` = 0.6, etc.)
- Symbol match bonus (`+0.1` per matching symbol, max 5)

Output: `ScoredItem[]` sorted descending by score.

```ts
const results = rankFiles("configuration schema load", graph.files, graph.symbols, 10);
// → ScoredItem[] with top 10 files
```

### 3. Context Builder (`builder.ts`)

Token-aware assembly of the final context package.

- **Token estimation**: `Math.ceil(text.length * 0.25)` (~4 chars/token)
- **Greedy insertion**: iterates scored items in rank order; skips items that would exceed the budget
- **Symbol deduplication**: same `(name, file)` pair only included once
- **Dependency deduplication**: same `(target, source)` pair only included once

Output: `ContextPackage` with `{ files, symbols, dependencies, totalTokens, originalTokens, compressionRatio }`.

```ts
const pkg = buildContext(scored, {
  maxTokens: 16000,
  includeSymbols: true,
  includeDependencies: true,
});
```

### 4. Compressor (`compressor.ts`)

Lossy compression to reduce token footprint:

| Pass | Effect |
|---|---|
| Strip block comments | Removes `/* ... */` |
| Strip line comments | Removes `// ...` |
| Strip empty imports | Removes `import {} from "x"` and unused requires |
| Strip blank lines | Collapses multiple blank lines → single |
| Truncate long lines | Caps lines at 200 chars (optional) |

Output: Updated `ContextPackage` with revised `totalTokens` and `compressionRatio`.

```ts
const compressed = compressPackage(pkg, {
  stripComments: true,
  stripBlankLines: true,
  stripEmptyImports: true,
});
```

### 5. Pipeline (`index.ts`)

Convenience wrapper that runs the full pipeline:

```ts
import { retrieve } from "./retrieval/index.js";

const ctx = await retrieve("/path/to/repo", {
  text: "session store corrupt database handling",
  topK: 10,
  maxTokens: 32000,
  includeSymbols: true,
  includeDependencies: true,
});

console.log(ctx.files.length);       // 8
console.log(ctx.totalTokens);        // ~12400
console.log(ctx.compressionRatio);   // 0.67
```

A streaming variant `retrieveStream()` accepts `onProgress` callbacks for user-facing progress:

```ts
const ctx = await retrieveStream(rootDir, query, (phase, detail) => {
  console.log(`[${phase}] ${detail}`);
});
```

## Types

```ts
interface RepoFile {
  path: string;
  size: number;
  language: string;
  content: string;
  symbols: Symbol[];
  dependencies: Dependency[];
}

interface Symbol {
  name: string;
  kind: "class" | "function" | "method" | "variable" | "type"
        | "interface" | "enum" | "component";
  file: string;
  line: number;
  doc?: string;
}

interface Dependency {
  source: string;
  target: string;
  type: "import" | "require" | "dynamic";
  names: string[];
}

interface ScoredItem {
  file: RepoFile;
  score: number;
  matchedSymbols: Symbol[];
  matchedDeps: Dependency[];
}

interface RetrievalQuery {
  text: string;
  topK: number;
  maxTokens: number;
  includeDependencies: boolean;
  includeSymbols: boolean;
}

interface ContextPackage {
  files: RepoFile[];
  symbols: Symbol[];
  dependencies: Dependency[];
  totalTokens: number;
  originalTokens: number;
  compressionRatio: number;
}

interface RepositoryGraph {
  files: Map<string, RepoFile>;
  symbols: Map<string, Symbol[]>;
  dependencyIndex: Map<string, string[]>;
  reverseDeps: Map<string, string[]>;
}
```

## Token Budget Strategy

| Budget | Use Case |
|---|---|
| 8,000 | Quick question; small scope |
| 16,000 | Normal development task |
| 32,000 | Complex refactor; multi-file change |
| 64,000 | Full-context analysis |

The builder inserts files greedily in rank order. If a file exceeds the remaining budget, it is skipped and the builder moves to the next. This ensures the most relevant content always fits first.

## Compression Benchmarks

| Pass | Avg Reduction |
|---|---|
| Strip comments only | ~15% |
| Strip blank lines only | ~8% |
| Strip empty imports only | ~3% |
| All three combined | ~30–45% |
| + Truncate long lines | ~50–60% |

Compression is lossy: comments and formatting are removed. Use the non-compressed variant when preserving full source fidelity is critical.

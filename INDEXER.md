# Loom Indexer

The indexer builds a repository intelligence database — symbols, dependencies, and a dependency graph — from your project's source code. It supports TypeScript, JavaScript, Python, and Go.

## Usage

```bash
# Index the current project
loom index

# Force a full reindex (ignore cache)
loom index --force

# Show detailed progress
loom index --verbose
```

## Output

Running `loom index` creates two files in `.loom/`:

### `.loom/symbols.json`

An array of all symbols (functions, classes, interfaces, types, enums, constants, variables) found in the project:

```json
[
  {
    "name": "Agent",
    "kind": "class",
    "file": "src/agent/agent.ts",
    "line": 42,
    "column": 1,
    "visibility": "exported"
  }
]
```

### `.loom/graph.json`

Nodes (files) and edges (dependencies) for the project:

```json
{
  "version": "1.0",
  "generatedAt": "2026-06-22T12:00:00.000Z",
  "nodes": [
    {
      "path": "src/agent/agent.ts",
      "language": "typescript",
      "size": 12345,
      "dependencies": ["src/core/types.ts", "src/tools/registry.ts"]
    }
  ],
  "edges": [
    {
      "source": "src/agent/agent.ts",
      "target": "src/core/types.ts",
      "type": "import"
    }
  ]
}
```

### `.loom/index-cache.json`

Internal cache for incremental indexing. Not intended for direct use.

## Supported Languages

| Language      | Extensions                          | Symbols Extracted                                | Dependencies                 |
|---------------|-------------------------------------|--------------------------------------------------|------------------------------|
| TypeScript    | `.ts`, `.tsx`, `.mts`, `.cts`       | function, class, interface, type, enum, const    | import, export, require      |
| JavaScript    | `.js`, `.jsx`, `.mjs`, `.cjs`       | function, class, const                           | import, export, require      |
| Python        | `.py`                               | def, async def, class, constants (UPPER_CASE)    | import, from ... import      |
| Go            | `.go`                               | func, method, struct, interface, type            | import                       |

## Incremental Indexing

The indexer uses file modification times (`mtimeMs`) and file sizes to detect changes. On each run:

1. **Scan** all supported files (excluding `node_modules/`, `.git/`, `dist/`, `.loom/`, `coverage/`, `vendor/`)
2. **Compare** each file's mtime/size against the cache
3. **Parse** only changed/new files
4. **Restore** unchanged files from cache
5. **Remove** deleted files from index
6. **Write** updated `graph.json`, `symbols.json`, and `index-cache.json`

Use `--force` to skip the cache and reindex everything.

## Ignored Directories

- `node_modules/`
- `.git/`
- `dist/`
- `.loom/`
- `coverage/`
- `vendor/`

## Performance

The indexer is designed to index 10,000 files in under 60 seconds:

- Batch processing (50 files at a time) with `Promise.all` for parallel parsing
- Regex-based parsers (no AST overhead)
- Incremental cache avoids re-parsing unchanged files
- `fast-glob` for fast file discovery (already a project dependency)

## Architecture

```
src/indexer/
├── types.ts       # Type definitions
├── language.ts    # Language detection + file patterns
├── parse.ts       # Symbol + dependency parsers (JS/TS, Python, Go)
├── indexer.ts     # Indexer class — scan, parse, resolve, cache, write
├── cli.ts         # CLI handler for `loom index`
└── index.ts       # Public API exports
```

## API

```typescript
import { Indexer } from "loom";

const indexer = new Indexer({
  rootDir: "/path/to/project",
  force: false,     // optional: force full reindex
  verbose: false,   // optional: show detailed progress
});

const result = await indexer.run();
// result.files        — all indexed files with symbols + deps
// result.symbols     — all symbols across all files
// result.dependencies — all dependency edges
```

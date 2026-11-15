# Memory Engine

## Overview

The Memory Engine is Loom's persistent intelligence layer. It transforms Loom from a session-scoped coding assistant into a repository-aware system that remembers structure, decisions, and patterns across sessions.

Three memory systems work together:

| System | Scope | Persistence | Purpose |
|--------|-------|-------------|---------|
| Workspace Memory Graph | Single workspace | Disk (`.loom/graph/`) | Structural memory of files, symbols, and dependencies |
| Long-Term Project Memory | Single workspace | Disk (`.loom/memory/`) | Knowledge extracted from conversations, decisions, patterns |
| Architecture Knowledge Base | Workspace + global | Disk (`.loom/arch/`) + home dir | Architecture decisions and design rationale |

## Pipeline

```
Repository
    ↓ (scan + parse)
Indexer
    ↓ (build enriched graph)
Workspace Memory Graph
    ↓ (query + traverse)
Symbol Relationship Graph
    ↓ (rank + filter)
Retriever
    ↓ (assemble context)
Context Engine v2
    ↓ (budget-aware assembly)
Memory-Enriched System Prompt
    ↓
Model
```

## Workspace Memory Graph

### File Format

Stored across three files in `.loom/graph/`:

```
.loom/graph/
  metadata.json     ← schema version, last index time, file count
  files.ndjson      ← one JSON line per file (path, language, size, mtime, hash)
  symbols.ndjson    ← one JSON line per symbol (name, kind, file, line, col, visibility, parent)
  deps.ndjson       ← one JSON line per dependency (source, target, type, symbols)
  edges.ndjson      ← resolved cross-file edges (from_file, to_file, from_symbol, to_symbol, relationship)
```

Using NDJSON (newline-delimited JSON) instead of single JSON blobs enables streaming reads for large repos. Only `metadata.json` is read in full on startup.

### Indexing lifecycle

```
Initial index: scan all files → parse → build graph → write NDJSON
Incremental:   stat all files → compare mtime/size → re-parse changed → patch graph
Force reindex: clear graph dir → full reindex
```

### Memory Store format

```
.loom/memory/
  sessions/         ← one NDJSON file per session (key observations extracted during turn)
  patterns.json     ← recurring patterns detected across sessions
  conventions.json  ← project conventions learned from code and conversations
  tags.json         ← cross-cutting tags linking memory entries to files/symbols
```

### Architecture Knowledge Base

```
.loom/arch/
  decisions.json    ← Architecture Decision Records (ADRs) as structured objects
  rationale.json    ← Design rationale extracted from conversations
  patterns.json     ← Detected architectural patterns (layers, modules, data flow)

~/.loom/knowledge/
  languages/        ← Language-specific patterns (TypeScript idioms, Go conventions)
  frameworks/       ← Framework-specific knowledge (React patterns, Express middleware)
  practices/        ← General software engineering practices
```

## Long-Term Project Memory

### Knowledge Extraction

During each agent turn, the Context Engine extracts:

1. **Key facts** — specific observations about the codebase
2. **Decisions** — architectural or design choices made
3. **Patterns** — recurring structures or conventions
4. **References** — files/symbols involved

Extractions are scored by confidence (how sure the model was) and importance (how central to the task). Low-scoring extractions are pruned after session end.

### Knowledge Retrieval

On session start, or when context is assembled:

1. Query the project memory for entries related to the current task
2. Score by relevance (TF-IDF on entry text vs. current query/session context)
3. Include top-K entries (budget-limited) in the system prompt
4. Tag new observations back into memory

### Pruning

- Per-session memory: retained for 30 days, then summarized into patterns
- Patterns: deduplicated by similarity (Levenshtein on text, Jaccard on file sets)
- ADRs: never pruned (user-managed)

## Context Engine v2

### Token Budget Allocation

```
Total Budget (N tokens)
  ├── System prompt (fixed)    — 500 tokens
  ├── Workspace identity       — 200 tokens
  ├── Memory context           — up to 15% of budget
  │   ├── Project memory       — 60% of memory budget
  │   ├── Architecture KB      — 25% of memory budget
  │   └── Session memory       — 15% of memory budget
  ├── Repository context       — up to 40% of budget
  │   ├── Relevant symbols     — scored, top K
  │   └── Relevant files       — scored, top K (truncated)
  ├── Tool schemas             — dynamic (depends on enabled tools)
  └── Conversation history     — remaining budget
```

### Prioritization Algorithm

1. **Score each candidate context item** by:
   - Query relevance (TF-IDF cosine similarity)
   - Freshness (recency of last modification)
   - Importance (in-degree in symbol graph)
   - Task fit (matched to current agent mode)
2. **Sort by score descending**
3. **Greedy fill** within each budget bucket
4. **Truncate lowest-scored items** in overflow buckets

### Streaming Assembly

For large repositories, context assembly streams:

1. Scan phase: collect all candidates (files, symbols, memories)
2. Score phase: compute relevance scores (can parallelize)
3. Fill phase: build context string within budget, streaming results as available
4. Compress phase: strip comments, minimize whitespace, shorten identifiers

## Memory-Enriched System Prompt

The agent receives a system prompt that includes:

```
You are Loom, operating in workspace: /path/to/project

## Project Memory
- This project uses React 18 with TypeScript
- The team prefers composition over inheritance
- State management uses Zustand stores

## Architecture
- Presentation layer: src/components/
- Business logic: src/hooks/ + src/services/
- Data layer: src/store/

## Currently Relevant
- You are working on: src/features/auth/
- Recently modified: src/features/auth/LoginForm.tsx
- Related symbols: useAuth(), AuthProvider, loginUser()
```

This replaces the static workspace context with dynamic, memory-informed context.

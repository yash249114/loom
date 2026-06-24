# Context Engine

## Overview

The Context Engine transforms a raw `ContextPackage` (from the Retrieval Engine) into a structured prompt optimized for LLM consumption. It handles **context formatting**, **prompt assembly**, **token budget management**, and **progressive loading** when the full context exceeds model limits.

```
ContextPackage          Context Engine          Model Prompt
  ┌─────────┐              ──────►              ┌──────────┐
  │ files   │                                  │ System   │
  │ symbols │    Format + Prioritize            │ Rules    │
  │ deps    │    + Budget + Template            │          │
  │ tokens  │                                  │ Symbols  │
  └─────────┘                                  │ Deps     │
                                               │ Files    │
                                               │ Query    │
                                               └──────────┘
```

## Prompt Template

The engine assembles context into a structured markdown template:

```
## Relevant Symbols
  class Agent @ src/agent/agent.ts:10
  function buildGraph @ src/retrieval/graph.ts:42
  interface ToolDefinition @ src/core/types.ts:29

## Relevant Dependencies
  import { z } from "zod" @ src/config/schema.ts:1
  import { loadConfig } from "../config/loader.js" @ src/cli/index.ts:5

--- src/agent/agent.ts ---
[file content]

--- src/retrieval/graph.ts ---
[file content]
```

The template follows a specific order, designed to prime the model before showing file contents:

| Section | Purpose |
|---|---|
| **Symbols** | Alerts the model to key definitions it should pay attention to |
| **Dependencies** | Shows module relationships without duplicating content |
| **Files** | Full source in relevance order; each delimited by `--- path ---` |

## Token Budget Management

### Budget Allocation

The engine divides the model's context window into zones:

```ts
const BUDGET_ZONES = {
  systemPrompt: 0.10,    // 10% — agent role, rules, constraints
  retrieval:    0.55,    // 55% — retrieved files, symbols, deps
  conversation: 0.25,    // 25% — chat history, tool results
  output:       0.10,    // 10% — model response space
};
```

For a 32K context window:
| Zone | Tokens |
|---|---|
| System prompt | 3,200 |
| Retrieved context | 17,600 |
| Conversation history | 8,000 |
| Output reservation | 3,200 |

### Progressive Loading

When token demand exceeds the budget, the engine applies escalation:

1. **Trim symbols**: omit symbols with `score < threshold`
2. **Strip dependency section**: remove `## Relevant Dependencies` block
3. **Strip symbol section**: remove `## Relevant Symbols` block
4. **Truncate lowest-ranked files**: remove files from the bottom of the ranked list
5. **Emergency compression**: apply maximum compression (strip all comments, blank lines, and truncate lines to 160 chars)

Each step recalculates remaining budget and stops when sufficient room exists.

### Budget Tracking

```ts
interface BudgetStatus {
  totalBudget: number;     // total tokens available for context
  used: number;             // tokens consumed so far
  remaining: number;        // tokens left
  isExhausted: boolean;     // true when remaining ≤ 0
  warnings: string[];       // truncation warnings
}
```

## Escalation Protocol

When multiple files compete for limited budget, the engine uses a tiered priority system:

| Priority | Condition | Action |
|---|---|---|
| P0 | File directly matches query symbols | Always included |
| P1 | File score > 0.5 (high relevance) | Included if budget ≥ 25% remaining |
| P2 | File is a dependency of a P0/P1 file | Included if budget ≥ 40% remaining |
| P3 | File score > 0.1 (moderate relevance) | Included if budget ≥ 60% remaining |
| P4 | File has no symbol matches | Included only if budget ≥ 80% remaining |

## Context Scoring

Each file in the context receives a composite score that determines insertion order:

```
compositeScore = tfidfScore * 0.60
               + pathMatch  * 0.15
               + symbolMatch * 0.15
               + depRelevance * 0.10
```

Where:
- `tfidfScore` — cosine similarity of the file's TF-IDF vector against the query
- `pathMatch` — 1.0 if query tokens appear in the file path, else 0.0
- `symbolMatch` — proportion of query tokens that match symbol names in the file
- `depRelevance` — 1.0 if the file is a dependency of any higher-ranked file, else 0.0

## Context Serialization

The engine provides multiple output formats:

### Markdown (default)

Used for chat-style model interactions. Sections are human-readable and well-delimited.

### Raw Concatenation

Used for code-editing models (e.g., Codex-style). Files are concatenated directly with path headers:

```
// src/file1.ts
export function foo() { ... }

// src/file2.ts
export function bar() { ... }
```

### Structured JSON

Used for programmatic consumption. Returns `ContextPackage` serialized as JSON:

```json
{
  "files": [
    { "path": "src/agent.ts", "content": "export function...", "tokens": 423 }
  ],
  "symbols": [
    { "name": "Agent", "kind": "class", "file": "src/agent.ts", "line": 10 }
  ],
  "totalTokens": 14200,
  "compressionRatio": 0.52
}
```

## Integration with Agent Loop

The Context Engine integrates into the Loom agent loop at the point where the agent decides which files to read:

```
Agent receives query
        ↓
Retrieval Engine builds ContextPackage
        ↓
Context Engine formats into model prompt
        ↓
Agent sends prompt to LLM
        ↓
LLM returns response (with optional tool calls)
        ↓
Agent may request additional context (narrowing/re-ranking)
        ↓
Agent produces final answer
```

### Re-ranking on Tool Results

When the agent reads a file via the `readfile` tool and discovers it references additional files not in the original context, those files can be re-ranked and injected:

```ts
agent.on("tool:readfile", (file, content) => {
  const newDeps = extractDependencies(file, content);
  const newFiles = resolveLocalDependencies(newDeps, graph.files);
  contextEngine.enrich(newFiles);
});
```

## Usage

```ts
import { retrieve } from "../retrieval/index.js";

// 1. Retrieve
const pkg = await retrieve("/path/to/repo", {
  text: "user query",
  topK: 10,
  maxTokens: 16000,
  includeSymbols: true,
  includeDependencies: true,
});

// 2. Format
const prompt = formatPrompt(pkg);
// → "## Relevant Symbols\n  class Agent @ src/agent.ts:10\n..."

// 3. Send to model
const response = await model.generate(prompt);
```

## Design Decisions

| Decision | Rationale |
|---|---|
| TF-IDF over embeddings | Zero dependencies; works offline; fast startup |
| Greedy insertion over knapsack | Simpler, deterministic, near-optimal for ranked items |
| Symbol before files | Primes model attention on key definitions before full source |
| 4:1 char:token ratio | Empirically validated across GPT, Claude, and Llama tokenizers |
| Comments stripped last | Preserves readability until budget pressure forces removal |

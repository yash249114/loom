# Agent Orchestration

## Overview

Agent Orchestration ties together the Indexer, Graph Memory, Retrieval Engine, Context Engine, and the Agent itself into a single pipeline. The goal: transform Loom from a session-scoped chat agent into a repository-aware coding workspace.

```
User Prompt
    │
    ▼
┌───────────────────────────────────────────────────┐
│               Orchestrator                         │
│                                                    │
│  1. Route task (classify: coding/reasoning/local)  │
│  2. Build context from memory + graph + retrieval  │
│  3. Assemble system prompt with enriched context   │
│  4. Run agent loop with context                    │
│  5. Extract knowledge from conversation            │
│  6. Persist new knowledge to memory                │
│  7. Update graph if files changed                  │
│                                                    │
└───────────────────────────────────────────────────┘
```

## Context Assembly Pipeline

```
                     User Prompt
                         │
                    ┌────▼────┐
                    │ Router  │ ← classifyTask(prompt)
                    └────┬────┘
                         │ task category
                    ┌────▼────────┐
                    │ Context     │
                    │ Engine v2   │ ← assembleContext(request)
                    └────┬────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         ┌────▼───┐ ┌───▼────┐ ┌───▼──────┐
         │Memory  │ │Graph   │ │Retrieval │
         │Engine  │ │Memory  │ │Engine    │
         └────────┘ └────────┘ └──────────┘
              │          │          │
              └──────────┼──────────┘
                         │ enriched context
                    ┌────▼────┐
                    │ System  │ ← buildSystemPrompt(config, context)
                    │ Prompt  │
                    └────┬────┘
                         │ system prompt + conversation history
                    ┌────▼────┐
                    │  Agent  │ ← agent.run(prompt)
                    │  Loop   │
                    └────┬────┘
                         │ tool calls / responses
                    ┌────▼───────┐
                    │ Knowledge  │ ← extract knowledge from turn
                    │ Extractor  │
                    └────┬───────┘
                         │ observations
                    ┌────▼────────┐
                    │ Memory      │ ← persistObservations()
                    │ Persist     │
                    └─────────────┘
```

## Orchestrator

```typescript
class Orchestrator {
  private graph: WorkspaceGraph
  private memory: LongTermMemory
  private archKB: ArchitectureKB
  private contextEngine: ContextEngine
  private agent: Agent

  async process(prompt: string): Promise<AgentResult> {
    // 1. Route
    const routing = routeTask(prompt, config)

    // 2. Build enriched context
    const ctx = await this.contextEngine.assemble({
      query: prompt,
      workspace: root,
      taskCategory: routing.category,
      maxTokens: config.agent.contextWindow,
    })

    // 3. Create memory-enriched system prompt
    const systemPrompt = buildEnrichedPrompt(ctx)

    // 4. Run agent
    const result = await this.agent.run(prompt, {
      systemPrompt,
      routing,
    })

    // 5. Extract knowledge
    const observations = extractKnowledge(result)

    // 6. Persist
    await this.memory.persist(observations)

    return result
  }
}
```

## Context Engine v2

### assemble() Flow

```
assemble(request: ContextRequest) → ContextPackage

1. LOAD     ← load metadata, recent memories
2. QUERY    ← searchGraph(request.query)
3. RANK     ← score each candidate (relevance × freshness × importance)
4. BUDGET   ← allocate tokens per bucket
5. FILL     ← greedy fill from highest-score candidates
6. BUILD    ← assemble context string
7. COMPRESS ← token-aware compression
```

### Scoring Function

```
score(item) = relevance × 0.5 + freshness × 0.2 + importance × 0.3

relevance  = TF-IDF cosine similarity between query and item text
freshness  = 1.0 - (days since modified) / 365  (decays over a year)
importance = in_degree / max_in_degree (normalized PageRank-like score)
```

### Budget Buckets

| Bucket | Default % | Min | Max | Content |
|--------|-----------|-----|-----|---------|
| `system` | 3% | 500 | 1000 | System prompt base |
| `identity` | 1% | 200 | 500 | Workspace identity |
| `memory` | 15% | 500 | 4000 | Project memory entries |
| `arch` | 5% | 200 | 2000 | Architecture KB entries |
| `symbols` | 10% | 500 | 3000 | Relevant symbol definitions |
| `files` | 20% | 1000 | 8000 | Relevant file contents (truncated) |
| `deps` | 5% | 200 | 2000 | Dependency relationships |
| `tools` | 10% | 500 | 2000 | Tool schemas |
| `history` | 31% | 2000 | remaining | Conversation history |

## Knowledge Extraction

After each agent turn, the Knowledge Extractor analyzes the conversation to extract:

1. **Architecture decisions**: "We decided to use Zustand for state management because..."
2. **Code patterns**: "All API routes follow this pattern: validate → authorize → execute → respond"
3. **File relationships**: "The UserService depends on DatabaseService for persistence"
4. **Conventions**: "We prefix private methods with `_`"
5. **Rationale**: "We chose React Query over SWR because of its mutation API"

### Extraction Format

```typescript
interface Observation {
  id: string
  type: 'decision' | 'pattern' | 'relationship' | 'convention' | 'fact'
  content: string
  confidence: number    // 0.0 - 1.0
  importance: number    // 0.0 - 1.0
  files: string[]       // related file paths
  symbols: string[]     // related symbol IDs
  timestamp: number
  sessionId: string
}
```

### Deduplication

Before persisting, new observations are deduplicated against existing ones:

1. Compute Jaccard similarity on file sets
2. Compute text similarity (Levenshtein ratio) on content
3. If similarity > 0.8, merge instead of insert
4. Merged entries keep max(all timestamps) and max(all confidence scores)

## Large Repository Strategy

### 100k+ File Scaling

| Scale | Scan Strategy | Parsing | Graph | Retrieval |
|-------|--------------|---------|-------|-----------|
| 1k files | Full scan | Synchronous | Full in-memory | TF-IDF across all |
| 5k files | Full scan | Batch (50 at a time) | Full in-memory | TF-IDF across all |
| 10k files | Full scan | Batch (100 at a time) | Lazy-load on query | Indexed TF-IDF |
| 100k+ files | Glob patterns | Streaming pipeline | On-disk query | Sharded retriever |

### Streaming Indexer

For >10k files, the indexer switches to streaming mode:

1. **Glob discovery**: find all relevant files using fast-glob (already batched)
2. **Parallel parse**: worker pool (configurable, default 4) parses files concurrently
3. **Streaming write**: results written to NDJSON as they complete (never held fully in memory)
4. **Lazy graph**: adjacency built on demand from deps.ndjson (never full join in memory)
5. **On-disk queries**: symbol search uses the NDJSON files directly (seek + scan, no full load)

### Sharded Symbol Search

For >10k symbols, the symbol index is sharded by first letter + language:

```
.loom/graph/symbols/
  ts-a.ndjson
  ts-b.ndjson
  ...
  py-c.ndjson
  go-m.ndjson
```

Queries route to the relevant shard(s) based on the query prefix and language filter.

### Memory Budget Scaling

| Repo Size | Context Budget | Graph Memory | Retriever Top-K |
|-----------|---------------|--------------|-----------------|
| 1k files | 16K tokens | < 10 MB | 20 |
| 5k files | 24K tokens | < 50 MB | 30 |
| 10k files | 32K tokens | < 100 MB | 40 |
| 100k+ files | 48K tokens | < 500 MB on disk | 50 (streaming) |

## Agent Integration

The existing `Agent` class is enhanced with:

```typescript
class Agent {
  private contextEngine: ContextEngine
  private memoryStore: LongTermMemory

  async run(prompt: string, opts?: { systemPrompt?: string }) {
    // Build enriched context
    const ctx = await this.contextEngine.assemble({
      query: prompt,
      workspace: this.workspaceRoot,
      maxTokens: this.config.agent.contextWindow,
    })

    // Inject into system prompt
    const systemPrompt = opts.systemPrompt ?? this.buildEnrichedPrompt(ctx)

    // Proceed with enriched prompt
    await this.runWithPrompt(prompt, systemPrompt)

    // Extract knowledge
    const observations = extractKnowledge(this.history)
    await this.memoryStore.persist(observations)
  }
}
```

## CLI Integration

New commands:

```
loom graph       ← Show graph statistics
loom memory      ← Show memory statistics and recent entries  
loom arch        ← Show architecture knowledge base
loom context     ← Show what context would be assembled for a query
```

The existing `loom index` command is enhanced to also build workspace graph and initialize memory.

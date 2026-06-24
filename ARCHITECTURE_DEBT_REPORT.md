# Architecture Debt Report

**Generated:** 2026-06-24
**Scope:** All 120+ source files in `src/`, `tests/`
**Method:** 4 parallel exploration agents + automated metrics

---

## Executive Summary

Loom is a 14,537-line TypeScript codebase (106 source files, 162 test files, 27,050 test lines) with a 186% test-to-source ratio. The architecture is modular by directory but suffers from god classes, triple-duplicate type systems, redundant abstractions, and significant dead code. Total estimated remediation: **18–25 hours**.

| Metric | Value |
|---|---|
| Source files | 106 |
| Source lines | 14,537 |
| Test files | 162 |
| Test lines | 27,050 |
| Test/source ratio | 186% |
| Files ≥200 lines | 21 |
| Files ≥400 lines | 5 |
| God classes identified | 5 |
| Unused exports | 103 |
| Direct circular deps | 0 |
| Duplicate type systems | 3 |
| Redundant abstractions | 2 |
| Memory leaks | 1 |

---

## 1. God Classes (Critical)

### 1.1 `src/core/loom.ts` — 776 lines
**Severity:** Critical
**Root cause:** Accumulation of orchestration logic, event handling, state management, and view coordination over time without refactoring.
**Responsibilities:**
- Application lifecycle (init, start, stop, restart)
- Event bus management
- Provider orchestration
- State management
- View coordination
- Signal handling
- Error recovery
- Config loading

**Refactor plan:**
1. Extract `LoomOrchestrator` — lifecycle + provider orchestration (~200 lines)
2. Extract `LoomStateManager` — state + event coordination (~150 lines)
3. Extract `LoomErrorHandler` — error recovery + signal handling (~100 lines)
4. Keep `Loom` class as thin facade (~150 lines)

**Estimated fix time: 4–5 hours**

### 1.2 `src/agent/agent.ts` — 424 lines
**Severity:** Critical
**Root cause:** The `Agent` class grew organically as tool calling, fallback routing, verification, and history management were added to the same class.
**Responsibilities:**
- Provider streaming (direct streaming + fallback chain logic)
- Task routing (skipRouting path + primary fallback path)
- Tool call accumulation (OpenAI delta aggregation)
- Tool execution (registry execution, result formatting)
- Verification (triggering, retries, auto-correction loop)
- History management (compactHistory, push, trim)
- Abort control (AbortController)

**Refactor plan:**
1. Extract `StreamManager` — handles provider streaming + fallback chains (~120 lines)
2. Extract `ToolExecutionEngine` — tool call accumulation, execution, result formatting (~100 lines)
3. Extract `HistoryManager` — message push, compact, trim (~50 lines)
4. Extract `VerificationOrchestrator` — trigger, retry, auto-correct (~60 lines)
5. Keep `Agent` as coordinator calling these components (~100 lines)

**Estimated fix time: 3–4 hours**

### 1.3 `src/core/renderer.ts` — 411 lines
**Severity:** High
**Root cause:** Renderer handles both the rendering engine and input/terminal setup — two distinct concerns.
**Responsibilities:**
- Package-level rendering (`ink` re-export)
- Theme management
- Input setup (stdin raw mode, resize handlers)
- Terminal initialization
- Output rendering

**Refactor plan:**
1. Extract `TerminalManager` — stdin setup, raw mode, resize handlers, cleanup (~100 lines)
2. Extract `ThemeEngine` — theme loading, caching, resolution (~80 lines)
3. Keep `Renderer` focused on ink-based rendering coordination (~150 lines)

**Estimated fix time: 2 hours**

### 1.4 `src/cli/index.ts` — 399 lines
**Severity:** High
**Root cause:** All CLI commands handled in a single file with inlined orchestration.
**Responsibilities:**
- 10+ command handler implementations
- Config loading and merging
- Provider discovery and health checks
- Repository indexing invocation
- Agent execution
- TUI bootstrap

**Refactor plan:**
1. Extract each major command to `src/cli/commands/` dir:
   - `dev.ts` (~50 lines)
   - `start.ts` (~60 lines)
   - `index.ts` (~30 lines)
   - `status.ts` (~30 lines)
   - `config.ts` (~40 lines)
2. Keep `src/cli/index.ts` as command registration + dispatcher (~100 lines)

**Estimated fix time: 2–3 hours**

### 1.5 `src/memory/cli.ts` — 398 lines
**Severity:** High
**Root cause:** Memory module CLI was implemented as a monolith with 15 subcommands.
**Responsibilities:**
- `graph` subcommand (init, import, export, stats, path, neighbors, visualize)
- `observe`/`mem` subcommand
- `arch` subcommand (add, list, detect)
- `context` subcommand (build, stream)
- `pipeline` subcommand (run, status)
- All output formatting and error handling inlined

**Refactor plan:**
1. Extract to `src/memory/cli/` with separate files per subcommand group:
   - `graph-cmds.ts` (~120 lines)
   - `mem-cmds.ts` (~50 lines)
   - `arch-cmds.ts` (~80 lines)
   - `context-cmds.ts` (~60 lines)
   - `pipeline-cmds.ts` (~50 lines)
   - Keep main CLI as dispatcher (~40 lines)

**Estimated fix time: 2 hours**

---

## 2. Triple-Duplicate Type Systems (Critical)

### 2.1 `Language` type — 3 definitions
| Location | Line count | Values |
|---|---|---|
| `src/indexer/tree-sitter.ts:10` | 4 | `javascript`, `typescript`, `python`, `go` |
| `src/repository/types.ts:65` | 13 | all lowercase, implementation-specific |
| `src/retrieval/types.ts:41` | 9 | has `graphql` not in repository |

**Impact:** Type casts between modules, potential runtime mismatches when one module sees a language the other doesn't recognize.

### 2.2 `Symbol` / `SymbolKind` — 3 definitions
- `src/indexer/types.ts`: `Symbol` with `name`, `kind` (4 values)
- `src/repository/types.ts`: `Symbol` with `name`, `kind` (13 values), `filePath`, `line`, `column`
- `src/retrieval/types.ts`: `Symbol` with `name`, `kind` (7 values), `file`, `line`, `column`

**Impact:** Data shape mismatches require manual mapping between layers. No unified identity.

### 2.3 `Dependency` — 3 definitions
- `src/indexer/types.ts`: Source-target-string
- `src/repository/types.ts`: Source-target-type
- `src/retrieval/types.ts`: Source-target-weight

**Impact:** Dependency analysis results cannot be directly passed between modules.

### 2.4 `ContextPackage` — 2 definitions
- `src/retrieval/types.ts`: `ContextPackage` with `content`, `tokens`
- `src/memory/types.ts`: `ContextPackage` bridge with `id`, `content`, `tokens`, `source`, `relevance`

**Impact:** Memory module's richer `ContextPackage` must be constructed from retrieval's simpler version.

### 2.5 Refactor plan (unified):

**Estimated fix time: 4–6 hours**

1. Create `src/shared/types.ts`:
   - `Language` — unified enum covering all 13+ values
   - `Symbol` — union of all fields with optional extras
   - `Dependency` — unified with source, target, type, weight
   - `ContextPackage` — the rich memory version
   - `ContextRequest` — the rich memory version
2. Re-export from each module's `types.ts` for backward compatibility
3. Remove duplicate definitions incrementally
4. Run full test suite after each removal

---

## 3. Redundant Abstractions (High)

### 3.1 `src/core/dashboard-data.ts` (252 lines) vs `src/memory/intelligence-api.ts` (206 lines)
**Severity:** High
**Root cause:** Two separate implementations of essentially the same concept — dashboard stats — emerged independently.
**Comparison:**

| Aspect | `dashboard-data.ts` | `intelligence-api.ts` |
|---|---|---|
| Types | `IndexMetrics`, `AgentInfo`, `ActivityItem`, `SystemComponent` | `FileStats`, `SymbolStats`, `DependencyStats`, `MemoryStats`, `TokenBudgetStats`, `DashboardStats` |
| Design | Static data shapes + mock data | Class-based with `subscribe()`, `startAutoRefresh()`, event hooks |
| Used by | UI components (before memory integration) | AppContext → views (after memory integration) |

**Refactor plan:**
1. Keep `intelligence-api.ts` as the single source of truth (it has live update)
2. Either delete `dashboard-data.ts` or re-export from `intelligence-api.ts`
3. Update any remaining references to use `RepositoryIntelligence`

**Estimated fix time: 1 hour**

### 3.2 Provider abstraction fragmentation
**Severity:** Medium
**Root cause:** Provider logic is split across 6 files in `src/providers/` with overlapping concerns.

| File | Lines | Responsibility | Overlap |
|---|---|---|---|
| `discovery.ts` | 267 | Finding available providers | — |
| `connect.ts` | 278 | Interactive connection wizard | Overlaps with discovery |
| `health.ts` | 193 | Health checking | Related to router |
| `router.ts` | 200 | Task routing | Related to chain |
| `chain.ts` | 147 | Fallback chains | Related to router |
| `mcp.ts` | 215 | MCP protocol | Overlaps with discovery |
| `cache.ts` | 80 | Provider response caching | Independent |
| `capabilities.ts` | 68 | Capability definitions | Independent |

**Refactor plan:**
1. Merge `router.ts` + `chain.ts` → `routing.ts` (single routing abstraction)
2. Keep `discovery.ts` + `connect.ts` separate but clarify boundary (discovery finds, connect configures)
3. Keep `mcp.ts`, `health.ts`, `cache.ts`, `capabilities.ts` as-is

**Estimated fix time: 2 hours**

---

## 4. Dead Code & Unused Exports (Medium)

### 4.1 Summary
**103 unused exports** across the codebase. Major contributors:

| File | Unused exports | Estimated dead code |
|---|---|---|
| `src/config/schema.ts` | 8 | 120 lines |
| `src/memory/intelligence-api.ts` | 7 | 100 lines |
| `src/providers/` (various) | 23 | 350 lines |
| `src/core/dashboard-data.ts` | 4 | 80 lines |
| `src/chaos/ChaosTestHarness.ts` | 6 | 90 lines |
| `src/uichaos/UiTestHarness.ts` | 5 | 70 lines |
| Remaining | 50 | ~400 lines |

**Estimated total dead code: ~1,200 lines (8% of codebase)**

### 4.2 Notable dead items
- `MemoryConfig` + `DEFAULT_MEMORY_CONFIG` in `memory/types.ts` — never imported anywhere
- `MemoryComponent` type + `computeBudget()` in `memory/types.ts` — standalone dead functions
- `intelligence-store.ts` — singleton created but never consumed (views use `AppContext` instead)
- `PipelineConfig`, `PipelineStats` in `memory/pipeline.ts` — exported but unused
- `IntelligentRouter`, `TaskCategory`, `ClassificationResult` in `providers/router.ts` — presumably planned features never wired up

### 4.3 Refactor plan
1. Remove all `export` keywords from dead exports (let tree-shaking handle it for now)
2. Delete `intelligence-store.ts` (2 KB, dead code)
3. Consider deleting `src/config/schema.ts` schemas that have zero usage
4. Prune `src/chaos/` and `src/uichaos/` unused types

**Estimated fix time: 1.5 hours**

---

## 5. SRP Violations & Large Files (Medium)

### 5.1 All files ≥200 lines

| File | Lines | Concerns |
|---|---|---|
| `src/core/loom.ts` | 776 | 6+ concerns (see §1.1) |
| `src/agent/agent.ts` | 424 | 6 concerns (see §1.2) |
| `src/core/renderer.ts` | 411 | 3 concerns (see §1.3) |
| `src/cli/index.ts` | 399 | 6+ concerns (see §1.4) |
| `src/memory/cli.ts` | 398 | 15 subcommands (see §1.5) |
| `src/indexer/parse.ts` | 383 | Tree-sitter parsing + all language parsers |
| `src/memory/context-engine.ts` | 348 | Budget allocation + assembly + streaming |
| `src/memory/workspace-graph.ts` | 343 | Graph CRUD + NDJSON persistence + traversal |
| `src/indexer/indexer.ts` | 342 | File walking + parsing dispatch + caching |
| `src/components/ProviderManager.tsx` | 328 | UI + state + provider operations |
| `src/providers/connect.ts` | 278 | Interactive wizard + provider config |
| `src/providers/discovery.ts` | 267 | Provider scanning + environment detection |
| `src/core/dashboard-data.ts` | 252 | Static data + mock providers (see §3.1) |
| `src/memory/project-memory.ts` | 245 | Observation + ADR storage + dedup |
| `src/repository/indexer.ts` | 237 | Repository indexing + scoring |
| `src/memory/types.ts` | 237 | Type bridge + config + utilities |
| `src/core/types.ts` | 232 | Core types + event types + provider types |
| `src/providers/mcp.ts` | 215 | MCP protocol + scoring + routing |
| `src/memory/arch-knowledge.ts` | 210 | ADR CRUD + pattern detection |
| `src/memory/intelligence-api.ts` | 206 | Stats + subscriptions (see §3.1) |
| `src/repository/graph-builder.ts` | 201 | Graph building + edge detection |

### 5.2 Refactor priorities (non-god-class files)
1. `src/indexer/parse.ts` (383 lines) — split language parsers into `src/indexer/parsers/` dir
2. `src/memory/context-engine.ts` (348 lines) — extract budget allocator and streaming output
3. `src/memory/workspace-graph.ts` (343 lines) — extract persistence layer
4. `src/indexer/indexer.ts` (342 lines) — extract file walker and caching
5. `src/components/ProviderManager.tsx` (328 lines) — extract subcomponents

**Estimated fix time: 4 hours**

---

## 6. Memory Leaks (High)

### 6.1 `StateManager.setupResizeHandler()` — no cleanup
**Location:** `src/core/renderer.ts` (inside StateManager class)
**Code:**
```typescript
private setupResizeHandler() {
  process.stdout.on('resize', () => { this.handleResize(); });
}
```
**Problem:** `on('resize')` registers a listener but `setupResizeHandler` is called every time the renderer starts. If `StateManager` is ever replaced or the renderer restarts, the old listener is never removed via `process.stdout.off('resize', ...)`.

**Fix:**
```typescript
private resizeHandler: (() => void) | null = null;

private setupResizeHandler() {
  this.cleanupResizeHandler(); // remove old one first
  this.resizeHandler = () => { this.handleResize(); };
  process.stdout.on('resize', this.resizeHandler);
}

private cleanupResizeHandler() {
  if (this.resizeHandler) {
    process.stdout.off('resize', this.resizeHandler);
    this.resizeHandler = null;
  }
}
```

**Estimated fix time: 15 minutes**

---

## 7. Event System Concerns (Medium)

### 7.1 Central event bus vs. direct coupling
**Observation:** `src/core/events.ts` defines a central `EventBus`, but many modules communicate through direct method calls or custom emitters rather than events:
- `Agent` extends `TypedEmitter` directly (`src/agent/agent.ts`)
- `MemoryPipeline` emits events but also calls `intelligence.markDirty()` directly
- `RepositoryIntelligence` subscribes to `MemoryPipeline` events but also calls methods directly

**Risk:** No single communication pattern — some interactions use events (loose coupling), others use direct calls (tight coupling). This makes it harder to swap implementations or test in isolation.

**Recommendation:** Adopt a consistent event-driven pattern for cross-module communication. Start with a documented convention, not a rewrite.

**Estimated fix time: 1 hour (documentation + convention enforcement)**

---

## 8. Test Health (Info)

| Metric | Value |
|---|---|
| Total tests | 313 passed / 1 failed |
| Failing test | `tests/unit/routing-edge-cases.test.ts` (pre-existing) |
| Test-to-source ratio | 186% |
| Skip/pending markers | 5 |

The test suite is healthy overall. The single pre-existing failure in `routing-edge-cases.test.ts` should be investigated.

---

## 9. Recommended Fix Order

| Priority | Task | Est. Time | Risk | Value |
|---|---|---|---|---|
| 1 | Fix memory leak in `StateManager` | 15 min | Low | Stops resource leak |
| 2 | Prune dead exports (103 unused) | 1.5 hr | Low | Reduces codebase by ~8% |
| 3 | Delete `dashboard-data.ts` in favor of `intelligence-api.ts` | 1 hr | Low | Eliminates duplicate system |
| 4 | Refactor `cli/index.ts` → commands/ | 2–3 hr | Medium | Improves CLI maintainability |
| 5 | Refactor `memory/cli.ts` → cli/ | 2 hr | Medium | Improves memory CLI |
| 6 | Refactor `renderer.ts` (extract TerminalManager + ThemeEngine) | 2 hr | Medium | Improves TUI architecture |
| 7 | Refactor `agent.ts` (extract 4 components) | 3–4 hr | High | Most impactful refactor |
| 8 | Refactor `loom.ts` (extract 3 components) | 4–5 hr | High | Largest file tamed |
| 9 | Create shared type system (`src/shared/types.ts`) | 4–6 hr | High | Eliminates type duplication |
| 10 | Consolidate provider modules (router + chain) | 2 hr | Medium | Reduces fragmentation |

**Total estimated fix time: 22–28 hours**

Critical path (items 1–3): ~3 hours — can be done incrementally without breaking tests.
Major refactors (items 4–9): ~19–25 hours — requires coordinated effort and full test pass.

---

## 10. Codebase Health Score

| Category | Score (1–10) | Notes |
|---|---|---|
| Test coverage | 8 | 186% ratio, 1 pre-existing failure |
| Modularity | 5 | Good directory separation but god classes inside |
| Type safety | 6 | 3 duplicate type systems cause casts |
| Dead code | 4 | 8% of codebase is unused |
| SRP compliance | 4 | 21 files ≥200 lines, 5 god classes |
| Consistency | 5 | Mixed event/direct communication patterns |
| Dependency graph | 8 | No circular dependencies detected |
| **Overall** | **5.7** | Solid foundation with significant technical debt |

---

*Report generated by automated analysis. All findings should be verified before acting on refactor plans.*

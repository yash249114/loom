# Architecture Audit: Loom

**Date:** 2026-06-22  
**Auditor:** Chief Architect  
**Version:** 0.1.0  

---

## Executive Summary

Loom is a local-first AI coding agent CLI with a modular architecture spanning 12 source modules. The codebase is well-structured for a v0.1.0 but exhibits significant architectural anti-patterns, incomplete abstractions, and missing production-grade orchestration. The overall architecture is reasonable for a prototype but requires substantial hardening before it can be considered production-ready.

---

## 1. Overall Architecture

### 1.1 Module Map

```
src/
├── index.ts          → Public API re-exports
├── agent/            → Core agent loop, routing, parsing, prompting, verification
├── cli/              → CLI entry point (Commander)
├── config/           → Config loading, schema, defaults
├── core/             → Types, events, utilities, retry, schema conversion
├── memory/           → Persisted memory store
├── plugins/          → Dynamic plugin loading
├── providers/        → OpenAI, Ollama provider implementations
├── safety/           → Safety gate for confirmations
├── session/          → Session persistence (lowdb)
├── tools/            → Tool definitions (file, shell, search, registry)
├── tui/              → React/Ink terminal UI
└── workspace/        → Workspace layout & context
```

**Architecture Pattern:** Layered with event-driven agent loop. CLI/TUI → Agent → Providers + Tools. Config is loaded at startup and passed through.

### 1.2 Critiques

| Area | Rating | Issues |
|------|--------|--------|
| Module Cohesion | B | Clean separation of concerns, but plugins & memory are underdeveloped |
| Dependency Flow | B- | Config is passed as a raw object through the entire depth — no DI or IoC |
| Abstraction Completeness | C+ | Provider interface is clean; tool system well-factored; session/persistence leaky |
| Error Handling | C | Inconsistent: some places throw, some return `ok` flags, some swallow silently |
| Testing Structure | B | Good test harness, unit + integration + QA separation, but coverage gaps |
| Config Management | C- | Deep merge is broken at type level; env interpolation is naive |

---

## 2. Critical Architecture Issues

### C-1. Config is a God Object (HIGH)

`LoomConfig` is a monolithic interface (18 fields) that is passed as a single argument to virtually every constructor and function. This creates:
- **Tight coupling** between all modules and the config shape
- **Impossible to test** a module without constructing an entire `LoomConfig`
- **No isolation** — agent loop depends on config that controls entirely unrelated subsystems

**File:** `src/core/types.ts:126-138`

**Fix:** Decompose into domain-specific config slices. Inject only what each module needs.

### C-2. Agent Orchestration is a Monolithic Class (HIGH)

`Agent` class does everything: routing, fallback chains, streaming, tool execution, verification, history management. At 468 lines, this single class violates SRP catastrophically.

**File:** `src/agent/agent.ts:44-468`

**Fix:** Split into:
- `AgentLoop` — orchestrates turns
- `HistoryManager` — manages message history + compaction
- `ToolExecutor` — runs tool calls, handles results
- `FallbackHandler` — manages provider fallback chain

### C-3. Event System Leaks (MEDIUM)

`TypedEmitter` extends Node.js `EventEmitter` but exposes actual `on`/`off` which bypasses the type-safe `onTyped`/`offTyped`. The base class `EventEmitter` methods are still public and untyped. No event namespacing, no cleanup guarantees.

**File:** `src/core/events.ts:16-26`

**Fix:** Inherit from an `EventTarget`-like abstraction, do not expose non-typed methods, or at minimum override `on`/`off` to warn.

### C-4. Routing Architecture is a Keyword Matcher (MEDIUM)

`classifyTask()` uses regex word-counting against two hardcoded lists. This is fragile, non-extensible, and has no ML or semantic component. A prompt like "write a review of this design" would be ambiguous. No user-configurable routing rules.

**File:** `src/agent/router.ts:7-11,16-25`

**Fix:** Make routing pluggable — allow custom classifiers, model selection rules, or delegation to an LLM call for ambiguous cases.

### C-5. Provider Factory Does Not Use Registration (MEDIUM)

`createProvider` uses a hardcoded switch statement. Adding a new provider type requires modifying the factory. No provider discovery mechanism.

**File:** `src/providers/factory.ts:8-17`

**Fix:** Use a provider registry pattern where providers register themselves by type string.

---

## 3. CLI Architecture Audit

### 3.1 Findings

| Aspect | Rating | Detail |
|--------|--------|--------|
| Command Structure | B | Clean Commander setup, 4 commands (init, config, sessions, run) |
| Option Handling | B | Provider, yes, local flags properly forwarded |
| Non-interactive Support | B+ | `run` command works for automation |
| Error Output | C | Errors go to console.error via logger but exit codes inconsistent |
| TTY Detection | B | `startTUI` correctly checks `process.stdin.isTTY` |

### 3.2 Issues

- **CLI-1:** All commands share the same error handler at `program.parseAsync().catch()` which logs `e?.message` — losing stack traces entirely. **(MEDIUM)**
- **CLI-2:** `readYesNo()` reads from stdin without raw mode — will not work properly in all terminal environments (e.g., Windows PowerShell). **(LOW)**
- **CLI-3:** The `run` command does not save sessions; only the `chat` TUI does. Inconsistent persistence model. **(LOW)**
- **CLI-4:** No `--json` output flag for machine-readable output (important for CI integration). **(LOW)**

---

## 4. Provider Architecture

### 4.1 Provider Interface

The `Provider` interface (`src/core/types.ts:69-74`) is clean and minimal:
```typescript
interface Provider {
  name: string;
  model: string;
  supportsNativeTools: boolean;
  stream(req: ProviderRequest): AsyncIterable<ProviderStreamChunk>;
}
```

### 4.2 Issues

- **PROV-1:** `OllamaProvider` does **not** use `withRetry` — only `OpenAIProvider` has retry logic. Inconsistent resilience. **(HIGH)**
- **PROV-2:** `OllamaProvider` leaks the API key concept (`ProviderConfig.apiKey`) in its constructor signature even though it ignores it. **(LOW)**
- **PROV-3:** `createRoutedProvider` constructs providers with hardcoded endpoint defaults if `providerEndpoints` is not configured. This silently falls back to `http://127.0.0.1:11434` for Ollama and `https://openrouter.ai/api/v1` for OpenRouter. **(MEDIUM)**
- **PROV-4:** The `supportsNativeTools` flag is set to `true` for both providers, but the fallback path still has complete text-fence parsing. This dual-path adds complexity. **(LOW)**
- **PROV-5:** No provider health check / ping method. The system cannot verify a provider is reachable before attempting a stream. **(MEDIUM)**

---

## 5. Session Architecture

### 5.1 Issues

- **SESS-1:** `SessionStore.load()` is called on every operation — O(n) read of the entire JSON file for every list/get/create/update/delete. No in-memory cache. **(HIGH)**
- **SESS-2:** Full message history is stored and read from disk on every operation, including tool call results and error messages. This grows unbounded and will cause significant latency for long sessions. **(HIGH)**
- **SESS-3:** `lowdb` (JSON file) as the database engine provides no concurrency safety. Two concurrent CLI instances could corrupt the sessions file. **(MEDIUM)**
- **SESS-4:** Session `update()` stores raw `Message` objects including `timestamp` but reconstructs `id` on each save — `(m as any).id ?? newId("msg")`. This may change message IDs on every write if the original lacked an `id`. **(MEDIUM)**

---

## 6. Tool System Architecture

### 6.1 Issues

- **TOOL-1:** Registry `describe()` returns a simple list — no grouping, no danger-level indicators, no parameter detail. **(LOW)**
- **TOOL-2:** Tool execution in `agent.ts:254-268` catches all errors and converts them to `ToolResult` with `ok: false`. This means tool errors are silently recovered and fed back to the model, which can cause infinite loops of the model retrying the same failing tool. **(MEDIUM)**
- **TOOL-3:** The `shell` tool (`shell-tool.ts:43-48`) uses `shell: true` with `execa`, passing a user-provided string directly to the shell. While blocked commands and confirmation are checked, this is a fundamentally dangerous pattern. **(MEDIUM)**
- **TOOL-4:** The `searchfiles` tool ignores `.loom/` directory but does expose `.loom/` files through `readfile` and `writefile` — the agent can read and write its own config and memory. This is a self-referential integrity risk. **(MEDIUM)**

---

## 7. Plugin Architecture

### 7.1 Issues

- **PLUG-1:** Plugin loading uses `import()` with `pathToFileURL` — this is fundamentally synchronous but the loader wraps it in an async loop. Good. But plugins are loaded from `.js`/`.mjs` files only — no TypeScript, no package.json, no dependency resolution. **(LOW)**
- **PLUG-2:** Plugin errors are swallowed with `console.error` — no structured error reporting back to the system. **(LOW)**
- **PLUG-3:** Home directory plugins (`~/.loom/plugins`) are loaded alongside workspace plugins — no isolation, no security boundary. A malicious plugin in home directory affects all workspaces. **(MEDIUM)**
- **PLUG-4:** No plugin manifest, no versioning, no permissions system. Any plugin can register any tool including dangerous shell tools. **(MEDIUM)**

---

## 8. Configuration Architecture

### 8.1 Issues

- **CFG-1:** `deepMerge` is typed incorrectly (`src/config/loader.ts:9`). The `Record<string, any>` constraint breaks TypeScript's structural typing. The test `cli-global-install.test.ts:23` confirms the build is **BROKEN** with TS2862. **(CRITICAL — BUILD IS BROKEN)**
- **CFG-2:** `interpolateEnv` replaces `${VAR}` patterns but silently converts missing variables to empty strings (`process.env[name] ?? ""`). No warning when an expected env var is missing. **(MEDIUM)**
- **CFG-3:** `interpolateEnv` operates on the raw parsed JSON (before schema validation), so env vars used in unexpected positions (e.g., inside integer fields) would silently break. **(MEDIUM)**
- **CFG-4:** Config file discovery (`findConfigPath`) searches workspace-specific files before home-directory files — but does not merge them. Users cannot have a base config in `~/.loom/config.json` and override it per-workspace. **(LOW)**

---

## 9. Verdict by Layer

| Layer | Verdict | Notes |
|-------|---------|-------|
| Agent Loop | ❌ **Unsafe for production** | God class, no concurrency, no state machine |
| CLI | ⚠️ **Functional but brittle** | Works for basic use, missing CI primitives |
| Providers | ⚠️ **Needs hardening** | Inconsistent retry, no health checks |
| Tools | ⚠️ **Mostly sound** | Path traversal protected, but self-referential risks |
| Session | ❌ **Not scalable** | Full JSON rewrite on every op, no caching |
| Config | ❌ **Broken** | Type error in `deepMerge` breaks `tsc` build |
| Safety | ⚠️ **Adequate** | Could be bypassed via `setAlwaysAllow` programmatically |
| Workspace | ✅ **Well-factored** | Clean layout, context reading |
| Plugins | ❌ **No security model** | Full trust, no isolation |
| Memory | ⚠️ **Stub-level** | 38 lines, no search or indexing |

---

## 10. Recommended Fix Priority

1. **(P0)** Fix `deepMerge` type error — build is broken
2. **(P0)** Add retry logic to `OllamaProvider`
3. **(P1)** Decompose `Agent` class into focused components
4. **(P1)** Add in-memory caching to `SessionStore`
5. **(P1)** Add provider health checks
6. **(P2)** Implement config slice injection instead of god object
7. **(P2)** Plugin security isolation (manifest, permissions)
8. **(P3)** Pluggable routing classifiers
9. **(P3)** Provider registration pattern
10. **(P3)** JSON output mode for CLI

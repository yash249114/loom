# Scalability Audit: Loom

**Date:** 2026-06-22  
**Auditor:** Chief Architect  
**Version:** 0.1.0  

---

## Executive Summary

Loom is designed as a local-first single-user CLI tool. Scalability concerns primarily revolve around memory growth, context window management, large repository support, and I/O patterns on session persistence. The codebase has no distributed architecture, no caching layer, and no streaming-to-disk for large payloads. For the target use case (single-user, local workstation), many concerns are acceptable — but several will cause user-facing degradation even at moderate scale.

**Overall Scalability Posture:** ⚠️ **Functional for small projects** — will degrade significantly on repos >10k files or sessions >500 messages.

---

## 1. Memory Architecture

### 1.1 Finding: Unbounded History Growth (CRITICAL)

`src/agent/agent.ts:45` — `history: Message[]` grows unboundedly across agent turns. Every turn adds at least 2 messages (user + assistant). Each tool call adds additional messages for tool results. For a session with 25 iterations and 10 tool calls per turn, this results in ~250+ messages in the history array.

```typescript
readonly history: Message[] = [];
```

**Impact:**
- Memory: Each message contains full tool call arguments, file content results, and error messages. A 25-iteration session with file reads could consume 10-50MB in memory for the history array alone.
- Context window: `compactHistory()` only kicks in at >60 messages, but by then the token count may already exceed provider context windows.
- Session persistence: Full history is serialized to JSON on every `session.update()`.

**Files:** `src/agent/agent.ts:45, src/session/store.ts:65-80`

**Fix:** 
- Implement token-count-aware truncation (not just message-count-based)
- Track approximate token count per message
- Prune tool results aggressively (keep only the content, not full output)
- Store large tool results on disk, not in memory

### 1.2 Finding: No Streaming-to-Disk for Large Files (HIGH)

`src/tools/file-tools.ts:30` — `readFile` loads the entire file into memory:

```typescript
const content = await fs.readFile(abs, "utf8");
return truncate(content, maxBytes);
```

While `truncate` limits output to 200KB by default, the file is still fully read into memory. For a 500MB file, this would:
- Consume 500MB+ of Node.js heap (strings are UTF-16 internally, so effectively 2x)
- Block the event loop during read
- Potentially crash on files >1GB

**Fix:** Use `fs.createReadStream` with byte limit, or at minimum use `fs.open` + `fs.read` with a buffer size limit.

### 1.3 Finding: String Accumulation in Streaming (MEDIUM)

`src/agent/agent.ts:117` — `fullText += delta` concatenates streaming deltas into a single string. For long responses (>100K tokens), this creates repeated string allocations:

```typescript
let fullText = "";
...
await this.streamFromProvider(..., (delta) => { fullText += delta; });
```

**Impact:** String concatenation in a loop is O(n²) in JavaScript due to immutability. A 100K token response would allocate ~5GB of intermediate strings before finalization.

**Fix:** Collect deltas in an array and join at the end: `const parts: string[] = []; parts.push(delta); fullText = parts.join("");`

---

## 2. Context Management

### 2.1 Finding: Naive Message Count-Based Truncation (CRITICAL)

`src/agent/agent.ts:407-421` — `compactHistory()` prunes by message count, not by token count:

```typescript
private compactHistory(): Message[] {
  const ctxLimit = 60;
  if (this.history.length <= ctxLimit) return [...this.history];
  const head = this.history.slice(0, 2);
  const tail = this.history.slice(-ctxLimit);
  const omitted = this.history.length - head.length - tail.length;
  return [
    ...head,
    { role: "system", content: `[…${omitted} earlier messages omitted…]` },
    ...tail,
  ];
}
```

**Problems:**
1. Token counts vary wildly — a message with `content: "hi"` is 1 token; a message with 30K of tool results is 7500 tokens. Counting messages as equal is meaningless.
2. The context limit is hardcoded at 60 messages — not configurable, not provider-aware.
3. The `config.agent.contextWindow` (default 8192) is stored in config but never used by the compaction logic.
4. After pruning, all messages are sent to the provider — there is no token budget calculation.

**Fix:**
- Implement token estimation (character count / 4 or use a proper tokenizer)
- Track running token count per message
- Prune from the middle (keep system + recent messages)
- Respect the provider's context window from config

### 2.2 Finding: No Per-Provider Context Window Awareness (HIGH)

`src/agent/agent.ts:434-435` — When streaming, all messages are sent without any token budget management:

```typescript
const stream = provider.stream({
  messages: this.compactHistory(),
  systemPrompt,
  ...
});
```

Different models have different context windows (4096, 8192, 128K, 200K). The system never checks whether messages + system prompt + response budget fit within the provider's model limits. This will cause silent truncation by the provider API.

**Fix:** Pass the `contextWindow` from config to a token budget calculator. Prune messages before sending based on estimated token count for the specific model.

---

## 3. Large Repository Support

### 3.1 Finding: Recursive Search Without Limit in listdir (MEDIUM)

`src/tools/file-tools.ts:137-155` — `listDirTool` can recurse up to depth 8 with up to 500 entries. In a monorepo with 50K files, this is acceptable due to the limits, but:

- `.git` and `node_modules` are skipped, but `dist/`, `build/`, `coverage/`, `.next/`, `venv/`, and other large generated directories are NOT excluded.
- The recursion depth limit (8) is arbitrary and may miss files in deeply nested structures.
- No file size awareness — directories with large binary files are still traversed.
- Works on the main thread with `await` per directory — for large recursive listings this could take seconds.

**Fix:** Add configurable ignore patterns. Use `fast-glob` (already a dependency) for directory listing instead of manual recursion.

### 3.2 Finding: searchfiles Scans Everything (MEDIUM)

`src/tools/search-tools.ts:22-56` — The `searchfiles` tool uses `fast-glob` with reasonable defaults (ignores node_modules, .git, dist, .loom) but:

```typescript
const matches = await fg(pattern, {
  cwd: ctx.workspaceRoot,
  ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.loom/**"],
  onlyFiles: true,
  dot: false,
});
```

In a monorepo with 100K+ files:
- Glob matching on 100K files is expensive (1-5 seconds)
- `contains` regex matching reads every matched file — in a repo with 10K source files, this is O(10K file reads)
- 2MB file size skip is good but a directory full of 1.9MB files would still be slow

**Fix:** 
- Add a total file read limit (max 200 files scanned per search)
- Cache glob results when patterns are repeated
- Use ripgrep (or similar) for content search instead of JS regex on each file

### 3.3 Finding: Workspace Context Reads README.md Every Turn (LOW)

`src/workspace/workspace.ts:75-78` — `readWorkspaceContext()` reads `README.md` on every call. This is called per agent turn. The file is cached by the OS but still involves a syscall.

**Fix:** Cache the workspace context string and invalidate when files change.

---

## 4. Session & Persistence

### 4.1 Finding: Full JSON Rewrite on Every Operation (CRITICAL)

`src/session/store.ts` — Every `create`, `update`, `delete` operation:
1. Reads the entire `sessions.json` file from disk
2. Modifies the in-memory array
3. Writes the entire `sessions.json` file back to disk

For a session with 500 messages (typical for a long coding session), this serializes/deserializes ~5-20MB of JSON on every turn. Over 25 turns, that's 125-500MB of disk I/O for session persistence alone.

**Impact:**
- UI stutter on every turn end (write blocks while I/O completes)
- High disk wear for SSDs
- Cannot scale to multiple concurrent sessions

**Fix:**
- Use append-only log format or SQLite instead of JSON file
- At minimum: debounce writes, diff-based updates
- Never serialize full history on every update — only persist deltas

### 4.2 Finding: No Session Pruning or Archival (MEDIUM)

Sessions are stored forever. There is no:
- TTL / expiration policy
- Archival mechanism
- Size-based pruning
- Message-level truncation before save

After 100 coding sessions at 500 messages each, the `sessions.json` file could exceed 1GB.

**Fix:** Implement max session age, max messages per session, and automatic archival of old sessions.

### 4.3 Finding: Memory Store is Append-Only (LOW)

`src/memory/store.ts` — Memory notes grow up to 200 entries, summaries up to 50. No deduplication, no relevance scoring, no search. The entire file is read and written for every note/summary addition.

**Fix:** For the use case (single-user CLI), this is acceptable. Consider indexing for larger scale.

---

## 5. Concurrency

### 5.1 Finding: No Concurrency Model (MEDIUM)

Loom is fundamentally single-threaded (Node.js event loop). There is:
- No parallel tool execution (tools run sequentially in `agent.ts:245-283`)
- No concurrent provider connections
- No background I/O for session persistence
- Worker threads not used for CPU-intensive operations (large file reads, glob matching)

The sequential tool execution is particularly limiting: if the model calls 10 tools, they execute one at a time. For latency-sensitive tasks (e.g., batch file reads), this adds sequential delay.

**Fix:** 
- Add a `parallel: boolean` flag to tool definitions for non-conflicting tools
- Run session persistence on a background interval (debounced)
- For future: worker pool for CPU-intensive searches

### 5.2 Finding: Single-Session Constraint (LOW)

The architecture assumes one session per process. The TUI and CLI both create a single `Agent` instance. There is no support for:
- Multiple workspace agents in one process
- Multi-tenant operation
- Agent forking or sub-agent spawning

**Fix:** Acceptable for the design scope. Note for future: ensure `Agent` class can be instantiated multiple times.

---

## 6. I/O Patterns

### 6.1 Finding: Synchronous File Operations in Main Path (MEDIUM)

`src/config/loader.ts:30` — `fs.existsSync()` is used in `findConfigPath` which is called on every CLI startup:

```typescript
for (const p of candidates) {
  if (fs.existsSync(p)) return p;
}
```

While `existsSync` is fast, it blocks the event loop. Called 4 times on every startup, plus more calls in `workspace.ts` and `plugins/loader.ts`.

**Fix:** Use `fs.promises.access()` for async checks. Minor concern for CLI startup latency.

### 6.2 Finding: No Connection Pooling for Providers (LOW)

Each provider stream creates a new HTTP connection. For long agent sessions with multiple provider switches (fallback chain), this means:
- New TCP connection per failover
- No keep-alive reuse
- DNS resolution on every stream start

**Fix:** Use `fetch` with connection pooling (Node.js 18+ has `keepalive` enabled by default for HTTPS, but verify).

---

## 7. Performance Benchmarks (Estimated)

| Operation | Current | Expected for 100K File Repo | Expected for 500-Message Session |
|-----------|---------|-----------------------------|----------------------------------|
| Config load | <2ms | <2ms | <2ms |
| Session list | 5-50ms | 5-50ms | 200-1000ms |
| Session update | 5-50ms | 5-50ms | 200-1000ms |
| Full file read (200KB) | 2-5ms | 2-5ms | 2-5ms |
| File search (glob) | 10-200ms | 1-5s | 1-5s |
| File search (content) | 50-500ms | 5-30s | 5-30s |
| Dir listing (recursive) | 10-100ms | 1-5s | 1-5s |
| Context compaction | <1ms | <1ms | <1ms (but token-inaccurate) |
| Memory note write | 2-10ms | 2-10ms | 2-10ms |
| Plugin load (10 plugins) | 50-200ms | 50-200ms | 50-200ms |

---

## 8. Scalability Findings Summary

| ID | Finding | Severity | File:Line |
|----|---------|----------|-----------|
| SC-1 | Unbounded history growth | **CRITICAL** | `src/agent/agent.ts:45` |
| SC-2 | Naive message-count-based compaction | **CRITICAL** | `src/agent/agent.ts:407` |
| SC-3 | Full JSON rewrite on every session op | **CRITICAL** | `src/session/store.ts` |
| SC-4 | No token budget management | **HIGH** | `src/agent/agent.ts:434` |
| SC-5 | Full file loads into memory | **HIGH** | `src/tools/file-tools.ts:30` |
| SC-6 | String concatenation in streaming loop | **MEDIUM** | `src/agent/agent.ts:117` |
| SC-7 | No parallel tool execution | **MEDIUM** | `src/agent/agent.ts:245` |
| SC-8 | Recursive listdir misses many patterns | **MEDIUM** | `src/tools/file-tools.ts:140` |
| SC-9 | searchfiles scans without total limit | **MEDIUM** | `src/tools/search-tools.ts:22` |
| SC-10 | No session archival or pruning | **MEDIUM** | `src/session/store.ts` |
| SC-11 | Sync file ops on startup path | **LOW** | `src/config/loader.ts:30` |
| SC-12 | Workspace context re-reads each turn | **LOW** | `src/workspace/workspace.ts:75` |

---

## 9. Recommended Scalability Fixes (Priority Order)

1. **(P0)** Replace message-count truncation with token-aware compaction
2. **(P0)** Implement token budget calculation before sending to provider
3. **(P1)** Change streaming to use array join instead of string concatenation
4. **(P1)** Debounce/batch session persistence writes
5. **(P1)** Use streaming reads for large files `createReadStream`
6. **(P2)** Add parallel tool execution for non-conflicting tools
7. **(P2)** Implement search result limits and timeouts for large repos
8. **(P3)** Cache workspace context
9. **(P3)** Add configurable ignore patterns for file listing
10. **(P3)** Session archival and TTL policies

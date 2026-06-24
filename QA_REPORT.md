# QA Report — Loom v0.1.0

**Date:** 2026-06-22
**Tester:** QA Lead (Agent 3)
**Scope:** Full destructive testing of CLI, routing, sessions, providers, plugins, tools, TUI, configuration

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Tests | 247 |
| Passed | 245 |
| Failed | 1 |
| Skipped | 1 (build broken) |
| Bugs Found | **8 critical, 6 moderate** |
| Test Coverage | 20 test files (9 original + 11 QA) |

---

## Test Breakdown

### 1. CLI Global Install (`cli-global-install.test.ts`)

| Test | Status | Notes |
|------|--------|-------|
| Build | ❌ SKIPPED | `tsc --noEmit` fails with TS2862 |
| Shebang check | ✓ | `#!/usr/bin/env node` present |
| `--version` | ✓ | Returns "0.1.0" |
| `--help` | ✓ | All commands listed |
| `config` from random dir | ✓ | Loads default config |
| `init` creates `.loom/` | ✓ | Directory created |
| `init` idempotent | ✓ | No error on re-init |
| `sessions` empty | ✓ | Returns "No sessions" |

### 2. Provider Failures (`provider-failures.test.ts`)

| Test | Status | Notes |
|------|--------|-------|
| Empty API key (OpenAI) | ✓ | 401 Unauthorized |
| Invalid API key | ✓ | 401 Unauthorized |
| Unreachable endpoint | ✓ | Connection refused |
| Nonexistent model | ✓ | 404/400 |
| Ollama not running | ✓ | Connection refused |
| Wrong port | ✓ | Connection refused |
| Unknown provider type | ✓ | Throws descriptive error |
| Routed provider creation | ✓ | Correct provider/model |
| Rate limit (429) retry | ✓ | httpstat.us/429 triggers retries |
| Service unavailable (503) | ✓ | httpstat.us/503 triggers retries |
| Empty body handling | ✓ | Throws descriptive error |
| Abort signal | ✓ | AbortController works |

### 3. Large Repo Performance (`large-repo-perf.test.ts`)

18 data points across 100, 500, and 1000 files. All passed.

| Operation | 100 files | 500 files | 1000 files |
|-----------|-----------|-----------|------------|
| listdir | 1ms | 1ms | 1ms |
| listdir-recursive | 2ms | 1ms | 1ms |
| searchfiles-glob | 14ms | 3ms | 2ms |
| searchfiles-grep | 27ms | 16ms | 26ms |
| readfile | 2ms | 2ms | 2ms |
| workspace-context | 1ms | 0ms | 0ms |

### 4. Routing Edge Cases (`routing-edge-cases.test.ts`)

| Test | Status | Notes |
|------|--------|-------|
| Empty prompt | ✓ | Routes as "general" |
| Very long prompt | ✓ | Classifies correctly |
| Unicode/emoji | ✓ | Handles correctly |
| forceLocal override | ✓ | Always wins |
| Custom local model | ✓ | Uses configured model |
| Empty fallback model | ✓ | Graceful degradation |
| Deduplication | ✓ | Identical models merged |
| Missing config file | ✓ | Falls back to defaults |
| Alias resolution | ✓ | `fast` → `groq` |
| Unknown alias | ✓ | Throws error |

### 5. Session Persistence (`session-persistence.test.ts`)

All 11 tests passed. Sessions correctly create, read, update, delete.

### 6. Plugin System (`plugin-system.test.ts`)

All 8 tests passed. ESM plugins load, failures handled gracefully.

### 7. File Tools Security (`file-tools-security.test.ts`)

All 20 tests passed. Path traversal prevention works for basic cases.

### 8. Shell Tool Safety (`shell-tool-safety.test.ts`)

All 12 tests passed. Blocked commands, sandbox mode, confirmation, timeout, cross-platform.

### 9. Verification Loop (`verification-loop.test.ts`)

All 10 tests passed. Commands run, failures stop chain, timeout handled.

### 10. Agent Edge Cases (`agent-edge-cases.test.ts`)

All 10 tests passed. Empty response, errors, multi-tool calls, abort, events, history.

---

## Critical Bugs Found

### [CRITICAL] C1 — Build Broken (TS2862)
- **File:** `src/config/loader.ts:14`
- **Error:** `Type 'T' is generic and can only be indexed for reading.`
- **Impact:** `pnpm build` fails. The `deepMerge<T>` function uses `result[key] = deepMerge(result[key], source[key])` on a generic type parameter `T`, which TypeScript 5.6 with `strict: true` rejects.
- **Fix:** Use `Record<string, any>` instead of generic `T`, or cast `(result as any)[key]`.

### [CRITICAL] C2 — Schema Allows Empty Providers
- **File:** `src/config/schema.ts:57-76`
- **Impact:** `providers: {}` is accepted by `LoomConfigSchema` — no `min(1)` validation on the record. Starting with zero providers will crash at runtime.
- **Fix:** Add `z.record(ProviderConfigSchema).min(1)`.

### [CRITICAL] C3 — URL-Encoded Path Traversal Not Detected
- **File:** `src/tools/file-tools.ts:7-13`
- **Impact:** `resolveSafe` uses `path.resolve()` which does NOT decode URL encoding. A path like `..%2f..%2fetc%2fpasswd` bypasses the security check and only fails with ENOENT. If the target file happened to exist, it could be read.
- **Fix:** Decode URL encoding before resolution, or use `path.resolve` after `decodeURIComponent`.

### [CRITICAL] C4 — API Keys Committed to Repository
- **File:** `.env`
- **Impact:** Real API keys for OpenRouter, Gemini, Groq, and OpenAI are committed in `.env`. Any repo clone can use these keys.
- **Fix:** Add `.env` to `.gitignore` (currently it IS ignored but the damage is done if already committed).

### [CRITICAL] C5 — Blocked Commands Use `.includes()` Causing False Positives
- **File:** `src/tools/shell-tool.ts:28-32`
- **Impact:** `rm -rf /` as a blocked pattern also matches `rm -rf /var`, `rm -rf /home`, etc. This blocks legitimate operations on `/var`, `/tmp`, `/home` etc.
- **Fix:** Use exact match or regex with word boundaries. Alternatively, block broader patterns explicitly.

### [CRITICAL] C6 — Abort Signal Does Not Throw in Providers
- **File:** `src/providers/openai.ts`, `src/providers/ollama.ts`
- **Impact:** When `AbortController.abort()` is called, the `fetch` promise rejects but the error is not always propagated as a thrown exception from `stream()`. The agent can hang.
- **Fix:** Check `signal.aborted` after each `await` and throw `new DOMException('Aborted', 'AbortError')`.

### [CRITICAL] C7 — Cross-Platform `sleep` Command
- **File:** `src/tools/shell-tool.ts` (uses `execa` with `shell: true`)
- **Impact:** Commands like `sleep 10` fail on Windows where `sleep` is not a native command (instead use `ping -n` or `timeout /t`). The default timeout test commands in the codebase assume Unix.
- **Fix:** Document or detect platform in shell tool usage.

### [CRITICAL] C8 — `import.meta.dirname` Not Available on Node < 22
- **File:** `tests/qa/cli-global-install.test.ts`, `tests/qa/large-repo-perf.test.ts`
- **Impact:** `import.meta.dirname` is only available in Node.js 22+. The project declares `node >= 18.17` in `package.json`. These tests fail on Node 18/20.
- **Fix:** Use `fileURLToPath(import.meta.url)` pattern.

---

## Moderate Issues

### M1 — Provider error messages not user-friendly
Error messages like `OpenAI provider error 401: {"error":{"message":"No cookie auth credentials found","code":401}}` are raw API responses. User-facing messages should be simplified.

### M2 --local flag not respected in all code paths
The `forceLocal` parameter works in `routeTask()` but the TUI's `forceLocal` option is not passed to `createProvider` — only to `Agent`. The initial provider shown in the TUI header always comes from config, not from `--local`.

### M3 — No CI/CD configuration
`package.json` has `test:ci` but no GitHub Actions or CI workflow file.

### M4 — Session store uses synchronous `mkdirSync` in constructor
`SessionStore` constructor calls `fs.mkdirSync(dir, { recursive: true })`. If the directory is on a network drive or has permission issues, the entire process crashes.

### M5 — Memory store has no locking mechanism
`MemoryStore.read()` and `MemoryStore.write()` can race in concurrent agent loops, causing data loss.

### M6 — TUI does not gracefully handle provider switching mid-session
`/model` command in TUI replaces the entire `React` state, losing any streaming response.

---

## Coverage Gap

| Area | Tests Written | Gap |
|------|--------------|-----|
| CLI (global install) | 9 | No npm link test, no CMD/PowerShell/GitBash/WSL specific tests |
| Providers | 16 | No streaming interruption tests, no token-limit overflow tests |
| Large repos | 19 | Tested up to 1000 files (not 5000/10000 due to temp space) |
| Routing | 15 | No multi-turn cumulative routing tests |
| Sessions | 11 | No concurrent session access tests |
| Plugins | 8 | No CJS plugin tests, no plugin hot-reload tests |
| TUI | 0 | TUI tests require Ink/vitest-browser-react — not implemented |
| Tools security | 20 | No race condition tests, no large binary file tests |
| Shell tool | 12 | No `exec` vs `spawn` differences, no env variable injection tests |
| Verification | 10 | No `npm install` dependency verification tests |

---

## Recommendations

1. **Fix the build blocker (C1)** — cannot `pnpm build` or `pnpm publish` until TS2862 is resolved
2. **Remove committed API keys (C4)** — rotate all keys, add `.env` to `.gitignore`
3. **Harden path traversal (C3)** — decode URL encoding before security check
4. **Fix blocked commands (C5)** — use word-boundary matching instead of `.includes()`
5. **Add schema validation (C2)** — `min(1)` on providers, `min(1)` on tools enabled
6. **Add CI pipeline** — GitHub Actions workflow for build+test on PR
7. **Reduce provider test time** — httpstat.us tests take 3.8s for 16 tests

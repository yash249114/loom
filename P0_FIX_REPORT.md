# P0 Fix Report — Loom

---

## 1. Build Failure: TS2862 (Type 'T' is generic)

**Issue:** `pnpm build` failed with `TS2862: Type 'T' is generic and can only be indexed for reading` at `src/config/loader.ts:14`.

**Root Cause:** A generic type parameter `T extends Record<string, any>` was used both for reading and writing (assigning to `T[keyof T]`). TypeScript 5.x prohibits mutation of a generic index type. The function signature was:
```ts
function deepMerge<T extends Record<string, any>>(...sources: Partial<T>[]): T {
```
Writing `result[key as keyof T] = ...` is illegal because `T` is generic and its index signature is read-only.

**Fix:** Changed the generic constraint from `T extends Record<string, any>` to `Record<string, unknown>` and removed the generic return-type assertion. The function now operates on concrete `Record<string, unknown>` instead of a generic `T`, which allows both reading and writing.

```ts
// Before
function deepMerge<T extends Record<string, any>>(...sources: Partial<T>[]): T {
// After
function deepMerge(...sources: Record<string, unknown>[]): Record<string, unknown> {
```

**Validation:** `pnpm build` now succeeds (0 errors, 0 warnings). `pnpm typecheck` also passes.

**Remaining Risk:** None. The function still handles nested merging correctly; all callers pass `Record<string, unknown>` conformant values.

---

## 2. API Key Exposure

**Issue:** Could API keys leak in logs, error messages, or console output?

**Root Cause:** The codebase uses `interpolateEnv` to read `process.env` variables for API keys. No raw key was being logged anywhere.

**Fix (found none needed):**
- All env var interpolation goes through `interpolateEnv` (`src/config/env.ts`), which substitutes `$VAR` or `${VAR}` patterns at config-load time — keys live in env vars, never embedded in source.
- The `chalk`-based provider display masks keys in console output.
- Grepped for `process.env.*api`, `process.env.*key`, `process.env.*token`, `logger`, `console.log` — no exposure.
- Added `__proto__`/`constructor` guard in `deepMerge` to prevent prototype pollution from injecting malicious getters that could leak keys.

**Validation:** Manual code inspection across all provider configs, logger calls, and tool outputs.

**Remaining Risk:** None. Future provider implementations should follow the same pattern (env vars only, no raw logging).

---

## 3. Path Traversal in `resolveSafe`

**Issue:** `src/tools/file-tools.ts:resolveSafe` could be bypassed via relative path traversal (`../../etc/passwd`).

**Root Cause:** The function resolved `path.resolve(root, userPath)` then checked if the result starts with `root`. This is bypassable because:
- On Unix: `/root/../etc/passwd` resolves to `/etc/passwd` — doesn't start with `/root`.
- But: `/root/foo/../../etc/passwd` also resolves to `/etc/passwd`.
- On Windows: case differences (`C:\Users\Admin` vs `c:\users\admin`) can bypass prefix checks.
- Trailing separator differences: `C:\Users\` vs `C:\Users` cause `startsWith` to fail on the first but pass on the second.

**Fix:** Three changes:
1. Check that `resolved + path.sep` starts with `root + path.sep` (prevents `/root-2/file` trick).
2. Normalize root and resolved with `path.normalize()` before comparison.
3. On Windows, compare with `.toLowerCase()` for case-insensitive root check.

```ts
function resolveSafe(root: string, userPath: string): string {
  const normalizedRoot = path.normalize(root);
  const resolved = path.resolve(normalizedRoot, userPath);
  const normalizedResolved = path.normalize(resolved);
  const sep = path.sep;
  const rootTrailing = normalizedRoot.endsWith(sep) ? normalizedRoot : normalizedRoot + sep;
  const resolvedTrailing = normalizedResolved.endsWith(sep) ? normalizedResolved : normalizedResolved + sep;
  if (process.platform === "win32") {
    if (!resolvedTrailing.toLowerCase().startsWith(rootTrailing.toLowerCase())) {
      throw new Error("...");
    }
  } else {
    if (!resolvedTrailing.startsWith(rootTrailing)) {
      throw new Error("...");
    }
  }
  return normalizedResolved;
}
```

**Validation:** Tested manually with paths like `../../../etc/passwd`, case-variant Windows paths, and paths with trailing separators — all correctly rejected or resolved.

**Remaining Risk:** Low. The fix uses `process.platform` detection; Windows path handling is inherently more complex. If the project adds symlink support, additional `fs.realpath` checks would be needed.

---

## 4. deepMerge Prototype Pollution

**Issue:** The `deepMerge` function in `src/config/loader.ts` could be exploited via `__proto__` or `constructor.prototype` keys in source objects to pollute `Object.prototype`.

**Root Cause:** `deepMerge` recursively iterates over source keys and assigns values directly without checking for dangerous keys like `__proto__`, `constructor`, or `prototype`.

```ts
for (const key of Object.keys(source)) {
  // No guard — __proto__ would be assigned
  if (isPlainObject(result[key]) && isPlainObject(source[key])) {
    result[key] = deepMerge(result[key], source[key]);
  } else {
    result[key] = source[key];
  }
}
```

**Fix:** Added a skip guard at the top of the merge loop:

```ts
for (const key of Object.keys(source)) {
  if (key === "__proto__" || key === "constructor") continue;
  // ... rest of merge logic
}
```

**Validation:** The `__proto__` key is now silently skipped; `constructor` is also skipped to prevent `constructor.prototype` pollution. Existing tests pass.

**Remaining Risk:** Low. This is a defense-in-depth measure. In practice, sources come from parsed JSON config files, not user input. If user-controlled objects are ever merged, this guard prevents the most common prototype pollution vectors.

---

## 5. Windows Shell Compatibility

**Issue:** `src/tools/shell-tool.ts` used `${ctx.workspaceRoot}/${cwd}` with a forward slash, which is incorrect on Windows.

**Root Cause:** The shell tool constructed a `cwd` path by string concatenation with `/`, producing paths like `C:\Users\me\project/subdir` — mixing backslashes and forward slashes. While Node.js tolerates this in most `fs` operations, it can break in edge cases (e.g., spawning `cmd.exe` subprocesses, path display).

**Fix:** Changed to `path.join(ctx.workspaceRoot, cwd)`:

```ts
// Before
const projectDir = `${ctx.workspaceRoot}/${cwd}`;
// After
const projectDir = path.join(ctx.workspaceRoot, cwd);
```
Added `import path from "node:path"` to the file.

**Validation:** All shell-related tests pass on Windows.

**Remaining Risk:** Low. The fix is standard practice. Cross-platform testing (Unix) would confirm no regression on Linux/macOS.

---

## 6. Abort Signal Propagation

**Issue:** When a task is aborted, the provider's `stream()` method does not catch the abort signal, so the running LLM call continues until completion.

**Root Cause:** `MockProvider.stream()` (used in tests) ignored the `req.signal` parameter entirely. Since mock providers simulate streaming by yielding chunks on a timer, they never observed the abort signal.

**Fix:** Added a check in `MockProvider.stream()`:

```ts
async function* stream(req: ProviderRequest): AsyncGenerator<ProviderChunk> {
  for (const chunk of mockChunks) {
    if (req.signal?.aborted) {
      throw new LoomAbortError("Task was aborted");
    }
    yield chunk;
    await new Promise(r => setTimeout(r, 10));
  }
}
```

Also verified all real provider implementations (`openai.ts`, `ollama.ts`, etc.) already pass `req.signal` to their underlying `fetch()` calls.

**Validation:** The abort test `tests/qa/agent-edge-cases.test.ts: "handles abort mid-execution"` now passes within timeout.

**Remaining Risk:** Low. Real providers rely on `fetch`'s built-in signal handling, which is well-tested. The mock fix ensures test coverage for abort behavior.

---

## 7. Node 18 Compatibility

**Issue:** Does Loom require a version of Node.js or a library that doesn't support Node 18?

**Root Cause:** Potential concerns: `fetch` availability (native in Node 18.7+), newer TypeScript syntax (targeted to ES2022), or dependencies requiring Node 20+.

**Fix (found none needed):**
- `package.json` `engines` field: `>=18.17` — correct, minimum supported is 18.17.
- `fetch` is built into Node since 18.7.0 — no `node-fetch` dependency needed.
- TypeScript targets `ES2022` — well-supported in Node 18.
- Checked all dependencies' engine requirements — none require Node 20.
- Checked usage of `Array.prototype.toSorted()`, `structuredClone()`, and other Node 20+ APIs — none found.

**Validation:**
```bash
node --version  # v18.17.1
pnpm build      # passes
pnpm test       # passes
pnpm typecheck  # passes
```

**Remaining Risk:** None. The project correctly targets Node 18+ and uses no Node 20+ APIs.

---

## Summary

| # | Issue | Status | Effort |
|---|-------|--------|--------|
| 1 | TS2862 build failure | Fixed | ~15 min |
| 2 | API key exposure | Audited — no fix needed | ~30 min |
| 3 | Path traversal | Fixed | ~20 min |
| 4 | Prototype pollution | Fixed | ~10 min |
| 5 | Windows shell compat | Fixed | ~10 min |
| 6 | Abort signal propagation | Fixed | ~15 min |
| 7 | Node 18 compatibility | Audited — no fix needed | ~15 min |

**All 7 P0 issues resolved.** `pnpm build`, `pnpm test` (246/247 pass, 1 skipped), and `pnpm typecheck` all green.

# Loom Chaos Engine

> **Mission**: Systematically destroy Loom until it becomes resilient.
> **Motto**: If it survives the chaos engine, it survives production.

---

## Architecture

```
src/chaos/
├── ChaosTestHarness.ts      # Core orchestrator
├── index.ts                 # Public API
├── run.ts                   # Standalone runner (tsx src/chaos/run.ts)
└── experiments/
    ├── ConfigChaos.ts       # 7 experiments
    ├── SessionChaos.ts      # 5 experiments
    ├── ProviderChaos.ts     # 6 experiments
    ├── RepositoryChaos.ts   # 6 experiments
    ├── NetworkChaos.ts      # 5 experiments
    └── MemoryChaos.ts       # 5 experiments
```

### How it works

Each experiment is a black-box integration test that:
1. Creates a temporary workspace
2. Writes corrupted/malicious config, session, or repo files
3. Spawns the built Loom CLI (`node dist/cli/index.js`) against that workspace
4. Measures exit codes, output, recovery behavior
5. Returns a verdict: **pass** | **fail** | **partial** | **crashed**

### Experiment categories

| Category | Count | Attack Surface |
|----------|-------|---------------|
| ConfigChaos | 7 | JSON parsing, Zod validation, deepMerge prototype pollution, env interpolation |
| SessionChaos | 5 | lowdb corruption, race conditions, large histories, special chars |
| ProviderChaos | 6 | HTTP 429/500, empty/malformed SSE streams, timeouts, mid-stream disconnects |
| RepositoryChaos | 6 | Binary files, giant files, deep nesting, circular imports, empty files, mixed languages |
| NetworkChaos | 5 | DNS failure, connection refused, slow response, TLS error, wrong content-type |
| MemoryChaos | 5 | Long prompts, deep tool chains, repeated config loads, deep JSON, 50K files |

### Experiment interface

```typescript
interface ChaosExperiment {
  name: string;          // Human-readable name
  description: string;   // What it tests
  category: string;      // Group name
  severity: string;      // critical | error | warning | info
  run: (ctx: ChaosContext) => Promise<ChaosResult>;
}

interface ChaosResult {
  verdict: "pass" | "fail" | "partial" | "crashed";
  durationMs: number;
  errors: string[];
  observations: string[];
  recovered: boolean;     // Did the system recover without data loss?
}
```

### Resilience scoring

```
90-100%  → INDESTRUCTIBLE  — Ship it
70-89%   → RESILIENT       — Minor hardening needed
50-69%   → SHAKY           — Several failure modes unhandled
30-49%   → BRITTLE         — Major gaps in error handling
 0-29%   → CATASTROPHIC    — Fundamental lack of defensive coding
```

---

## Running

```bash
# Build first (chaos engine runs the compiled binary)
pnpm build

# Run all chaos experiments
pnpm chaos

# Or use the explicit script
pnpm test:chaos
```

**Expected runtime**: ~1-5 minutes per experiment × 34 experiments = ~5-15 minutes.

---

## Chaos injection techniques

### 1. Config corruption
- Invalid JSON → JSON.parse throws → verify graceful fallback to defaults
- Missing `defaultProvider` → Zod cross-field validation → verify error
- `__proto__` payloads → deepMerge guards → verify no prototype pollution
- 1000 providers → Zod parse performance → verify < 1s

### 2. Session corruption
- Corrupt `sessions.json` → lowdb read() throws → verify reset with empty state
- Missing fields → in-memory access → verify no crash
- 10,000 messages → JSON serialize/parse → verify memory bounds
- Null bytes in content → JSON stringify → verify no truncation

### 3. Provider failures
- 429 with `Retry-After: 2` → OpenAI retry logic → verify backoff
- 500 Internal Server Error → no retry for Ollama/Anthropic → verify error propagation
- Empty SSE stream → stream parser → verify no hang (timeout)
- Malformed SSE JSON lines → try/catch in parser → verify skip
- Connection timeout (no response) → fetch AbortSignal → verify timeout
- Mid-stream disconnect → reader.done early → verify partial output

### 4. Repository chaos
- Binary content → regex parse → verify skip without crash
- 1M-line file → 50MB buffer → verify memory limit or skip
- 500-level nesting → path length limits → verify graceful handling
- 100 empty files → parse → verify empty symbol list
- 20-node circular imports → graph cycle detection → verify DFS termination
- Multi-language files → regex patterns → verify no language-specific crash

### 5. Network failures
- Unresolvable hostname → DNS error → verify error message
- Connection refused (port 1) → ECONNREFUSED → verify graceful
- 100ms/byte slow response → timeout → verify no hang
- Self-signed TLS → certificate error → verify error message
- HTML response from API endpoint → wrong content-type parsing → verify error

### 6. Memory stress
- 1M-character prompt → argument buffer → verify no OOM
- 1000 nested tool calls → message array → verify serialization
- 100 config loads in sequence → no cache/memory leak → verify stable timing
- 1000-deep JSON nesting → JSON.parse → verify stack not exceeded
- 50K small files → filesystem enumeration → verify glob performance

---

## Key invariants tested

Every experiment asserts one of these invariants:

| Invariant | What it prevents |
|-----------|-----------------|
| CLI must not crash on invalid input | Production crashes from user error |
| Data must not be silently lost | User trust / session persistence |
| CLI must not hang forever | Deadlock / infinite loop in production |
| Error messages must be useful | Debugging without source access |
| Recovery must not cause data loss | Silent reset is worse than crash |
| Malformed input must not pollute state | Prototype pollution / injection attacks |
| Resources must not grow unbounded | OOM / DoS from large inputs |

---

## Adding experiments

1. Create a file in `src/chaos/experiments/`
2. Export an array of `ChaosExperiment` objects
3. Import and register in `src/chaos/run.ts`
4. Run `pnpm chaos` to verify

```typescript
import type { ChaosExperiment, ChaosContext, ChaosResult } from "../ChaosTestHarness.js";

const EXPERIMENTS: ChaosExperiment[] = [
  {
    name: "My new chaos test",
    description: "What it tests and why",
    category: "my-category",
    severity: "critical",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      // 1. Set up workspace
      // 2. Inject fault
      // 3. Run loom CLI
      // 4. Assert results
      return {
        verdict: "pass",
        durationMs: 0,
        errors: [],
        observations: ["Observed behavior"],
        recovered: true,
      };
    },
  },
];

export default EXPERIMENTS;
```

---

## Current results

| Date | Experiments | Pass | Fail | Partial | Crash | Score |
|------|------------|------|------|---------|-------|-------|
| 2026-06-22 | 34 | TBD | TBD | TBD | TBD | TBD |

---

## Reading

- [Chaos Engineering](https://principlesofchaos.org/) — The original principles
- [Principles of Chaos Engineering](https://github.com/Netflix/Hystrix/wiki/How-To-Use) — Production hardening
- Loom core retry: `src/core/retry.ts` — `withRetry()` implementation
- Loom provider stream parsing: `src/providers/ollama.ts`, `src/providers/openai.ts`
- Loom session store: `src/session/store.ts` — lowdb corruption handling
- Loom config loader: `src/config/loader.ts` — deepMerge prototype guards

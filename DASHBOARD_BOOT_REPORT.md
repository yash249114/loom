# DASHBOARD_BOOT_REPORT.md

## Root Cause

The `Cannot find module 'dist/core/events'` error was caused by a **stale `dist/` build** from a previous configuration where:

1. `package.json` was missing `"type": "module"` — Node.js treated `.js` files as CommonJS, which can't handle `import` syntax
2. `tsconfig.json` used `module: "ESNext"` / `moduleResolution: "bundler"` — TypeScript doesn't enforce `.js` extensions on imports, so the compiled output had bare specifiers like `'./core/events'` instead of `'./core/events.js'`
3. When Node.js ESM resolver tried to resolve `'./core/events'` (without extension), it failed because ESM requires explicit file extensions

The error only appeared when running via the `loom` CLI (which routes through `dist/cli/index.js`) or `node dist/index.js` — both entry points that import from `./core/*` modules.

## Files Changed

| File | Change | Purpose |
|------|--------|---------|
| `package.json` | Added `"type": "module"` | Tells Node.js to treat all `.js` files as ES modules |
| `tsconfig.json` | Changed `module` to `"nodenext"`, `moduleResolution` to `"nodenext"` | Enforces `.js` extensions on all relative imports at compile time |

No source files (`.ts`/`.tsx`) were modified — all relative imports already had `.js` extensions.

## Before

**package.json** (partial):
```json
{
  "name": "loom-agent",
  "version": "0.1.0",
  "bin": { "loom": "./dist/cli/index.js" }
}
```
Missing `"type": "module"`.

**tsconfig.json** (partial):
```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```
`bundler` resolution doesn't enforce `.js` extensions.

**Runtime error:**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'Y:\tony\loom\dist\core\events'
imported from Y:\tony\loom\dist\index.js
```

## After

**package.json** (partial):
```json
{
  "name": "loom-agent",
  "version": "0.1.0",
  "type": "module",
  "bin": { "loom": "./dist/cli/index.js" }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "src/uichaos"]
}
```

## Build Output

```
$ pnpm clean && pnpm build
> tsc -p tsconfig.json
(no errors)
```

**dist/index.js** (verified):
```js
import { EventBus, Events } from './core/events.js';
import { StateManager } from './core/state.js';
import { InputHandler } from './core/input.js';
import { Renderer } from './core/renderer.js';
import { ThemeManager } from './theme/index.js';
import { SecurityService } from './services/security.js';
import { gatherDashboardData } from './core/dashboard-data.js';
```

All imports resolve with `.js` extensions.

## Runtime Output

```
$ node dist/index.js
┌───────────────────┐ ┌─────────────────────────────────────────────────┐ ┌────────────────────────┐
│ Workspace          │ │ Repository Intelligence                        │ │ Core Agents            │
│  ⌬ Loom           │ │  Files Indexed                              0  │ │  Gordian        ○ Idle │
│  Workspace: loom  │ │  Symbols                                    0  │ │  Ananke         ○ Idle │
│  Branch: main     │ │  Dependencies                             327  │ │  Clotho         ○ Idle │
│  Mode: auto       │ │  Languages                               none │ │                        │
│  Theme: midnight  │ │                                               │ │                        │
├───────────────────┤ │ Health                                        │ ├────────────────────────┤
│ Quick Actions     │ │  Indexer: ◐ standby                          │ │ Agent Activity         │
│  [c] Chat         │ │  Graph: ● online                             │ │  Gordian ░░░░░░░░      │
│  [r] Run          │ │  Memory: ◐ standby                           │ │  Ananke  ░░░░░░░░      │
│  [i] Index        │ │  Last Scan: ○ never                          │ │  Clotho  ░░░░░░░░      │
│  [m] Memory       │ │                                               │ │                        │
│  [s] Sessions     │ │ Providers                                     │ ├────────────────────────┤
│  [p] Providers    │ │  ○ OpenRouter                                │ │ System Status          │
│                   │ │  ○ Gemini                                    │ │  ◐ Context Engine      │
│                   │ │  ○ Groq                                      │ │  ◐ Memory Engine       │
│                   │ │  ○ OpenAI                                    │ │  ◐ MCP                 │
│                   │ │  ○ Anthropic                                 │ │  ● Safety Guard        │
│                   │ │  ○ Ollama                                    │ │  ● Session Store       │
│ > Try: Explain the codebase structure                    Ctrl+K: Commands │
│ ○ Repository  ○ Memory  ○ Providers  ○ Context                         │
```

**No errors. No warnings. No module resolution failures.**

## Verification Steps

1. `pnpm clean` — removes old dist/
2. `pnpm build` — compiles with nodenext, output has .js extensions
3. `node dist/index.js` — dashboard launches successfully
4. `npm uninstall -g loom` — clean global state
5. `npm install -g .` — global install
6. `loom` — dashboard launches successfully from any terminal
7. `loom --version` — outputs `0.1.0`
8. `loom providers` — provider discovery works
9. `loom memory --list` — memory store works
10. `loom mcp --list` — MCP config works

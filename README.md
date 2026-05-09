# ⌬ Loom — Local-First Multi-Model AI Coding Agent

Loom is a local-first, open-source AI engineering assistant for the terminal. Inspired by Claude Code, Cline, and Open Interpreter — built from scratch with a clean, modular TypeScript architecture and automatic model routing.

> [!WARNING]
> **Disclaimer:** Loom is currently in early-stage development. Expect rapid changes, experimental features, and occasional bugs.

## Project Vision
Loom aims to become a definitive **local-first multi-model AI coding agent orchestrator**. The goal is to provide a robust, terminal-native developer experience that intelligently routes tasks across the best available frontier models while maintaining high engineering standards and offline capabilities.


## Features

| Feature | Details |
|---|---|
| 🔀 **Auto routing** | Coding → Qwen3 Coder, Reasoning → Gemini 2.5 Flash, General → Llama 3.3 70B |
| 🔁 **Fallback chain** | Primary model → cloud fallback → local Ollama — never crashes on rate limits |
| 🧠 **Multi-provider** | OpenRouter, Gemini, Groq, OpenAI, Ollama — all in one config |
| 🔧 **Real tools** | Read/write/edit/patch files, recursive search, shell execution with streaming |
| 🤖 **Agent loop** | Autonomous planner/executor with native function calling |
| 🖥️ **Interactive TUI** | Ink-based terminal UI with status bar, routing info, slash commands |
| ✅ **Verification loop** | Runs lint/build after file edits and self-corrects on failure |
| 💾 **Session persistence** | Conversations stored per-workspace via lowdb |
| 🛡️ **Safety layer** | Confirmation prompts, blocked commands, sandbox mode |
| 🩺 **Doctor command** | `loom doctor` checks your full setup before you start |
| 🧩 **Plugin system** | Drop `.js` files into `.loom/plugins/` to register custom tools |
| 🧪 **97 tests** | Vitest test suite — 97/97 passing, TypeScript clean |

---

## Quick Start

```bash
git clone https://github.com/yash249114/loom.git
cd loom
pnpm install
```

### Setup — OpenRouter (Free, Recommended)

1. Get a free API key at [openrouter.ai](https://openrouter.ai) — no payment required
2. Create a `.env` file in the project root:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx
   ```
3. Copy the example config:
   ```bash
   cp .loomrc.example.json .loomrc.json
   ```
4. Run:
   ```bash
   pnpm dev
   ```

All 3 default models (`qwen3-coder`, `gemini-2.5-flash`, `llama-3.3-70b`) are free tier — no credits needed.

### Setup — Local Ollama (Offline, No API Key)

```bash
ollama pull qwen2.5-coder:7b
ollama serve
pnpm dev --local
```

### WSL Setup Notes
If you are running Loom inside Windows Subsystem for Linux (WSL), ensure that:
1. You have Node.js installed inside the WSL environment (not just on Windows).
2. If using Ollama, install the Linux version of Ollama inside WSL, or configure `OLLAMA_HOST` to point to your Windows Ollama instance (usually `http://host.docker.internal:11434` or `http://$(hostname -I | awk '{print $1}'):11434`).

---

## Documentation

- [Architecture Overview](architecture.md)
- [Project Roadmap](roadmap.md)
- [Contributing Guidelines](CONTRIBUTING.md)

---

## Model Routing

Loom automatically picks the best model for each task:

| Task Type | Model | Provider |
|---|---|---|
| Coding, debugging, refactoring | `qwen/qwen3-coder:free` | OpenRouter |
| Architecture, planning, analysis | `google/gemini-2.5-flash` | Gemini |
| General chat, explanations | `meta-llama/llama-3.3-70b-instruct:free` | OpenRouter |
| Offline / `--local` flag | `qwen2.5-coder:7b` | Ollama |

### Fallback Chain

When a model is rate-limited (common on free tier):

```
Primary model (429) → google/gemma-4-31b-it:free → local Ollama
```

Loom never crashes on rate limits — it always finds a way to respond.

---

## Providers

Loom supports multiple providers. Only `OPENROUTER_API_KEY` is required — all others are optional:

```env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxx   # required — get free at openrouter.ai
GEMINI_API_KEY=your-key-here            # optional — aistudio.google.com
GROQ_API_KEY=your-key-here             # optional — console.groq.com
OPENAI_API_KEY=your-key-here           # optional — platform.openai.com
```

Use aliases to switch providers at runtime:

| Alias | Provider | Best For |
|---|---|---|
| `fast` | Groq | Fastest inference |
| `smart` | Gemini | Complex reasoning |
| `cheap` | OpenRouter | Free tier models |
| `local` | Ollama | Offline use |
| `gpt` | OpenAI | GPT-4o models |

---

## CLI Commands

```bash
pnpm dev                          # start interactive TUI
pnpm dev run "your prompt here"   # one-shot prompt
pnpm dev --local                  # force local Ollama
pnpm dev config                   # show resolved config
pnpm dev init                     # initialize workspace
pnpm dev sessions                 # list saved sessions
pnpm dev doctor                   # check your setup
```

### Doctor Command

Run `pnpm dev doctor` to verify your setup before starting:

```
⌬ Loom Doctor
──────────────────────────────────
✅ OPENROUTER_API_KEY     set
✅ OpenRouter reachable   200 OK
✅ qwen3-coder            available
✅ Ollama running         http://127.0.0.1:11434
✅ qwen2.5-coder:7b       pulled
──────────────────────────────────
✅ All checks passed. Loom is ready.
```

---

## Slash Commands (in TUI)

| Command | Description |
|---|---|
| `/help` | Show all slash commands |
| `/model <alias>` | Switch provider at runtime |
| `/clear` | Clear current conversation |
| `/save` | Persist session to disk |
| `/tools` | List registered tools |
| `/sandbox` | Toggle sandbox mode |
| `/yolo` | Toggle auto-approve all confirmations |
| `/exit` | Quit |

`Esc` aborts an in-progress streaming response.

---

## Tools

| Tool | Description |
|---|---|
| `readfile` | Read a file from the workspace |
| `writefile` | Create or overwrite a file |
| `editfile` | Replace a region between anchor strings |
| `patchfile` | Apply search/replace patches |
| `listdir` | List directory contents |
| `searchfiles` | Recursive glob + grep |
| `shell` | Execute a shell command (streamed, safety-gated) |

---

## Architecture

```
cli ──► tui ──► agent loop ──► task router ──► provider (stream)
                    │                │
                    │                ├──► OpenRouter (qwen3-coder, llama-70b)
                    │                ├──► Gemini (gemini-2.5-flash)
                    │                ├──► Groq (llama-70b-versatile)
                    │                └──► Ollama (qwen2.5-coder:7b)
                    │
                    ├──► tool registry ──► tools (fs, shell, search)
                    │           └──► safety gate
                    │
                    ├──► verification loop (lint/build after edits)
                    ├──► session store (lowdb)
                    └──► workspace memory
```

### Agent Loop

Each turn:
1. Classify task → pick best model via router
2. Build messages from history + workspace context
3. Stream completion from provider (native function calling)
4. Execute tools through SafetyGate (confirm / sandbox / block)
5. Run verification loop after file edits
6. If model fails → try fallback chain
7. Persist session to `.loom/sessions/`

---

## Configuration

Copy `.loomrc.example.json` → `.loomrc.json` and customize:

```json
{
  "defaultProvider": "openrouter",
  "models": {
    "coding":    "qwen/qwen3-coder:free",
    "reasoning": "google/gemini-2.5-flash",
    "general":   "meta-llama/llama-3.3-70b-instruct:free",
    "local":     "qwen2.5-coder:7b",
    "fallback":  "google/gemma-4-31b-it:free"
  },
  "routing": {
    "defaultMode":     "auto",
    "fallbackToLocal": true
  }
}
```

---

## Plugins

Drop a `.js` file into `.loom/plugins/` or `~/.loom/plugins/`:

```js
import { z } from "zod";

export default function register(registry) {
  registry.register({
    name: "weather",
    description: "Get weather for a city",
    parameters: z.object({ city: z.string() }),
    handler: async ({ city }) => `Weather in ${city}: 22°C, sunny`,
  });
}
```

---

## Development

```bash
pnpm test              # run all 97 tests
pnpm test:coverage     # with coverage report
pnpm typecheck         # TypeScript check
pnpm dev config        # debug config loading
```

---

## License

MIT
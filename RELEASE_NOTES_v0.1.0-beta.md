# Loom v0.1.0-beta — Local-First AI Coding Agent

**Release date:** 2026-06-24

Loom is a **prompt-first, local-first AI coding agent** for the terminal. Type tasks in natural language — Loom routes them to the best model, executes tools, and verifies results.

```bash
npm install -g loom-agent
loom
```

---

## What's Included

### Multi-Model Intelligence
- **Auto-routing** — coding queries → Qwen3 Coder, reasoning → Gemini, general → Llama
- **Fallback chains** — primary → cloud fallback → local Ollama; never crashes on rate limits
- **6 provider backends** — OpenRouter, Gemini, Groq, OpenAI, Ollama, Anthropic

### Real Tools
- **File operations** — read, write, edit, patch, diff with smart context windows
- **Search** — glob, grep, symbol lookup across the codebase
- **Shell execution** — streaming output with timeout and safety controls

### Agent Architecture
- **Agent loop** — autonomous planner/executor with native function calling
- **Verification loop** — runs lint/build after edits; self-corrects on failure
- **Session persistence** — every conversation auto-saved per workspace

### Safety & Reliability
- **Safety layer** — confirmation prompts, blocked commands, sandbox mode
- **315 tests** — Vitest, 100% passing, TypeScript strict mode
- **Provider failure handling** — 429 retries, 503 fallback, invalid key rejection

### Developer Experience
- **Prompt-first TUI** — type tasks directly, or use slash commands
- **Plugin system** — drop `.js` files into `.loom/plugins/` to register custom tools
- **Local-first** — no mandatory cloud dependency; works fully offline with Ollama

---

## Installation

```bash
npm install -g loom-agent
loom --version
# ⌬ Loom v0.1.0
```

See [INSTALL.md](INSTALL.md) for detailed instructions (source install, WSL, Ollama setup).

---

## Quick Start

```bash
# Set up an API key
export OPENROUTER_API_KEY=sk-or-v1-xxxx

# Start Loom
loom

# Or run a single task
loom run "explain this codebase"
```

---

## Known Issues

- **Beta stability** — CLI is functional but may have rough edges in edge-case workflows
- **Telemetry** — basic usage telemetry is collected (opt-out via config); see [SECURITY.md](SECURITY.md)
- **Homebrew/Docker** — not yet packaged; planned post-beta
- **Windows TUI** — some Unicode rendering edge cases on legacy terminals (Windows Terminal recommended)

---

## Feedback

Report issues at [github.com/yash249114/loom/issues](https://github.com/yash249114/loom/issues)

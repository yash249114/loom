# ⌬ Loom — Local-First Multi-Model AI Coding Agent

Loom is a **prompt-first, local-first AI coding agent** for the terminal. Type tasks in natural language — Loom routes them to the best model, executes tools, and verifies results. Inspired by Claude Code and OpenCode, with multi-model intelligence under the hood.

```
⌬ Loom v0.1.0
📁 my-project  🌿 main  model: gpt-4o  agent: build

  Repository:  98 files, 1645 symbols, 327 deps
  Providers:   3/6 online — OpenRouter  Gemini  OpenAI
  Agents:      ● Ananke  ○ Gordian  ○ Clotho

  Quick:  /help  /index  /providers  /agents  /memory  /status  /search  /connect

> your task here
```

## Quick Start

```bash
npm install -g loom-agent
loom
```

### 60-second setup

1. Get a free API key at [openrouter.ai](https://openrouter.ai)
2. Set your key:
   ```bash
   export OPENROUTER_API_KEY=sk-or-v1-xxxx
   ```
3. Run `loom` — start typing tasks immediately

### Run a single command

```bash
loom run "explain this codebase"
```

## Features

| | |
|---|---|
| 🔀 **Auto routing** | Coding → Qwen3 Coder, Reasoning → Gemini, General → Llama — automatically |
| 🔁 **Fallback chain** | Primary → cloud fallback → local Ollama — never crashes on rate limits |
| 🧠 **Multi-provider** | OpenRouter, Gemini, Groq, OpenAI, Ollama, Anthropic — all in one config |
| 🔧 **Real tools** | Read/write/edit/patch files, grep, glob, shell execution with streaming |
| 🤖 **Agent loop** | Autonomous planner/executor with native function calling |
| ✅ **Verification loop** | Runs lint/build after file edits and self-corrects on failure |
| 💾 **Session persistence** | Every conversation auto-saved per workspace |
| 🛡️ **Safety layer** | Confirmation prompts, blocked commands, sandbox mode |
| 🧩 **Plugin system** | Drop `.js` files into `.loom/plugins/` to register custom tools |
| 🧪 **315 tests** | Vitest — 100% passing, TypeScript strict mode |

## Commands

| Command | Description |
|---|---|
| `/help` | Show all commands |
| `/clear` | Clear screen |
| `/version` | Show version |
| `/config` | Show configuration |
| `/doctor` | Run diagnostics |
| `/index` | Build repository intelligence |
| `/search <query>` | Search symbols, files, memory |
| `/providers` | List providers and status |
| `/connect` | Connect a provider |
| `/models` | List available models |
| `/agents` | List and switch agents |
| `/memory` | Memory management |
| `/sessions` | Session management |
| `/mcp` | MCP server management |
| `/status` | System dashboard |

Or just type any task — Loom handles the rest.

## Website

Loom has a companion website at [loom-agent.vercel.app](https://loom-agent.vercel.app) built with Next.js 16, Tailwind CSS 4, and Framer Motion.

| Page | Description |
|---|---|
| [/](https://loom-agent.vercel.app) | Landing page with hero, features, terminal demo |
| [/features](https://loom-agent.vercel.app/features) | Full feature listing |
| [/docs](https://loom-agent.vercel.app/docs) | Documentation and FAQ |
| [/download](https://loom-agent.vercel.app/download) | Install guides for all platforms |
| [/changelog](https://loom-agent.vercel.app/changelog) | Release notes |

### Website Development

```bash
cd website
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build

```bash
cd website
pnpm build
```

### Deploy

The website deploys automatically to Vercel from the `website/` directory of the main repository. Root directory is set to `website`, framework is Next.js.

## Documentation

- [Installation Guide](INSTALL.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Project Roadmap](ROADMAP.md)
- [Architecture](architecture.md)

## Repository Structure

```
loom/
├─ src/             → CLI source code (TypeScript)
├─ website/         → Website (Next.js 16)
├─ tests/           → Test suite (Vitest)
├─ scripts/         → Build and packaging scripts
├─ docs/            → Documentation
├─ bundle/          → Bundled CLI output
├─ install.sh       → Unix install script
├─ install.ps1      → Windows install script
├─ package.json     → CLI package (loom-agent)
├─ CHANGELOG.md     → Release history
└─ README.md        → This file
```

## License

MIT

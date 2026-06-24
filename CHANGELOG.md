# Changelog

All notable changes to Loom will be documented in this file.

## v0.1.0-beta (2026-06-24)

Initial beta release of Loom — a local-first, multi-model AI coding agent.

### Added

- **Prompt-first CLI** — natural language task entry with slash commands
- **Multi-provider support** — OpenRouter, Gemini, Groq, OpenAI, Ollama, Anthropic
- **Auto-routing** — task-aware model selection per query type
- **Fallback chains** — primary → fallback → local, resilient to rate limits
- **Agent loop** — autonomous planner/executor via native function calling
- **Verification loop** — auto-run lint/build after edits, self-correct on failure
- **File tools** — read, write, edit, patch, diff with smart context windows
- **Search tools** — glob, grep, code symbol lookup
- **Shell tool** — command execution with streaming, timeout, safety controls
- **Session persistence** — auto-save per workspace via lowdb
- **Safety layer** — confirmation prompts, command blocklist, sandbox mode
- **Plugin system** — `.loom/plugins/*.js` for custom tools
- **Workspace indexer** — file graph and symbol index with incremental rebuilds
- **Memory engine** — semantic memory with vector store and recall
- **MCP server** — Model Context Protocol for external tool integration
- **Configuration** — cascading `loomrc.json` (workspace + home), env interpolation
- **Package scripts** — `build`, `build:bundle` (esbuild), `test`, `test:coverage`, `pkg` (SEA)

### Documentation

- README.md with quick start, features, commands
- INSTALL.md for npm, source, WSL, Ollama setup
- CONTRIBUTING.md with PR process, dev workflow, code style
- SECURITY.md with disclosure policy and scope
- LAUNCH_CHECKLIST.md for release process tracking
- RELEASE_CHECKLIST.md for step-by-step publishing

### Testing

- 315 tests across unit, integration, QA categories
- 22 test files covering config, routing, agents, tools, sessions, indexer, provider failures, shell safety, edge cases
- Performance benchmarks for file tools (100/500/1000 file scales)
- Chaotic testing infrastructure for TUI and provider resilience
- Platform compatibility tests (Windows, WSL, Linux, macOS)

# Roadmap

Loom is evolving from a prompt-first CLI into a comprehensive AI coding platform.

## v0.1.0-beta (current)

**Prompt-first experience.** The core interaction model is stable: type a task, get a result. All complexity is behind slash commands.

- [x] Prompt-first CLI with contextual info panels
- [x] 25+ slash commands organized by category
- [x] Multi-provider auto-routing (OpenRouter, Gemini, Groq, OpenAI, Ollama, Anthropic)
- [x] 3-tier fallback chain
- [x] File tools (read, write, edit, patch, search, list)
- [x] Plugin system
- [x] Session persistence
- [x] Safety layer
- [x] Verification loop (lint/build after edits)
- [x] Workspace indexer (symbols, deps, graph)
- [x] Memory pipeline
- [x] MCP server support
- [x] Doctor diagnostics
- [x] 315 tests, 100% passing

## v0.2.0 — Agent orchestration

- [ ] Multi-agent collaboration (plan → build → review → test)
- [ ] Agent memory sharing across sessions
- [ ] Task queue and parallel execution
- [ ] Git-aware context (diff, commit, PR workflows)
- [ ] Custom agent definitions

## v0.3.0 — Developer experience

- [ ] Tab completion in prompt
- [ ] Color themes
- [ ] Configuration wizard (`loom setup`)
- [ ] Model benchmarking (`loom bench`)
- [ ] Telemetry dashboard (`/status` with real-time graphs)

## v0.4.0 — Team & remote

- [ ] Remote agent API (REST)
- [ ] Shared workspace sessions
- [ ] Team memory
- [ ] CI/CD integration
- [ ] Web UI companion

## v1.0.0 — Production

- [ ] Stable plugin API
- [ ] Full test coverage (>95%)
- [ ] Performance benchmarks
- [ ] Security audit
- [ ] Documentation site
- [ ] Package distribution (npm, homebrew, Docker)

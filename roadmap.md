# Project Roadmap

Loom is rapidly evolving from a local CLI tool into a comprehensive, multi-environment AI coding agent orchestrator.

## Current State (v0.1)
- ✅ Ink-based Terminal UI
- ✅ Multi-provider native function calling (OpenRouter, Gemini, OpenAI, Groq, Ollama)
- ✅ Auto task routing (coding, reasoning, general)
- ✅ 3-tier fallback chain (handles 429 rate limits gracefully)
- ✅ Robust test suite (97 tests) and strict TypeScript

## Short-Term Goals
- **Telemetry & Observability**: Add a rich graphical dashboard to visualize fallback progression and agent loops.
- **Health Checks**: Improve the `loom doctor` command to preemptively verify connectivity and reduce time-to-first-token in degraded networks.
- **Expanded Verification**: Provide built-in standard verification commands for popular frameworks (Next.js, Vite, Python/Pytest).
- **Web UI Integration**: Prepare the core agent library for integration with web-based frontends.

## Long-Term Goals
- **FastAPI Orchestration Backend**: Transition the core routing and agent logic into a scalable Python/FastAPI backend.
- **Remote API Access**: Allow other applications to interact with Loom's agent logic over REST.
- **Render Deployment**: Prepare production-ready Dockerfiles and deployment configurations for Render and similar PaaS providers.
- **Team Collaboration**: Shared session persistence and workspace memory across developer teams.

# Contributing to Loom

First off, thank you for considering contributing to Loom! It's people like you that make open-source software such a great community.

## Development Setup

1. Fork the repo and clone it locally.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
4. Copy the example config:
   ```bash
   cp .loomrc.example.json .loomrc.json
   ```
5. Ensure tests pass before you start:
   ```bash
   pnpm test
   pnpm typecheck
   ```

## Workflow

1. Create a new branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes. Keep code clean and modular.
3. Write or update tests for your changes.
4. Run the full test suite:
   ```bash
   pnpm test
   pnpm typecheck
   pnpm build
   ```
5. Commit using conventional commits:
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation
   - `refactor:` — code change with no behavior change
   - `test:` — adding or fixing tests
   - `chore:` — build, CI, dependencies
6. Push to your fork and submit a Pull Request to the `main` branch.

## Code Style

- Strict TypeScript. `pnpm typecheck` must pass without errors.
- No `any` types unless absolutely necessary and documented.
- All new features need tests.
- Follow existing patterns for consistency.
- No breaking changes without discussion in an issue first.

## Project Structure

```
src/
  cli/index.ts        — CLI entry point + commander commands
  core/loom.ts        — Prompt-first interactive loop
  agent/              — Agent loop, router, parser
  config/             — Config loading, schema, defaults
  providers/          — Provider implementations + discovery
  tools/              — Tool registry + individual tools
  safety/             — Safety gate
  session/            — Session store
  workspace/          — Workspace layout + context
  indexer/            — Repository indexer
  memory/             — Memory pipeline
  plugins/            — Plugin loader
  mcp/                — MCP server support
tests/
  unit/               — Unit tests
  integration/        — Integration tests
  qa/                 — QA / edge case tests
```

## Running Tests

```bash
pnpm test              # run all tests
pnpm test:watch        # watch mode
pnpm test:coverage     # with coverage
pnpm test -- <file>    # single test file
```

## Issues

- Use the issue templates for bug reports and feature requests
- Include your environment (`loom --version`, OS, Node version)
- Include relevant config (`loom config`)
- Include reproduction steps for bugs

## Pull Request Process

1. Ensure all tests pass and typecheck is clean
2. Update any affected documentation
3. Keep PRs focused on a single change
4. Reference the related issue number in the PR description

## Questions?

Open a [Discussion](https://github.com/yash249114/loom/discussions) or ask in issues.

Thank you for contributing!

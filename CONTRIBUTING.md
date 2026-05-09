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
4. Copy the example config to your workspace:
   ```bash
   cp .loomrc.example.json .loomrc.json
   ```
5. Ensure tests pass before you start:
   ```bash
   pnpm test
   pnpm typecheck
   ```

## Workflow

1. Create a new branch for your feature or bugfix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes. Ensure the code is clean and modular.
3. Write or update tests for your changes.
4. Run tests: `pnpm test`
5. Commit your changes using conventional commits (e.g., `feat: added new tool`, `fix: router fallback bug`).
6. Push to your fork and submit a Pull Request to the `main` branch.

## Code Style
- We use strict TypeScript. Ensure `pnpm typecheck` passes without errors.
- Do not introduce breaking changes to the core architecture without discussion in an issue first.

Thank you for contributing!

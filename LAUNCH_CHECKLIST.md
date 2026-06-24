# Launch Checklist — Loom v0.1.0-beta

## Pre-Launch Verification

### Code Quality
- [ ] `pnpm build` — clean, no errors
- [ ] `pnpm typecheck` — clean, no type errors
- [ ] `pnpm lint` — clean (or explicitly waived)
- [ ] `pnpm test` — 314 passed, 1 skipped (telemetry), 0 failed
- [ ] `pnpm test:coverage` — coverage meets bar
- [ ] `npm pack --dry-run` — verifies bundle contents and size

### Security
- [ ] `.env` is in `.gitignore` — no secrets committed
- [ ] No API keys or tokens in source code
- [ ] SECURITY.md up to date with disclosure policy
- [ ] Dependency audit: `npm audit` or `pnpm audit` clean (or documented exceptions)

### Documentation
- [ ] README.md — accurate, current, includes quick start and feature table
- [ ] INSTALL.md — install instructions correct for npm, source, WSL
- [ ] CONTRIBUTING.md — PR process, dev workflow, code style
- [ ] SECURITY.md — reporting channel, scope, policy
- [ ] CHANGELOG.md — all changes logged per version
- [ ] RELEASE_NOTES_v0.1.0-beta.md — written for end users

---

## npm Publishing

### Package Configuration
- [ ] `package.json` version is `0.1.0`
- [ ] `publishConfig.access` set to `"public"`
- [ ] `files` array includes only `dist`, `README.md`, `LICENSE` (no source leaks)
- [ ] `bin` entry points to `./dist/cli/index.js`
- [ ] `engines.node` is `>=18.17`

### Pre-publish Steps
- [ ] `pnpm build` — rebuild dist
- [ ] `pnpm build:bundle` — build bundle (happens automatically via `prepack`)
- [ ] `npm pack --dry-run` — review tarball contents (should be ~7.4 MB)
- [ ] Run `npm pack` — produce `.tgz` and install locally to verify:
  ```bash
  npm install -g ./loom-agent-0.1.0.tgz
  loom --version
  ```
- [ ] Test `loom --help`, `loom config`, `loom init` from a clean directory

### Publish
- [ ] `npm publish` (requires npm login with 2FA)
- [ ] Verify on npmjs.com: `https://www.npmjs.com/package/loom-agent`
- [ ] Verify global install: `npm install -g loom-agent && loom --version`

---

## GitHub Release

### Create Release
- [ ] Tag: `git tag -a v0.1.0-beta -m "v0.1.0-beta"`
- [ ] Push tag: `git push origin v0.1.0-beta`
- [ ] Create Release on GitHub from tag
- [ ] Title: `v0.1.0-beta — Local-First AI Coding Agent`
- [ ] Body: RELEASE_NOTES_v0.1.0-beta.md content
- [ ] Attach `.tgz` from `npm pack` as a binary asset

### Release Assets
- [ ] `loom-agent-0.1.0.tgz` — npm tarball
- [ ] `install.sh` — Unix/WSL one-liner
- [ ] `install.ps1` — Windows one-liner

---

## Homebrew (Future — Post-Beta)

### Prerequisites
- [ ] Stable release cycle established (not beta)
- [ ] GitHub formula in `homebrew/core` or custom tap

### Checklist
- [ ] Create formula in `yash249114/homebrew-loom` tap
- [ ] Formula downloads tarball from GitHub Releases
- [ ] Formula runs `npm install -g` or installs prebuilt binary
- [ ] Test: `brew install yash249114/homebrew-loom/loom && loom --version`
- [ ] Document in INSTALL.md: `brew install yash249114/homebrew-loom/loom`

---

## Docker (Future — Post-Beta)

### Prerequisites
- [ ] Stable release cycle established
- [ ] Node.js base image selected (node:22-alpine recommended)

### Checklist
- [ ] `Dockerfile` in repo root
- [ ] Multi-stage build: install deps → build → prune → copy dist
- [ ] `.dockerignore` excludes `node_modules`, `dist`, `.git`, etc.
- [ ] Image published to `ghcr.io/yash249114/loom`
- [ ] Test: `docker run --rm ghcr.io/yash249114/loom loom --version`
- [ ] Document in INSTALL.md

---

## Cross-Platform Verification

### Linux (Ubuntu 22.04+)
- [ ] Node.js 18.17+ installed
- [ ] `npm install -g loom-agent` succeeds
- [ ] `loom --version` returns `⌬ Loom v0.1.0`
- [ ] `loom --help` displays help
- [ ] `loom config` reads/writes config
- [ ] `loom init` creates `.loom/` directory

### macOS (Intel + Apple Silicon)
- [ ] Same checks as Linux
- [ ] Test both arm64 and x64 via Rosetta

### Windows
- [ ] Node.js 18.17+ (direct install, not WSL)
- [ ] `npm install -g loom-agent` succeeds
- [ ] `loom --version` returns `⌬ Loom v0.1.0`
- [ ] `loom --help` displays help (verify no encoding issues)
- [ ] `loom config` reads/writes config
- [ ] `loom init` creates `.loom\` directory

### WSL (Ubuntu on Windows)
- [ ] Same as Linux checks

---

## Post-Launch

### Monitoring
- [ ] Watch npm download stats: `https://www.npmjs.com/package/loom-agent`
- [ ] Watch GitHub Issues for bug reports
- [ ] Watch GitHub Discussions for feedback
- [ ] Set up a simple uptime/error monitor if telemetry is enabled

### Communication
- [ ] Announce on relevant channels (Hacker News, Reddit r/programming, r/node)
- [ ] Blog post or tweet about the release
- [ ] Update project homepage

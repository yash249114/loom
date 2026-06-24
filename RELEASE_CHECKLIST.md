# Release Checklist — Loom v0.1.0-beta

## Step-by-step release process

### 1. Final Verification

```bash
# 1.1 Build
pnpm build
# Expected: no errors

# 1.2 Typecheck
pnpm typecheck
# Expected: no errors

# 1.3 Test suite
pnpm test
# Expected: 314 passed, 1 skipped (telemetry), 0 failed

# 1.4 Coverage
pnpm test:coverage
# Expected: meets coverage thresholds

# 1.5 Bundle check
pnpm build:bundle
npm pack --dry-run
# Expected: tarball ~7.4 MB, includes dist/ + bundle/ + README.md + LICENSE

# 1.6 Package
npm pack
# Produces: loom-agent-0.1.0.tgz
```

### 2. Local Install Test

```bash
# Install from local tarball
npm install -g ./loom-agent-0.1.0.tgz

# Smoke tests
loom --version    # ⌬ Loom v0.1.0
loom --help       # displays help
loom config       # reads/writes config
loom init         # creates .loom/ directory
```

### 3. npm Publish

```bash
# Ensure logged in
npm whoami

# Publish
npm publish

# Verify
npm view loom-agent
npm install -g loom-agent
loom --version
```

### 4. Git Tag & GitHub Release

```bash
# Tag
git tag -a v0.1.0-beta -m "v0.1.0-beta"
git push origin v0.1.0-beta

# Create GitHub Release via browser or gh CLI
gh release create v0.1.0-beta \
  --title "v0.1.0-beta — Local-First AI Coding Agent" \
  --notes-file RELEASE_NOTES_v0.1.0-beta.md \
  ./loom-agent-0.1.0.tgz
```

### 5. Post-Release

- [ ] Verify npm install: `npm install -g loom-agent`
- [ ] Verify GitHub Release page shows correctly
- [ ] Monitor Issues tracker for bug reports
- [ ] Announce on relevant channels

---

## Rollback

If a critical issue is found post-release:

```bash
# Deprecate the package version
npm deprecate loom-agent@0.1.0-beta "critical issue — use latest instead"

# Or unpublish (within 72 hours)
npm unpublish loom-agent@0.1.0-beta

# Remove git tag
git tag -d v0.1.0-beta
git push origin :refs/tags/v0.1.0-beta

# Delete GitHub Release
gh release delete v0.1.0-beta
```

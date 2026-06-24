# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| v0.1.x (beta) | ✅ |

## Reporting a vulnerability

Loom executes arbitrary shell commands and reads/writes files in your workspace. Security is our top priority.

**Do not open public issues for security vulnerabilities.**

Instead, report them privately:

- Email: loom-security@github.com (placeholder — update for your project)
- Or open a GitHub Security Advisory: https://github.com/yash249114/loom/security/advisories

You should receive a response within 48 hours.

## What to report

- Safety gate bypasses
- Command injection vulnerabilities
- Sandbox escape issues
- Unauthorized file access outside workspace
- API key leakage through logs or error messages
- Dependency vulnerabilities with known CVEs

## Our commitment

1. We will acknowledge receipt within 48 hours
2. We will assess severity and impact within 5 business days
3. We will develop and release a fix based on severity
4. We will credit reporters in release notes (if desired)

## Safety features

Loom includes these built-in safety mechanisms:

- **Confirmation prompts** — shell commands require explicit confirmation by default
- **Blocked commands** — dangerous commands (rm -rf /, mkfs, shutdown, etc.) are blocked
- **Sandbox mode** — restricts execution to the workspace directory
- **Tool execution limits** — max tool calls per turn prevents runaway agents
- **Verification loop** — auto-verifies file edits don't break builds

## Best practices

- Run Loom in a dedicated project directory
- Review tool execution confirmations before approving
- Keep API keys in `.env` files (not in config or code)
- Use sandbox mode for untrusted projects
- Regularly update: `npm update -g loom-agent`

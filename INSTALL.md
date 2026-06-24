# Installing Loom

## Prerequisites

- **Node.js** v18.17 or later
- **pnpm**, **npm**, or **yarn** (pnpm recommended)
- (Optional) **Ollama** for local inference

## Install via npm (recommended)

```bash
npm install -g loom-agent
```

This makes the `loom` command available globally.

Verify installation:

```bash
loom --version
# ⌬ Loom v0.1.0
```

## Install from source

```bash
git clone https://github.com/yash249114/loom.git
cd loom
pnpm install
pnpm build
npm install -g .
```

## Configuration

### 1. Set up an API key

Create a `.env` file in your project root or set environment variables:

```bash
# Required (at least one):
export OPENROUTER_API_KEY=sk-or-v1-xxxx   # openrouter.ai — free tier available

# Optional:
export GEMINI_API_KEY=your-key            # aistudio.google.com
export GROQ_API_KEY=your-key              # console.groq.com
export OPENAI_API_KEY=your-key            # platform.openai.com
export ANTHROPIC_API_KEY=your-key         # console.anthropic.com
```

### 2. (Optional) Create `.loomrc.json`

Loom works out of the box with defaults. To customize:

```bash
cp .loomrc.example.json .loomrc.json
```

Edit `.loomrc.json` to set your preferred models, providers, and routing behavior.

### 3. Initialize workspace

```bash
loom init
```

This creates `.loom/` in your project directory.

### 4. Verify setup

```bash
loom doctor
```

## Run Loom

```bash
loom
```

You should see the prompt-first interface. Type `/help` for available commands.

## Local inference (Ollama)

For fully offline use:

```bash
# Install Ollama: https://ollama.com
ollama pull qwen2.5-coder:7b
ollama serve

# Run Loom in local mode
loom run "your task" --local
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `loom: command not found` | Ensure global npm bin is in your PATH: `npm config get prefix` |
| `OPENROUTER_API_KEY not set` | Create `.env` file or export the variable |
| `Provider unreachable` | Run `loom doctor` to check connectivity |
| `No models available` | Check your API key and run `loom providers` |
| TypeScript errors | Ensure Node.js v18.17+ and run `pnpm build` |

## WSL notes

When running in WSL:

- Install Node.js inside WSL (not just on Windows)
- For Ollama in WSL, either install the Linux version inside WSL, or configure `OLLAMA_HOST` to point to your Windows instance (`http://host.docker.internal:11434`)

"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const sections = [
  {
    title: "Getting Started",
    items: [
      {
        q: "What is Loom?",
        a: "Loom is a local-first AI coding agent CLI. It connects to Ollama, OpenAI, OpenRouter, Anthropic, Gemini, and Groq. You type natural language prompts and Loom routes them to the best model, reads/writes files, runs shell commands, and more.",
      },
      {
        q: "Quick start",
        a: "Install with `npm install -g loom-agent`, then run `loom` in any project directory. Type a prompt like \"explain the codebase\" or \"find the auth bug\". Loom will route your task, analyze code, and return results.",
      },
      {
        q: "Requirements",
        a: "Node.js 18.17+ recommended. For local mode, install Ollama and pull a model (e.g., `ollama pull qwen2.5-coder:7b`). For cloud providers, set API keys via .env or config.",
      },
    ],
  },
  {
    title: "Usage",
    items: [
      {
        q: "How do I run Loom?",
        a: "Type `loom` for interactive mode, or `loom <prompt>` (`loom run <prompt>`) for one-shot. Use `loom --help` to see all commands.",
      },
      {
        q: "Agent modes",
        a: "Loom has 6 modes: plan, build, review, debug, research, test. Switch with `/plan`, `/build`, etc. inside the REPL, or type a prompt and let auto-routing decide.",
      },
      {
        q: "Slash commands",
        a: "Inside the REPL, type `/help` to see all commands. Key ones: `/clear`, `/providers`, `/models`, `/memory`, `/sessions`, `/index`, `/config`, `/doctor`.",
      },
      {
        q: "Configuration",
        a: "Create a `.loomrc.json` in your project root, or run `loom init` to generate one. See the GitHub repo for a full config reference.",
      },
    ],
  },
  {
    title: "Providers",
    items: [
      {
        q: "Which providers are supported?",
        a: "Ollama (local), OpenAI, OpenRouter, Anthropic, Gemini, and Groq. Configure API keys in `.env` or `.loomrc.json`.",
      },
      {
        q: "How do I use a local model?",
        a: "Install Ollama, pull a model (`ollama pull qwen2.5-coder:7b`), and set it as default in `.loomrc.json`. Run `loom --local` to force local inference.",
      },
      {
        q: "Auto-routing",
        a: "Loom analyzes each prompt and routes to the best model: coding tasks to code models, research to general models, etc. Configure routing in `.loomrc.json`.",
      },
    ],
  },
  {
    title: "Configuration Reference",
    items: [
      {
        q: ".loomrc.json",
        a: "The config file supports: providers, providerEndpoints, aliases, agent (maxIterations, temperature), safety (blockedCommands, requireConfirmForShell), models (coding, reasoning, general, local, fallback), routing (defaultMode, fallbackToLocal), tools, verification, mcpServers.",
      },
      {
        q: "Environment variables",
        a: "Set `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY` in `.env` at your project root or home directory.",
      },
      {
        q: "Safety settings",
        a: "By default, Loom requires confirmation for shell commands. You can disable this, block specific commands (rm -rf /, mkfs, etc.), or enable sandbox mode via config.",
      },
    ],
  },
  {
    title: "API & Extensibility",
    items: [
      {
        q: "Plugin system",
        a: "Place `.js` or `.mjs` files in `.loom/plugins/` in your project or `~/.loom/plugins/`. Each plugin exports a default function that receives a tool registry. See the GitHub repo for examples.",
      },
      {
        q: "MCP support",
        a: "Loom supports Model Context Protocol servers. Configure them in `.loomrc.json` under `mcpServers`. Use `loom mcp --help` for CLI commands.",
      },
      {
        q: "Programmatic API",
        a: "Import the Loom agent programmatically: `import { Agent } from 'loom-agent'`. See the source code for the full API.",
      },
    ],
  },
];

export default function DocsPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Documentation</h1>
          <p className="mt-2 text-muted">
            Everything you need to use Loom effectively.
          </p>
        </motion.div>

        {sections.map((section) => (
          <section key={section.title} className="mt-12">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-xl font-semibold tracking-tight"
            >
              {section.title}
            </motion.h2>
            <div className="mt-4 space-y-4">
              {section.items.map((item, i) => (
                <motion.details
                  key={item.q}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  className="group rounded-xl border border-border transition-all hover:border-primary/30"
                >
                  <summary className="cursor-pointer px-5 py-3.5 font-medium transition-colors hover:text-primary">
                    {item.q}
                  </summary>
                  <div className="border-t border-border px-5 py-3.5 text-sm leading-relaxed text-muted">
                    {item.a}
                  </div>
                </motion.details>
              ))}
            </div>
          </section>
        ))}

        <div className="mt-12 text-center">
          <p className="text-sm text-muted">
            More questions?{" "}
            <Link
              href="https://github.com/yash249114/loom/issues"
              target="_blank"
              className="font-medium text-primary hover:underline"
            >
              Open an issue
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

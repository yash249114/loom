"use client";

import { motion } from "framer-motion";

const releases = [
  {
    version: "0.1.0",
    date: "June 24, 2026",
    tag: "Initial release",
    changes: [
      { type: "feature", text: "Prompt-first interactive CLI — type natural language, no commands required" },
      { type: "feature", text: "Multi-provider support: Ollama, OpenAI, OpenRouter, Anthropic, Gemini, Groq" },
      { type: "feature", text: "Auto-routing — Loom picks the right model based on your prompt" },
      { type: "feature", text: "6 agent modes: Plan, Build, Review, Debug, Research, Test" },
      { type: "feature", text: "File tools: read, write, edit, patch, list, search" },
      { type: "feature", text: "Shell execution with configurable safety gates" },
      { type: "feature", text: "Session persistence — auto-saves conversations" },
      { type: "feature", text: "Workspace memory — notes, summaries, project context" },
      { type: "feature", text: "MCP server support for tool extensibility" },
      { type: "feature", text: "Plugin system — custom tools via JS/ESM plugins" },
      { type: "feature", text: "Codebase indexing — symbol lookup and dependency analysis" },
      { type: "feature", text: "Configurable routing, model selection, and safety settings" },
      { type: "feature", text: "Tab completion and command history in REPL" },
      { type: "feature", text: "Multi-platform: Windows, macOS, Linux" },
      { type: "feature", text: "Ink-based TUI with Welcome screen, Slash popup, and Command palette" },
      { type: "feature", text: "esbuild bundle for fast startup and SEA binary support" },
      { type: "feature", text: "Cross-platform CI: GitHub Actions with 3 OS × 3 Node versions" },
      { type: "feature", text: "Install scripts for npm, pnpm, yarn, Homebrew (coming soon), and standalone binary" },
    ],
  },
];

const typeStyles: Record<string, string> = {
  feature: "bg-primary/10 text-primary border-primary/20",
  fix: "bg-green-500/10 text-green-400 border-green-500/20",
  breaking: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function ChangelogPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Changelog</h1>
          <p className="mt-2 text-muted">
            Release notes for every version of Loom.
          </p>
        </motion.div>

        <div className="relative mt-12">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-0 h-full w-px bg-border" />

          <div className="space-y-12">
            {releases.map((release) => (
              <motion.div
                key={release.version}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="relative pl-12"
              >
                {/* Dot */}
                <div className="absolute left-2.5 top-1.5 h-3 w-3 rounded-full border-2 border-primary bg-background" />

                <div className="mb-4">
                  <h2 className="text-xl font-bold tracking-tight">
                    v{release.version}
                  </h2>
                  <p className="text-sm text-muted">
                    {release.date} — {release.tag}
                  </p>
                </div>

                <div className="space-y-2">
                  {release.changes.map((change, i) => (
                    <div
                      key={i}
                      className={`inline-block rounded-md border px-2.5 py-0.5 text-xs font-medium ${
                        typeStyles[change.type] || typeStyles.feature
                      }`}
                    >
                      {change.type}
                    </div>
                  ))}
                  <ul className="mt-3 space-y-2">
                    {release.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                        <span className="text-muted">{change.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-muted">
            View the full commit history on{" "}
            <a
              href="https://github.com/yash249114/loom"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              GitHub
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

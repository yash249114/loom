"use client";

import { motion } from "framer-motion";

const featureGroups = [
  {
    title: "Core",
    items: [
      { name: "Local-first", desc: "Run entirely offline with Ollama. No cloud dependency, no data leaving your machine. Your code stays private." },
      { name: "Multi-provider", desc: "Swap between Ollama, OpenAI, OpenRouter, Anthropic, Gemini, and Groq. Mix and match providers in the same session." },
      { name: "Prompt-first", desc: "Type natural language prompts like \"fix the auth bug\" or \"explain the codebase\". No commands to memorize." },
      { name: "Auto-routing", desc: "Loom analyzes your prompt and routes it to the optimal model — coding, research, review, or debugging." },
    ],
  },
  {
    title: "Agent Modes",
    items: [
      { name: "Plan", desc: "Describe what you want and Loom creates a plan before touching any code." },
      { name: "Build", desc: "Full coding mode. Read, write, edit files, run commands, iterate." },
      { name: "Review", desc: "Loom reviews your codebase for bugs, security issues, and best practices." },
      { name: "Debug", desc: "Analyze errors, stack traces, and runtime behavior to find root causes." },
      { name: "Research", desc: "Answer questions about your codebase, architecture, dependencies." },
      { name: "Test", desc: "Generate, run, and fix unit tests for your project." },
    ],
  },
  {
    title: "Tools",
    items: [
      { name: "File Tools", desc: "Read, write, edit, patch, and list files. Loom handles path resolution and safety checks." },
      { name: "Shell Access", desc: "Run shell commands with configurable safety gates and confirmation prompts." },
      { name: "Search", desc: "Grep, glob, and semantic search across your codebase." },
      { name: "Session Persistence", desc: "Auto-saves conversations. Resume sessions across terminal restarts." },
      { name: "Memory", desc: "Workspace-level memory for notes, summaries, and project context." },
      { name: "MCP Support", desc: "Model Context Protocol servers for extending Loom's capabilities." },
    ],
  },
  {
    title: "Developer Experience",
    items: [
      { name: "TypeScript", desc: "Built with TypeScript. Full type safety and modern ESM modules." },
      { name: "Plugin System", desc: "Extend Loom with custom tools and capabilities via plugins." },
      { name: "Workspace Index", desc: "Index your codebase for fast symbol lookup and dependency analysis." },
      { name: "Configurable Safety", desc: "Granular control over shell access, file writes, and confirmation prompts." },
    ],
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.4 },
};

export default function FeaturesPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Features</h1>
          <p className="mt-2 text-muted">
            Everything Loom can do, organized by category.
          </p>
        </motion.div>

        {featureGroups.map((group) => (
          <section key={group.title} className="mt-12">
            <motion.h2
              {...fadeUp}
              className="text-xl font-semibold tracking-tight"
            >
              {group.title}
            </motion.h2>
            <div className="mt-4 space-y-0 divide-y divide-border rounded-xl border border-border">
              {group.items.map((item, i) => (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="p-4 first:rounded-t-xl last:rounded-b-xl hover:bg-surface/50"
                >
                  <h3 className="font-medium">{item.name}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">
                    {item.desc}
                  </p>
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

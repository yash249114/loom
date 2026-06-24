"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const features = [
  {
    title: "Local-first",
    desc: "Run entirely offline with Ollama. No cloud dependency, no data leaving your machine.",
    icon: "🖥️",
  },
  {
    title: "Multi-provider",
    desc: "Swap between Ollama, OpenAI, OpenRouter, Anthropic, Gemini, Groq — or chain them.",
    icon: "🔌",
  },
  {
    title: "Prompt-first",
    desc: "Type natural language prompts. No command memorization needed.",
    icon: "⌨️",
  },
  {
    title: "Auto-routing",
    desc: "Smart task routing picks the right model for coding, research, review, or debugging.",
    icon: "🧠",
  },
  {
    title: "Tool ecosystem",
    desc: "Read, write, edit files, run shell commands, search code — all through AI.",
    icon: "🔧",
  },
  {
    title: "Private by design",
    desc: "Your code never leaves your machine when using local models. No telemetry.",
    icon: "🔒",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5 },
};

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-24 pb-20 text-center">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative mx-auto max-w-3xl"
        >
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl text-white shadow-lg shadow-primary/30">
            L
          </div>
          <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Local-first AI coding agent
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
            Loom is a private, offline-capable AI coding assistant that works
            with Ollama, OpenAI, OpenRouter, and more. Type what you want and
            let AI do the rest.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/download"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-white shadow-lg shadow-primary/30 transition-all hover:bg-primary-dark"
            >
              Install Loom
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-6 text-sm font-medium transition-all hover:bg-surface"
            >
              Read the docs
            </Link>
          </div>
        </motion.div>

        {/* Terminal mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto mt-16 max-w-2xl overflow-hidden rounded-xl border border-border bg-[#0a0a0f] text-left font-mono text-sm shadow-2xl"
        >
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="ml-2 text-xs text-white/40">loom</span>
          </div>
          <div className="space-y-2 p-4 text-sm leading-relaxed text-white/80">
            <div>
              <span className="text-green-400">$</span> loom find the auth bug
            </div>
            <div className="text-white/50">
              [coding] → qwen/qwen3-coder:free (auto-routed)
            </div>
            <div className="text-blue-400">⚡ readfile</div>
            <div className="text-white/90">
              Analyzing src/auth/middleware.ts...
            </div>
            <div className="text-blue-400">⚡ searchfiles</div>
            <div className="text-white/90">
              Found JWT verification in 3 files
            </div>
            <div className="text-green-400">
              ✓ The token expiration check uses UTC seconds but the
              comparison uses milliseconds. Fixed in auth/middleware.ts:42.
            </div>
            <div className="text-white/50 mt-2">Done.</div>
          </div>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <motion.h2
            {...fadeUp}
            className="text-center text-3xl font-bold tracking-tight"
          >
            Everything you need, nothing you don&apos;t
          </motion.h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="group rounded-xl border border-border bg-surface p-6 transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="mb-3 text-2xl">{f.icon}</div>
                <h3 className="mb-1.5 font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="mx-auto max-w-xl rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/5 to-transparent p-10"
        >
          <h2 className="text-2xl font-bold tracking-tight">
            Ready to try Loom?
          </h2>
          <p className="mt-2 text-muted">
            Install in one line. No account needed. Works offline.
          </p>
          <div className="mt-6 flex justify-center">
            <code className="rounded-lg bg-[#0a0a0f] px-4 py-2 font-mono text-sm text-green-400">
              npm install -g loom-agent
            </code>
          </div>
          <Link
            href="/download"
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-white transition-all hover:bg-primary-dark"
          >
            View install guides
          </Link>
        </motion.div>
      </section>
    </>
  );
}

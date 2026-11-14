"use client";

import Link from "next/link";
import { motion, MotionConfig } from "framer-motion";
import { HeroCanvas } from "@/components/HeroCanvas";
import { Emblem } from "@/components/Emblem";
import { SectionLabel } from "@/components/SectionLabel";
import { CopyButton } from "@/components/CopyButton";

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as const },
};

const installCommand =
  "git clone https://github.com/yash249114/loom.git && cd loom && pnpm install && pnpm build && npm link";

const terminalSession = `$ loom run "add retry logic to the API client"

[router] coding → qwen/qwen3-coder:free (classified as coding)
[coding] → fallback: meta-llama/llama-3.3-70b-instruct:free
[coding] → local fallback: qwen2.5-coder:7b
⚡ readfile     src/api/client.ts
⚡ searchfiles  "retry|backoff"
⚡ editfile     src/api/client.ts

  14│+const RETRY_ATTEMPTS = 3;
  15│+const BASE_DELAY_MS = 1000;
  17│ async function requestWithRetry(url, options) {
  18│+  let lastError;
  19│+  for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
  20│     try {
  21│       return await fetch(url, options);
  22│+    } catch (err) {
  23│+      lastError = err;
  24│+      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
  25│+      await new Promise((r) => setTimeout(r, delay));
  26│+    }
  27│+  }
  28│+  throw lastError;

✓ Edited src/api/client.ts
Done.`;

const decisionBlock = `[router] Task: "refactor the auth middleware"
[router] Category: coding
[router] Mode: auto
[router] Selected: qwen/qwen3-coder:free @ openrouter
[router] Reason: coding prompt → coding model preference
[router] Fallbacks:
  1. meta-llama/llama-3.3-70b-instruct:free @ openrouter
  2. qwen2.5-coder:7b @ ollama`;

const tools = [
  ["readfile", "Read file contents with optional line range"],
  ["writefile", "Create or overwrite a file"],
  ["editfile", "Replace an exact string in a file"],
  ["patchfile", "Apply a unified diff patch"],
  ["listdir", "List a directory tree"],
  ["searchfiles", "Grep or glob across the workspace"],
  ["shell", "Run a command with timeout and safety gates"],
];

const capabilityGroups = [
  {
    title: "Sessions",
    items: ["Auto-saved per workspace", "Resume across restarts", "/sessions to list, load, delete"],
  },
  {
    title: "Safety",
    items: ["Shell confirmation by default", "Blocked command list", "Configurable sandbox flag"],
  },
  {
    title: "Repository index",
    items: ["File graph and symbol index", "Incremental rebuilds", "/search, /graph, /context"],
  },
  {
    title: "Memory",
    items: ["Notes and summaries in .loom/", "/memory to add and list", "Lexical retrieval over the index"],
  },
  {
    title: "MCP",
    items: ["External tool servers", "Configured in .loomrc.json", "/mcp to manage"],
  },
  {
    title: "Plugins",
    items: [".loom/plugins/*.js", "Custom tools via the registry", "Project and global scopes"],
  },
];

const platforms = [
  { name: "macOS", tone: "Supported", desc: "Apple Silicon and Intel. Any terminal." },
  { name: "Linux", tone: "Supported", desc: "Any distribution with Node.js and pnpm." },
  { name: "Windows", tone: "Supported", desc: "PowerShell, cmd, Git Bash. WSL 2 recommended." },
  { name: "Termux", tone: "Community · untested", desc: "Terminal CLI only — no Android APK." },
];

export default function HomePage() {
  return (
    <MotionConfig reducedMotion="user">
    <>
      <section className="relative overflow-hidden bg-black">
        <div className="mx-auto grid max-w-[1400px] gap-10 px-6 pb-16 pt-8 lg:min-h-[92vh] lg:grid-cols-2 lg:items-stretch lg:gap-14 lg:pt-14">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative order-2 min-h-[420px] overflow-hidden bg-cream lg:order-1 lg:min-h-[620px]"
          >
            <div className="absolute inset-0">
              <HeroCanvas />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#F4F0E9] via-[#F4F0E9]/90 to-transparent px-6 pb-6 pt-28">
              <div className="flex items-center gap-3">
                <span className="h-px w-12 bg-copper-dark" aria-hidden="true" />
                <span className="label-sm text-copper-dark">Loom 0.1.0-beta</span>
              </div>
              <p className="mt-4 max-w-md font-display text-2xl leading-[1.08] text-ink sm:text-3xl">
                Your models. Your workflow. One intelligent coding agent.
              </p>
            </div>
          </motion.div>

          <div className="order-1 flex flex-col justify-center lg:order-2">
            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="max-w-xl font-display-medium text-4xl leading-[0.95] tracking-tight text-ink-on-black sm:text-5xl lg:text-6xl"
            >
              One coding agent. Every model. Total control.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="mt-6 max-w-lg text-lg leading-relaxed text-ink-on-black/70"
            >
              Connect the AI providers you trust, bring your own keys, and route
              every coding task to the right model.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-9 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href="/download"
                className="label inline-flex items-center justify-center bg-copper px-6 py-3 text-cream transition-colors hover:bg-copper-dark"
              >
                Download Loom
              </Link>
              <Link
                href="/providers"
                className="label inline-flex items-center justify-center border border-ink-on-black/25 px-6 py-3 text-ink-on-black transition-colors hover:border-ink-on-black/50 hover:bg-ink-on-black/5"
              >
                Explore providers
              </Link>
              <a
                href="https://github.com/yash249114/loom"
                target="_blank"
                rel="noopener noreferrer"
                className="label inline-flex items-center justify-center gap-2 px-6 py-3 text-ink-on-black/55 transition-colors hover:text-copper-light"
              >
                View GitHub
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.9, delay: 0.35 }}
              className="mt-14 hidden lg:block"
            >
              <Emblem size={92} className="text-copper/70" />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-cream px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1400px]">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <motion.div {...reveal}>
              <SectionLabel number="01" label="The premise" />
            </motion.div>
            <motion.div {...reveal}>
              <p className="font-display text-2xl leading-snug text-ink sm:text-3xl">
                Loom is not another AI wrapper. It is a local-first coding agent
                that puts you in charge of which models run where — local,
                remote, or a chain of fallbacks.
              </p>
              <p className="mt-5 max-w-2xl text-ink/65 leading-relaxed">
                Your keys, your infrastructure, your rules. The agent reads,
                edits, searches and runs commands in your workspace, and keeps
                the routing decision visible instead of hiding it.
              </p>
            </motion.div>
          </div>

          <div className="mt-16 grid gap-px border section-rule bg-[color:var(--section-hairline)] md:grid-cols-3">
            {[
              {
                n: "01",
                title: "Own your models",
                desc: "Run fully offline with Ollama, or bring OpenRouter, Anthropic, Gemini and any OpenAI-compatible endpoint.",
              },
              {
                n: "02",
                title: "One agent, every task",
                desc: "A prompt-first TUI with seven tools: read, write, edit, patch, list, search and shell.",
              },
              {
                n: "03",
                title: "Local when you want it",
                desc: "Routing modes auto, local and remote, with a three-tier fallback down to local Ollama.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.n}
                {...reveal}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="bg-cream p-7"
              >
                <span className="label-sm text-accent">{item.n}</span>
                <h2 className="mt-4 font-display-medium text-xl text-ink">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-ink/65">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-black px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1400px]">
          <motion.div {...reveal} className="max-w-2xl">
            <SectionLabel number="02" label="Terminal demonstration" />
            <p className="mt-5 text-ink-on-black/60">
              A routing decision, three tool calls, one focused edit. Illustrative
              session, not a benchmark.
            </p>
          </motion.div>

          <motion.div {...reveal} className="mt-8 max-w-4xl border section-rule">
            <div className="flex items-center gap-2 border-b section-rule bg-ink-on-black/5 px-4 py-3">
              <span className="label-sm text-ink-on-black/45">loom</span>
            </div>
            <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-relaxed text-ink-on-black/80">
              <code>{terminalSession}</code>
            </pre>
          </motion.div>
        </div>
      </section>

      <section className="bg-cream px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1400px]">
          <motion.div {...reveal} className="max-w-2xl">
            <SectionLabel number="03" label="Architecture" />
            <p className="mt-5 text-ink/65">
              Keys and endpoints flow through provider adapters into the routing
              layer, then into the agent tool loop.
            </p>
          </motion.div>

          <motion.ol {...reveal} className="mt-12 grid gap-px border section-rule bg-[color:var(--section-hairline)] md:grid-cols-4">
            {[
              { title: "Keys & endpoints", desc: "Environment variables or .loomrc.json. OS keychain is planned." },
              { title: "Provider adapters", desc: "ollama · openai-compatible · anthropic · google" },
              { title: "Routing", desc: "auto | local | remote, plus a three-tier fallback chain" },
              { title: "Agent loop", desc: "Plan → execute → verify → iterate, with seven tools" },
            ].map((step, index) => (
              <li key={step.title} className="bg-cream p-6">
                <span className="label-sm text-accent">{String(index + 1).padStart(2, "0")}</span>
                <h2 className="mt-3 font-display-medium text-lg text-ink">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink/65">{step.desc}</p>
              </li>
            ))}
          </motion.ol>
        </div>
      </section>

      <section className="bg-black px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1400px]">
          <motion.div {...reveal} className="max-w-2xl">
            <SectionLabel number="04" label="Routing" />
            <p className="mt-5 text-ink-on-black/60">
              Three modes, a keyword task classifier, and a fallback chain that
              ends at local Ollama when it is configured.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-8 [&>*]:min-w-0 md:grid-cols-2">
            <motion.div {...reveal} className="space-y-6">
              <div className="border section-rule p-6">
                <h2 className="font-display-medium text-xl text-ink-on-black">Modes</h2>
                <dl className="mt-5 space-y-4 text-sm">
                  <div>
                    <dt className="label text-accent">auto</dt>
                    <dd className="mt-1 text-ink-on-black/70">
                      Keyword classification selects a coding, reasoning or
                      general model from your config.
                    </dd>
                  </div>
                  <div>
                    <dt className="label text-accent">local</dt>
                    <dd className="mt-1 text-ink-on-black/70">
                      Forces Ollama. Default model{" "}
                      <code className="bg-ink-on-black/10 px-1 font-mono">qwen2.5-coder:7b</code>.
                    </dd>
                  </div>
                  <div>
                    <dt className="label text-accent">remote</dt>
                    <dd className="mt-1 text-ink-on-black/70">
                      Cloud providers only, with the same fallback chain.
                    </dd>
                  </div>
                </dl>
              </div>
              <div className="border section-rule p-6">
                <h2 className="font-display-medium text-xl text-ink-on-black">Fallback chain</h2>
                <ol className="mt-5 space-y-3 text-sm text-ink-on-black/75">
                  <li>1. Primary model from the routing decision</li>
                  <li>2. Configured cloud fallback model</li>
                  <li>3. Local Ollama, when <code className="bg-ink-on-black/10 px-1 font-mono">fallbackToLocal</code> is on</li>
                </ol>
              </div>
            </motion.div>

            <motion.div {...reveal} className="border section-rule p-6">
              <h2 className="font-display-medium text-xl text-ink-on-black">Decision block</h2>
              <pre className="mt-4 overflow-x-auto font-mono text-[13px] leading-relaxed text-ink-on-black/75">
                <code>{decisionBlock}</code>
              </pre>
              <p className="mt-4 text-xs text-ink-on-black/40">
                Reasoning levels (LOW / MEDIUM / HIGH / XHIGH / MAX / AUTO) are
                planned. Today the router classifies the task, nothing more.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="bg-cream px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1400px]">
          <motion.div {...reveal} className="max-w-2xl">
            <SectionLabel number="05" label="Bring your own keys" />
            <p className="mt-5 text-ink/65">
              Configure providers with environment variables or{" "}
              <code className="bg-ink/10 px-1 font-mono">.loomrc.json</code>.
              Secrets are read from your environment; OS keychain storage is
              planned, not shipped.
            </p>
          </motion.div>

          <motion.div {...reveal} className="mt-12 grid gap-8 [&>*]:min-w-0 md:grid-cols-2">
            <div className="border section-rule p-6">
              <h2 className="font-display-medium text-xl text-ink">Environment variables</h2>
              <dl className="mt-5 space-y-3 text-sm">
                {[
                  ["OPENROUTER_API_KEY", "OpenRouter models"],
                  ["OPENAI_API_KEY", "OpenAI or another OpenAI-compatible server"],
                  ["ANTHROPIC_API_KEY", "Anthropic Claude models"],
                  ["GEMINI_API_KEY", "Google Gemini"],
                  ["GROQ_API_KEY", "Groq"],
                ].map(([name, desc]) => (
                  <div key={name}>
                    <dt className="font-mono text-xs text-copper-dark">{name}</dt>
                    <dd className="mt-1 text-ink/65">{desc}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="border section-rule p-6">
              <h2 className="font-display-medium text-xl text-ink">Endpoint configuration</h2>
              <pre className="mt-5 overflow-x-auto font-mono text-[13px] leading-relaxed text-ink/75">
                <code>{`{
  "providerEndpoints": {
    "openrouter": {
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKey": "\${OPENROUTER_API_KEY}"
    },
    "ollama": {
      "baseURL": "http://127.0.0.1:11434"
    },
    "custom-openai": {
      "baseURL": "http://localhost:1234/v1",
      "apiKey": "not-needed"
    }
  }
}`}</code>
              </pre>
              <p className="mt-4 text-xs text-ink/50">
                Keys are masked as <code className="font-mono">sk-or-v1-••••</code> in
                this example. Never commit real keys.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="bg-black px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1400px]">
          <motion.div {...reveal} className="max-w-2xl">
            <SectionLabel number="06" label="Capabilities" />
            <p className="mt-5 text-ink-on-black/60">
              Tools, sessions, safety, indexing, memory and MCP.
            </p>
          </motion.div>

          <motion.div {...reveal} className="mt-10">
            <table className="w-full border-t section-rule text-sm text-ink-on-black/75">
              <caption className="sr-only">Loom agent tools</caption>
              <thead>
                <tr className="border-b section-rule">
                  <th scope="col" className="label py-3 text-left text-accent">Tool</th>
                  <th scope="col" className="label py-3 text-left text-accent">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {tools.map(([tool, desc]) => (
                  <tr key={tool} className="border-b section-rule">
                    <td className="py-3 pr-6 font-mono text-copper-light">{tool}</td>
                    <td className="py-3 text-ink-on-black/65">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>

          <div className="mt-12 grid gap-px border section-rule bg-[color:var(--section-hairline)] md:grid-cols-2 lg:grid-cols-3">
            {capabilityGroups.map((group) => (
              <div key={group.title} className="bg-black p-6">
                <h2 className="font-display-medium text-lg text-ink-on-black">{group.title}</h2>
                <ul className="mt-3 space-y-2 text-sm text-ink-on-black/65">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 flex-shrink-0 bg-copper" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1400px]">
          <motion.div {...reveal} className="max-w-2xl">
            <SectionLabel number="07" label="Platform compatibility" />
            <p className="mt-5 text-ink/65">
              Runs anywhere Node.js 18.17+ runs. Terminal-first, not a GUI app.
            </p>
          </motion.div>

          <motion.div {...reveal} className="mt-12 grid gap-px border section-rule bg-[color:var(--section-hairline)] sm:grid-cols-2 lg:grid-cols-4">
            {platforms.map((platform) => (
              <div key={platform.name} className="bg-cream p-6">
                <h2 className="font-display-medium text-lg text-ink">{platform.name}</h2>
                <p className="mt-1 label-sm text-accent">{platform.tone}</p>
                <p className="mt-3 text-sm leading-relaxed text-ink/65">{platform.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="bg-black px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-[1400px]">
          <motion.div {...reveal} className="grid gap-10 [&>*]:min-w-0 lg:grid-cols-[1fr_1.2fr] lg:items-start">
            <div>
              <SectionLabel number="08" label="Install from source" />
              <p className="mt-5 max-w-md text-ink-on-black/60">
                There are no release binaries, no Homebrew formula, and the npm
                name <code className="bg-ink-on-black/10 px-1 font-mono">loom-agent</code>{" "}
                belongs to an unrelated project. Source install is the verified path.
              </p>
              <p className="mt-4 text-sm text-ink-on-black/45">
                Prerequisites: Node.js 18.17+, pnpm, git.
              </p>
            </div>

            <div className="relative border section-rule p-6">
              <CopyButton text={installCommand} className="absolute right-4 top-4" />
              <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-ink-on-black/80">
                <code>{`git clone https://github.com/yash249114/loom.git
cd loom
pnpm install
pnpm build
npm link          # exposes the loom command

loom --version
loom --help`}</code>
              </pre>
            </div>
          </motion.div>

          <motion.div {...reveal} className="mt-14 border-t section-rule pt-8">
            <Link
              href="https://github.com/yash249114/loom"
              target="_blank"
              rel="noopener noreferrer"
              className="label inline-flex items-center gap-2 border border-ink-on-black/25 px-6 py-3 text-ink-on-black transition-colors hover:border-ink-on-black/50 hover:bg-ink-on-black/5"
            >
              View the repository
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
    </MotionConfig>
  );
}

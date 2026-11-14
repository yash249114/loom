import { Metadata } from "next";
import Link from "next/link";
import { SectionLabel } from "@/components/SectionLabel";
import { Reveal } from "@/components/Reveal";
import { CopyButton } from "@/components/CopyButton";

export const metadata: Metadata = {
  title: "Documentation — Loom",
  description: "Command reference, configuration, routing, tools, sessions, memory and troubleshooting for Loom.",
};

const sections = [
  ["quick-start", "Quick start"],
  ["commands", "Commands"],
  ["configuration", "Configuration"],
  ["providers", "Providers"],
  ["routing", "Routing"],
  ["tools", "Tools"],
  ["sessions", "Sessions"],
  ["memory", "Memory"],
  ["extensions", "Extensions"],
  ["troubleshooting", "Troubleshooting"],
];

const quickStart = `git clone https://github.com/yash249114/loom.git
cd loom
pnpm install
pnpm build
npm link

loom            # interactive TUI
loom run "..."  # one-shot task`;

const commands = [
  ["loom", "Open the interactive TUI (default command)"],
  ["loom init", "Create a workspace .loomrc.json"],
  ["loom config", "Print the resolved configuration"],
  ["loom run <prompt>", "Run one task and exit"],
  ["loom run -p <provider>", "Force a provider for this run"],
  ["loom run --local", "Force local Ollama"],
  ["loom run -y", "Auto-approve tool confirmations"],
  ["loom chat", "Open the chat interface explicitly"],
  ["loom dashboard", "Open the dashboard view"],
  ["loom providers [-f] [-k]", "List providers; -f full, -k keys"],
  ["loom models [provider]", "List models, with --mode, --min-capability, --json"],
  ["loom sessions", "List saved sessions"],
  ["loom doctor [-f]", "Run environment and provider diagnostics"],
  ["loom index [-f] [-v]", "Build the workspace index"],
  ["loom memory [-a|-s|-l|-c]", "Add, search, list or clear memory notes"],
  ["loom mcp [-l|-a|-r|--start|--stop]", "Manage MCP servers"],
];

const configExample = `{
  "providerEndpoints": {
    "ollama": { "baseURL": "http://127.0.0.1:11434" },
    "openrouter": {
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKey": "\${OPENROUTER_API_KEY}"
    }
  }
}`;

export default function DocsPage() {
  return (
    <div className="bg-cream min-h-screen">
      <div className="mx-auto max-w-[1400px] px-6 py-16 lg:py-24">
        <Reveal>
          <SectionLabel number="—" label="Documentation" />
          <h1 className="mt-6 max-w-2xl font-display-medium text-4xl leading-[0.95] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Everything Loom can do, and nothing it cannot
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink/65">
            Commands, configuration, routing and tooling as implemented in the
            repository. Planned features are labelled as planned.
          </p>
        </Reveal>

        <div className="mt-16 grid gap-12 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Documentation sections" className="hidden lg:block">
            <div className="sticky top-28">
              <p className="label text-accent">On this page</p>
              <ul className="mt-4 space-y-2 border-l section-rule pl-4 text-sm">
                {sections.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`} className="text-ink/55 transition-colors hover:text-copper-dark">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          <div className="min-w-0">
            <section id="quick-start" className="scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Quick start</h2>
              <p className="mt-2 text-sm text-ink/60">
                Node.js 18.17+, pnpm and git are required. There is no npm or
                binary install yet.
              </p>
              <div className="relative mt-5 border section-rule p-5">
                <CopyButton text={quickStart} className="absolute right-3 top-3" />
                <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-ink/75">
                  <code>{quickStart}</code>
                </pre>
              </div>
            </section>

            <section id="commands" className="mt-14 scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Commands</h2>
              <p className="mt-2 text-sm text-ink/60">
                CLI entrypoints. Most flags are optional; run{" "}
                <code className="bg-ink/10 px-1 font-mono">loom &lt;command&gt; --help</code>{" "}
                for the exact set.
              </p>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full border-t section-rule text-sm">
                  <thead>
                    <tr className="border-b section-rule">
                      <th scope="col" className="label py-3 pr-6 text-left text-accent">Command</th>
                      <th scope="col" className="label py-3 text-left text-accent">What it does</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commands.map(([cmd, desc]) => (
                      <tr key={cmd} className="border-b section-rule">
                        <td className="whitespace-nowrap py-3 pr-6 font-mono text-[13px] text-copper-dark">{cmd}</td>
                        <td className="py-3 text-ink/65">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="configuration" className="mt-14 scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Configuration</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink/60">
                Loom reads <code className="bg-ink/10 px-1 font-mono">.loomrc.json</code> or{" "}
                <code className="bg-ink/10 px-1 font-mono">.loom/config.json</code> from the
                workspace, then from your home directory. The first file found wins;
                values of the form <code className="bg-ink/10 px-1 font-mono">${"{VAR}"}</code>{" "}
                are interpolated from the environment.
              </p>
              <div className="relative mt-5 border section-rule p-5">
                <CopyButton text={configExample} className="absolute right-3 top-3" />
                <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-ink/75">
                  <code>{configExample}</code>
                </pre>
              </div>
            </section>

            <section id="providers" className="mt-14 scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Providers</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink/60">
                Four adapters: <code className="bg-ink/10 px-1 font-mono">ollama</code>,{" "}
                <code className="bg-ink/10 px-1 font-mono">openai-compatible</code>,{" "}
                <code className="bg-ink/10 px-1 font-mono">anthropic</code> and{" "}
                <code className="bg-ink/10 px-1 font-mono">google</code>. Keys are read
                from the environment:
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  ["OPENROUTER_API_KEY", "OpenRouter"],
                  ["OPENAI_API_KEY", "OpenAI and compatible servers"],
                  ["ANTHROPIC_API_KEY", "Anthropic"],
                  ["GEMINI_API_KEY", "Google Gemini"],
                  ["GROQ_API_KEY", "Groq"],
                ].map(([name, desc]) => (
                  <li key={name} className="flex flex-wrap items-baseline gap-2 text-sm">
                    <code className="font-mono text-xs text-copper-dark">{name}</code>
                    <span className="text-ink/55">{desc}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink/55">
                Keys are not stored in an OS keychain yet. See{" "}
                <Link href="/providers" className="text-copper-dark underline underline-offset-2">
                  provider setup
                </Link>{" "}
                for endpoint examples.
              </p>
            </section>

            <section id="routing" className="mt-14 scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Routing</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink/60">
                Three modes: <strong className="font-medium text-ink">auto</strong> classifies
                the prompt by keyword into coding, reasoning or general and uses your
                configured model preference; <strong className="font-medium text-ink">local</strong>{" "}
                forces Ollama; <strong className="font-medium text-ink">remote</strong> uses
                cloud providers. The fallback chain is primary → cloud fallback → local
                Ollama, with the final step gated by configuration.
              </p>
              <pre className="mt-5 overflow-x-auto border section-rule p-5 font-mono text-[13px] leading-relaxed text-ink/75">
                <code>{`[router] Category: coding
[router] Mode: auto
[router] Selected: qwen/qwen3-coder:free @ openrouter

[fallbacks]
1. meta-llama/llama-3.3-70b-instruct:free @ openrouter
2. qwen2.5-coder:7b @ ollama`}</code>
              </pre>
            </section>

            <section id="tools" className="mt-14 scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Tools</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink/60">
                The agent loop has seven tools: readfile, writefile, editfile,
                patchfile, listdir, searchfiles and shell. Shell commands ask for
                confirmation unless you pass{" "}
                <code className="bg-ink/10 px-1 font-mono">-y</code> or disable the
                safety prompt in configuration.
              </p>
              <p className="mt-3 text-sm text-ink/55">
                The full parameter list lives on the{" "}
                <Link href="/features#tools" className="text-copper-dark underline underline-offset-2">
                  features page
                </Link>
                .
              </p>
            </section>

            <section id="sessions" className="mt-14 scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Sessions</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink/60">
                Conversations are saved per workspace via lowdb. Use{" "}
                <code className="bg-ink/10 px-1 font-mono">loom sessions</code> or{" "}
                <code className="bg-ink/10 px-1 font-mono">/sessions</code> inside the TUI to
                list, load or delete them.
              </p>
            </section>

            <section id="memory" className="mt-14 scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Memory</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink/60">
                Memory stores notes, summaries and project context as JSON in the
                workspace. Search is lexical — TF-IDF with cosine similarity over the
                stored notes and index. There are no embeddings and no vector database.
              </p>
              <pre className="mt-5 overflow-x-auto border section-rule p-5 font-mono text-[13px] leading-relaxed text-ink/75">
                <code>{`loom memory -a "Auth middleware uses jose, not jsonwebtoken"
loom memory -s "auth middleware"
loom memory -l`}</code>
              </pre>
            </section>

            <section id="extensions" className="mt-14 scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Extensions</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div className="border section-rule p-5">
                  <h3 className="font-medium text-ink">MCP servers</h3>
                  <p className="mt-2 text-sm text-ink/60">
                    Model Context Protocol servers are configured in{" "}
                    <code className="bg-ink/10 px-1 font-mono">.loomrc.json</code> and can be
                    started, stopped and listed with{" "}
                    <code className="bg-ink/10 px-1 font-mono">loom mcp</code>.
                  </p>
                </div>
                <div className="border section-rule p-5">
                  <h3 className="font-medium text-ink">Plugins</h3>
                  <p className="mt-2 text-sm text-ink/60">
                    Drop <code className="bg-ink/10 px-1 font-mono">.js</code> files into{" "}
                    <code className="bg-ink/10 px-1 font-mono">.loom/plugins/</code> to
                    register custom tools. Plugins load at startup; changing one
                    requires a restart.
                  </p>
                </div>
              </div>
            </section>

            <section id="troubleshooting" className="mt-14 scroll-mt-nav">
              <h2 className="font-display-medium text-2xl text-ink">Troubleshooting</h2>
              <dl className="mt-4 space-y-5 text-sm">
                {[
                  [
                    "loom: command not found",
                    "Run pnpm build and npm link from the cloned directory, then open a new shell.",
                  ],
                  [
                    "No providers detected",
                    "Run loom providers. For Ollama, confirm the daemon is running on port 11434.",
                  ],
                  [
                    "I installed loom-agent from npm and got something else",
                    "That package is unrelated. Uninstall it and build from source instead.",
                  ],
                  [
                    "Windows shell issues",
                    "Use WSL 2 or Git Bash. PowerShell 7+ also works but path handling differs.",
                  ],
                  [
                    "Something else",
                    "Run loom doctor and check the provider and index sections.",
                  ],
                ].map(([question, answer]) => (
                  <div key={question} className="border-b section-rule pb-5">
                    <dt className="font-medium text-ink">{question}</dt>
                    <dd className="mt-1 text-ink/60">{answer}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <div className="mt-14 flex flex-wrap gap-3 border-t section-rule pt-8">
              <Link
                href="/download"
                className="label bg-copper px-5 py-3 text-cream transition-colors hover:bg-copper-dark"
              >
                Install Loom
              </Link>
              <Link
                href="/changelog"
                className="label border border-hairline px-5 py-3 text-ink transition-colors hover:border-copper-dark hover:text-copper-dark"
              >
                Changelog
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

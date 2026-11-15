import { Metadata } from "next";
import Link from "next/link";
import { SectionLabel } from "@/components/SectionLabel";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Features — Loom",
  description: "Every Loom capability with an honest status: available, partial, or planned.",
};

type Status = "available" | "partial" | "planned";

interface Feature {
  name: string;
  desc: string;
  status: Status;
  details?: string[];
}

const featureGroups: { title: string; features: Feature[] }[] = [
  {
    title: "Core",
    features: [
      {
        name: "Prompt-first Ink TUI",
        desc: "Natural-language task entry with slash commands, a welcome screen and tab completion.",
        status: "available",
      },
      {
        name: "Multi-provider support",
        desc: "Ollama, OpenAI-compatible endpoints (OpenRouter, Groq, DeepSeek, Mistral, LM Studio, vLLM, llama.cpp), Anthropic, and Google Gemini.",
        status: "available",
      },
      {
        name: "Auto-routing",
        desc: "Keyword task classification into coding, reasoning or general categories, with auto, local and remote modes.",
        status: "available",
        details: [
          "Classification is keyword-based — not a learned classifier",
          "Model preference per category comes from your config",
        ],
      },
      {
        name: "Fallback chains",
        desc: "Primary → cloud fallback → local Ollama, when local fallback is enabled.",
        status: "available",
      },
      {
        name: "Dynamic model discovery",
        desc: "Fetches model lists from provider APIs and caches them with a TTL.",
        status: "partial",
        details: [
          "Discovery works for Ollama, OpenRouter, Anthropic, Gemini and OpenAI-compatible endpoints",
          "Capability metadata is inferred from model names, not reported by providers",
        ],
      },
      {
        name: "Reasoning levels",
        desc: "Map task complexity to LOW / MEDIUM / HIGH / XHIGH / MAX / AUTO effort.",
        status: "planned",
      },
    ],
  },
  {
    title: "Agent loop",
    features: [
      {
        name: "Seven native tools",
        desc: "readfile, writefile, editfile, patchfile, listdir, searchfiles and shell, driven by plan/execute/verify iterations.",
        status: "available",
      },
      {
        name: "Streaming output",
        desc: "Token-level streaming from the supported providers.",
        status: "available",
      },
      {
        name: "Verification loop",
        desc: "Opt-in: run your configured lint and build checks after edits and feed failures back to the agent.",
        status: "available",
      },
      {
        name: "Session persistence",
        desc: "Sessions are saved per workspace via lowdb and can be listed, loaded or deleted.",
        status: "available",
      },
      {
        name: "Safety layer",
        desc: "Shell confirmation prompts, a blocked command list, and a configurable sandbox flag.",
        status: "available",
      },
    ],
  },
  {
    title: "Intelligence & memory",
    features: [
      {
        name: "Workspace indexer",
        desc: "File graph and symbol index with incremental rebuilds.",
        status: "available",
        details: ["Inspect via /index, /search, /graph and /context"],
      },
      {
        name: "Memory notes",
        desc: "Store notes, summaries and project context; list and search them with /memory.",
        status: "available",
        details: ["Notes are persisted as JSON in the workspace", "Search is lexical, not semantic"],
      },
      {
        name: "Semantic memory & embeddings",
        desc: "Dense vector retrieval over embeddings.",
        status: "planned",
        details: [
          "Retrieval today is TF-IDF with cosine similarity",
          "No embedding model and no vector database backend",
        ],
      },
      {
        name: "Qdrant / pgvector backends",
        desc: "Pluggable dense vector storage for future retrieval.",
        status: "planned",
      },
    ],
  },
  {
    title: "Extensibility",
    features: [
      {
        name: "Plugin system",
        desc: "Custom tools as .loom/plugins/*.js, loaded per project and globally.",
        status: "available",
        details: ["No hot reload — restart Loom after changing a plugin"],
      },
      {
        name: "MCP server support",
        desc: "Connect Model Context Protocol servers for external tools, configured in .loomrc.json.",
        status: "available",
      },
      {
        name: "Native provider adapters",
        desc: "First-class adapters for Azure, Bedrock, Vertex, Together, Fireworks, Cohere and xAI.",
        status: "planned",
        details: ["Reachable today through the OpenAI-compatible adapter"],
      },
      {
        name: "OS keychain vault",
        desc: "Credential storage in the macOS Keychain, Windows Credential Manager or libsecret.",
        status: "planned",
        details: ["Today keys are read from environment variables or the config file"],
      },
    ],
  },
  {
    title: "Distribution",
    features: [
      {
        name: "Release binaries",
        desc: "Pre-built .dmg, .exe and .tar.gz artifacts via GitHub Releases.",
        status: "planned",
        details: [
          "Source install is the only verified path today",
          "esbuild bundling and Node SEA support exist in the codebase",
        ],
      },
      {
        name: "Homebrew formula",
        desc: "brew install loom.",
        status: "planned",
      },
      {
        name: "npm package",
        desc: "Global install from the npm registry.",
        status: "planned",
        details: ["The name loom-agent is taken by an unrelated package", "Do not run npm install -g loom-agent"],
      },
    ],
  },
  {
    title: "Diagnostics",
    features: [
      {
        name: "Cascading config",
        desc: "Workspace then home .loomrc.json, with ${VAR} environment interpolation.",
        status: "available",
      },
      {
        name: "Provider health tracking",
        desc: "Latency and error tracking per provider, used in /status and routing decisions.",
        status: "available",
      },
      {
        name: "Doctor command",
        desc: "Checks config validity, provider connectivity, Ollama status and index health.",
        status: "available",
      },
    ],
  },
];

const statusStyles: Record<Status, string> = {
  available: "bg-copper text-cream border-copper",
  partial: "bg-transparent text-copper-dark border-copper/40",
  planned: "bg-transparent text-ink/45 border-hairline",
};

const statusLabels: Record<Status, string> = {
  available: "Available",
  partial: "Partial",
  planned: "Planned",
};

const commandGroups = [
  {
    category: "Core",
    commands: [
      ["/help", "Show all commands"],
      ["/clear", "Clear the screen"],
      ["/quit, /exit", "Exit Loom"],
      ["/version", "Show the version"],
      ["/config", "Show configuration"],
      ["/doctor", "Run diagnostics"],
      ["/theme [list|<name>]", "Manage themes"],
    ],
  },
  {
    category: "Repository",
    commands: [
      ["/init", "Initialize the workspace"],
      ["/index", "Build the intelligence index"],
      ["/search <query>", "Search symbols and files"],
      ["/graph", "Show the dependency graph"],
      ["/context", "Show the context engine state"],
      ["/repo", "Repository overview"],
    ],
  },
  {
    category: "Providers",
    commands: [
      ["/providers, /connect", "List providers"],
      ["/models, /model", "List models"],
      ["/routing", "Configure routing"],
    ],
  },
  {
    category: "Agent",
    commands: [
      ["/agents", "List or switch agents"],
      ["/agent [status|switch <mode>|mode]", "Agent controls"],
      ["/memory [list|search <q>|add <note>|clear]", "Memory management"],
    ],
  },
  {
    category: "Sessions",
    commands: [
      ["/sessions, /session [list|new|load <id>|delete <id>]", "Session management"],
      ["/mcp [list|status]", "MCP servers"],
    ],
  },
  {
    category: "Dashboard",
    commands: [["/status, /overview", "Dashboard view"]],
  },
];

const tools = [
  ["readfile", "path, start?, end?", "Read a file, optionally a line range"],
  ["writefile", "path, content", "Create or overwrite a file"],
  ["editfile", "path, oldStr, newStr", "Replace an exact string"],
  ["patchfile", "path, patch", "Apply a unified diff"],
  ["listdir", "path, depth?", "List a directory tree"],
  ["searchfiles", "pattern, path?, type?", "Grep or glob search"],
  ["shell", "command, timeout?, confirm?", "Run a shell command"],
];

export default function FeaturesPage() {
  return (
    <div className="bg-cream min-h-screen">
      <div className="mx-auto w-full max-w-[1560px] px-6 page-y 2xl:max-w-[1680px]">
        <Reveal>
          <SectionLabel number="—" label="Catalogue" />
          <h1 className="type-h1 mt-6 max-w-2xl text-ink">
            Features, without the marketing fluff
          </h1>
          <p className="type-lead mt-5 max-w-xl text-ink/65">
            Every capability is tagged with what actually exists today. If it is
            not in the code, it is marked planned.
          </p>
          <div className="mt-8 flex flex-wrap gap-2" role="list" aria-label="Status legend">
            {(["available", "partial", "planned"] as Status[]).map((status) => (
              <span
                key={status}
                role="listitem"
                className={`border px-3 py-1 label-sm ${statusStyles[status]}`}
              >
                {statusLabels[status]}
              </span>
            ))}
          </div>
        </Reveal>

        {featureGroups.map((group, groupIndex) => (
          <section key={group.title} className="mt-16">
            <Reveal delay={groupIndex * 0.04}>
              <h2 className="type-h2 text-ink">{group.title}</h2>
            </Reveal>
            <dl className="mt-6 border-t section-rule">
              {group.features.map((feature) => (
                <div key={feature.name} className="border-b section-rule py-6">
                  <dt>
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="font-medium text-ink">{feature.name}</span>
                      <span className={`border px-2 py-0.5 label-sm ${statusStyles[feature.status]}`}>
                        {statusLabels[feature.status]}
                      </span>
                    </div>
                    <p className="mt-2 max-w-2xl text-sm text-ink/65">{feature.desc}</p>
                    {feature.details && (
                      <ul className="mt-2 max-w-2xl space-y-1 text-xs text-ink/50">
                        {feature.details.map((detail) => (
                          <li key={detail} className="flex gap-2">
                            <span className="mt-1.5 h-1 w-1 flex-shrink-0 bg-copper" aria-hidden="true" />
                            <span>{detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </dt>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="mt-20">
          <Reveal>
            <h2 className="type-h2 text-ink">Slash commands</h2>
            <p className="mt-2 text-sm text-ink/55">
              From <code className="bg-ink/10 px-1 font-mono">src/commands/definitions.ts</code>.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-px border section-rule bg-[color:var(--section-hairline)] md:grid-cols-2 lg:grid-cols-3">
            {commandGroups.map((group) => (
              <div key={group.category} className="bg-cream p-6">
                <h3 className="label text-accent">{group.category}</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  {group.commands.map(([name, desc]) => (
                    <div key={name}>
                      <dt className="font-mono text-[13px] text-copper-dark">{name}</dt>
                      <dd className="mt-0.5 text-ink/60">{desc}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </section>

        <section id="tools" className="mt-20 scroll-mt-nav">
          <Reveal>
            <h2 className="type-h2 text-ink">Tool reference</h2>
            <p className="mt-2 text-sm text-ink/55">
              Seven tools exposed to the agent loop.
            </p>
          </Reveal>
          <Reveal className="mt-8 overflow-x-auto">
            <table className="w-full border-t section-rule text-sm">
              <thead>
                <tr className="border-b section-rule">
                  <th scope="col" className="label py-3 pr-6 text-left text-accent">Tool</th>
                  <th scope="col" className="label py-3 pr-6 text-left text-accent">Parameters</th>
                  <th scope="col" className="label py-3 text-left text-accent">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {tools.map(([tool, params, desc]) => (
                  <tr key={tool} className="border-b section-rule">
                    <td className="whitespace-nowrap py-3 pr-6 font-mono text-copper-dark">{tool}</td>
                    <td className="whitespace-nowrap py-3 pr-6 font-mono text-xs text-ink/50">{params}</td>
                    <td className="py-3 text-ink/65">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </section>

        <Reveal className="mt-16 flex flex-wrap gap-3 border-t section-rule pt-8">
          <Link
            href="/providers"
            className="label inline-flex min-h-11 items-center border border-hairline px-5 py-3 text-ink transition-colors hover:border-copper-dark hover:text-copper-dark"
          >
            Provider setup
          </Link>
          <Link
            href="/download"
            className="label inline-flex min-h-11 items-center bg-copper px-5 py-3 text-cream transition-colors hover:bg-copper-dark"
          >
            Download
          </Link>
        </Reveal>
      </div>
    </div>
  );
}

import { Metadata } from "next";
import { SectionLabel } from "@/components/SectionLabel";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Changelog — Loom",
  description: "Release notes for Loom. One release so far: v0.1.0-beta, plus the unreleased website redesign.",
};

const releases = [
  {
    version: "0.1.0-beta",
    date: "2026-06-24",
    tag: "Initial beta release",
    unreleased: false,
    added: [
      "Prompt-first CLI with slash commands",
      "Multi-provider support: OpenRouter, Gemini, Groq, OpenAI, Ollama, Anthropic",
      "Auto-routing by task category",
      "Fallback chain: primary → cloud fallback → local",
      "Agent loop with planner/executor and native function calling",
      "Verification loop: run lint and build after edits",
      "File tools: read, write, edit, patch",
      "Search tools: glob, grep, symbol lookup",
      "Shell tool with streaming, timeout and safety controls",
      "Session persistence per workspace via lowdb",
      "Safety layer: confirmations, blocked commands, sandbox flag",
      "Plugin system for .loom/plugins/*.js",
      "Workspace indexer with incremental rebuilds",
      "Memory notes with lexical recall",
      "MCP server support",
      "Cascading .loomrc.json configuration with environment interpolation",
      "Build, bundle, test and SEA package scripts",
    ],
    docs: [
      "README, INSTALL, CONTRIBUTING, SECURITY",
      "Launch and release checklists",
    ],
    testing: [
      "Unit, integration and QA suites",
      "Config, routing, agents, tools, sessions and indexer coverage",
      "Provider failure and shell safety cases",
      "Performance benchmarks at 100, 500 and 1000 files",
    ],
    correction:
      "The original release note described memory as a vector store. The shipped implementation stores notes as JSON and searches them lexically; embeddings and a vector database are planned.",
  },
  {
    version: "Unreleased",
    date: null,
    tag: "Website redesign",
    unreleased: true,
    added: [
      "Editorial design system: cream canvas, black surround, copper accent",
      "Newsreader and Inter typography",
      "WebGL halftone particle hero with a 2D canvas fallback",
      "Providers page with four adapter implementations",
      "Documentation page with sticky section navigation",
      "Download page with platform selection and OS detection",
      "Honest feature status tags: available, partial, planned",
      "Changelog drawn from the real release notes",
      "Skip link, focus-visible styles, semantic landmarks, reduced-motion support",
    ],
    docs: [],
    testing: [
      "Production build and lint",
      "Manual checks at desktop and mobile widths",
    ],
    correction: null,
  },
];

export default function ChangelogPage() {
  return (
    <div className="bg-cream min-h-screen">
      <div className="mx-auto w-full max-w-[1560px] px-6 page-y 2xl:max-w-[1680px]">
        <Reveal>
          <SectionLabel number="—" label="Changelog" />
          <h1 className="type-h1 mt-6 text-ink">
            Changelog
          </h1>
          <p className="type-lead mt-5 max-w-xl text-ink/65">
            One release so far. Everything else on this site is unreleased work.
          </p>
        </Reveal>

        <div className="mt-16 space-y-12">
          {releases.map((release, index) => (
            <Reveal key={release.version} delay={index * 0.08}>
              <article
                className={`border section-rule p-6 md:p-8 ${
                  release.unreleased ? "bg-copper/5" : ""
                }`}
              >
                <header className="flex flex-wrap items-baseline gap-3 border-b section-rule pb-5">
                  <h2 className="font-display-medium text-2xl text-ink">
                    {release.unreleased ? release.version : `v${release.version}`}
                  </h2>
                  <span className="label-sm text-ink/45">
                    {release.date ?? "No release date"}
                  </span>
                  <span className="label-sm text-accent">{release.tag}</span>
                  {release.unreleased && (
                    <span className="border border-copper/40 px-2 py-0.5 label-sm text-copper-dark">
                      Unreleased
                    </span>
                  )}
                </header>

                <div className="mt-6 grid gap-8 [&>*]:min-w-0 md:grid-cols-2">
                  <section>
                    <h3 className="label text-accent">Added</h3>
                    <ul className="mt-3 space-y-2 text-sm text-ink/65">
                      {release.added.map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-2 h-1 w-1 flex-shrink-0 bg-copper" aria-hidden="true" />
                          <span className="break-words">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>

                  <div className="space-y-8">
                    {release.docs.length > 0 && (
                      <section>
                        <h3 className="label text-accent">Documentation</h3>
                        <ul className="mt-3 space-y-2 text-sm text-ink/65">
                          {release.docs.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {release.testing.length > 0 && (
                      <section>
                        <h3 className="label text-accent">Testing</h3>
                        <ul className="mt-3 space-y-2 text-sm text-ink/65">
                          {release.testing.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                </div>

                {release.correction && (
                  <p className="mt-6 border-t section-rule pt-5 text-xs leading-relaxed text-ink/50">
                    <span className="label-sm text-copper-dark">Correction · </span>
                    {release.correction}
                  </p>
                )}
              </article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14 border-t section-rule pt-8">
          <p className="text-sm text-ink/55">
            The authoritative history is the commit log on{" "}
            <a
              href="https://github.com/yash249114/loom"
              target="_blank"
              rel="noopener noreferrer"
              className="text-copper-dark underline underline-offset-2"
            >
              GitHub
            </a>
            .
          </p>
        </Reveal>
      </div>
    </div>
  );
}

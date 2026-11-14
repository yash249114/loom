import { Metadata } from "next";
import Link from "next/link";
import { SectionLabel } from "@/components/SectionLabel";
import { Reveal } from "@/components/Reveal";
import { CopyButton } from "@/components/CopyButton";
import { PlatformPanel } from "./PlatformPanel";

export const metadata: Metadata = {
  title: "Download & Install — Loom",
  description: "The verified way to install Loom: build from source. Requirements, platform notes, updating and uninstalling.",
};

const postInstall = [
  {
    title: "Start the agent",
    cmd: "loom",
    desc: "Opens the interactive prompt-first TUI.",
  },
  {
    title: "Run a one-shot task",
    cmd: 'loom run "explain the request pipeline"',
    desc: "Runs a single task and exits.",
  },
  {
    title: "Initialize the workspace",
    cmd: "loom init\nloom providers",
    desc: "Creates .loomrc.json and lists the providers it can reach.",
  },
  {
    title: "Go fully local",
    cmd: `ollama pull qwen2.5-coder:7b
loom run --local "summarize src/"`,
    desc: "Requires Ollama. No cloud calls, no API keys.",
  },
];

const updateSteps = `cd loom
git pull
pnpm install
pnpm build
# npm link still points at the built output
loom --version`;

const uninstallSteps = `npm unlink -g loom-agent
# Then delete the cloned directory
rm -rf /path/to/loom`;

export default function DownloadPage() {
  return (
    <div className="bg-cream min-h-screen">
      <div className="mx-auto max-w-[1400px] px-6 py-16 lg:py-24">
        <Reveal>
          <SectionLabel number="—" label="Install" />
          <h1 className="mt-6 max-w-2xl font-display-medium text-4xl leading-[0.95] tracking-tight text-ink sm:text-5xl lg:text-6xl">
            Build from source. That is the only path today.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink/65">
            No release binaries, no Homebrew formula, and no official npm
            package. Install with git, pnpm and npm link.
          </p>
        </Reveal>

        <Reveal className="mt-12">
          <PlatformPanel />
        </Reveal>

        <section className="mt-20">
          <Reveal>
            <h2 className="font-display-medium text-2xl text-ink">Prerequisites</h2>
          </Reveal>
          <Reveal className="mt-6 overflow-x-auto">
            <table className="w-full border-t section-rule text-sm">
              <thead>
                <tr className="border-b section-rule">
                  <th scope="col" className="label py-3 pr-6 text-left text-accent">Requirement</th>
                  <th scope="col" className="label py-3 pr-6 text-left text-accent">Version</th>
                  <th scope="col" className="label py-3 text-left text-accent">Check</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Node.js", "18.17 or newer", "node --version"],
                  ["pnpm", "Latest", "pnpm --version"],
                  ["Git", "Any", "git --version"],
                  ["Ollama", "Optional, for local models", "ollama --version"],
                ].map(([name, version, check]) => (
                  <tr key={name} className="border-b section-rule">
                    <td className="py-3 pr-6 font-medium text-ink">{name}</td>
                    <td className="py-3 pr-6 text-ink/60">{version}</td>
                    <td className="py-3 font-mono text-xs text-ink/55">{check}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </section>

        <section className="mt-20">
          <Reveal>
            <h2 className="font-display-medium text-2xl text-ink">After installing</h2>
          </Reveal>
          <div className="mt-8 space-y-px border section-rule bg-[color:var(--section-hairline)]">
            {postInstall.map((step, index) => (
              <Reveal key={step.title} className="grid gap-6 bg-cream p-6 md:grid-cols-[1fr_1.2fr]">
                <div>
                  <span className="label-sm text-accent">{String(index + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 font-display-medium text-lg text-ink">{step.title}</h3>
                  <p className="mt-2 text-sm text-ink/60">{step.desc}</p>
                </div>
                <div className="relative">
                  <CopyButton text={step.cmd} className="absolute right-3 top-3" />
                  <pre className="overflow-x-auto border section-rule p-4 font-mono text-[13px] leading-relaxed text-ink/75">
                    <code>{step.cmd}</code>
                  </pre>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <div className="mt-20 grid gap-8 lg:grid-cols-2">
          <section>
            <Reveal>
              <h2 className="font-display-medium text-2xl text-ink">Updating</h2>
            </Reveal>
            <Reveal className="relative mt-6 border section-rule p-6">
              <CopyButton text={updateSteps} className="absolute right-4 top-4" />
              <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-ink/75">
                <code>{updateSteps}</code>
              </pre>
            </Reveal>
          </section>

          <section>
            <Reveal>
              <h2 className="font-display-medium text-2xl text-ink">Uninstalling</h2>
            </Reveal>
            <Reveal className="relative mt-6 border section-rule p-6">
              <CopyButton text={uninstallSteps} className="absolute right-4 top-4" />
              <pre className="overflow-x-auto font-mono text-[13px] leading-relaxed text-ink/75">
                <code>{uninstallSteps}</code>
              </pre>
            </Reveal>
          </section>
        </div>

        <Reveal className="mt-20 border section-rule p-6 md:p-8">
          <h2 className="font-display-medium text-xl text-ink">Why there are no downloads</h2>
          <div className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed text-ink/65">
            <p>
              The GitHub Releases API for{" "}
              <code className="bg-ink/10 px-1 font-mono">yash249114/loom</code> returns an
              empty list. There are no <code className="bg-ink/10 px-1 font-mono">.dmg</code>,{" "}
              <code className="bg-ink/10 px-1 font-mono">.exe</code>,{" "}
              <code className="bg-ink/10 px-1 font-mono">.tar.gz</code> or APK artifacts.
            </p>
            <p>
              The npm name <code className="bg-ink/10 px-1 font-mono">loom-agent</code> is
              already taken by an unrelated project. Do not run{" "}
              <code className="bg-ink/10 px-1 font-mono">npm install -g loom-agent</code>;
              it installs the wrong software.
            </p>
            <p>
              Binary releases, a Homebrew formula and an official npm package are
              planned. Until they exist, building from source is the verified route.
            </p>
          </div>
        </Reveal>

        <Reveal className="mt-16 flex flex-wrap gap-3 border-t section-rule pt-8">
          <Link
            href="/docs"
            className="label bg-copper px-5 py-3 text-cream transition-colors hover:bg-copper-dark"
          >
            Read the docs
          </Link>
          <a
            href="https://github.com/yash249114/loom"
            target="_blank"
            rel="noopener noreferrer"
            className="label border border-hairline px-5 py-3 text-ink transition-colors hover:border-copper-dark hover:text-copper-dark"
          >
            View on GitHub
          </a>
        </Reveal>
      </div>
    </div>
  );
}

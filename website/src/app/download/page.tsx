"use client";

import { motion } from "framer-motion";

const installs = [
  {
    title: "npm (recommended)",
    desc: "Install globally via npm. Requires Node.js 18.17+.",
    code: "npm install -g loom-agent",
    note: "Then run `loom` in any project directory.",
  },
  {
    title: "pnpm",
    desc: "If you use pnpm as your package manager.",
    code: "pnpm add -g loom-agent",
  },
  {
    title: "Yarn",
    desc: "If you use Yarn as your package manager.",
    code: "yarn global add loom-agent",
  },
  {
    title: "Homebrew (macOS)",
    desc: "Coming soon — tap the Loom formula.",
    code: "brew install loom",
    pending: true,
  },
  {
    title: "Standalone binary",
    desc: "Download a pre-built binary for your platform (no Node.js required).",
    code: "# Windows\ncurl -fsSL -o loom.exe https://github.com/yash249114/loom/releases/latest/download/loom-windows-x64.exe\n\n# macOS (Intel)\ncurl -fsSL -o loom https://github.com/yash249114/loom/releases/latest/download/loom-darwin-x64\nchmod +x ./loom\n\n# macOS (Apple Silicon)\ncurl -fsSL -o loom https://github.com/yash249114/loom/releases/latest/download/loom-darwin-arm64\nchmod +x ./loom\n\n# Linux (x64)\ncurl -fsSL -o loom https://github.com/yash249114/loom/releases/latest/download/loom-linux-x64\nchmod +x ./loom\n\n# Linux (ARM64)\ncurl -fsSL -o loom https://github.com/yash249114/loom/releases/latest/download/loom-linux-arm64\nchmod +x ./loom",
  },
  {
    title: "Install script (Unix)",
    desc: "One-liner for macOS, Linux, and WSL.",
    code: "curl -fsSL https://raw.githubusercontent.com/yash249114/loom/main/install.sh | sh",
  },
  {
    title: "Install script (Windows PowerShell)",
    desc: "One-liner for Windows.",
    code: 'powershell -c "irm https://raw.githubusercontent.com/yash249114/loom/main/install.ps1 | iex"',
  },
];

const postInstall = [
  {
    title: "1. Run Loom",
    code: "loom",
    desc: "Starts the interactive prompt-first interface.",
  },
  {
    title: "2. Try a prompt",
    code: "loom explain the codebase",
    desc: "One-shot mode — routes your prompt to the best model.",
  },
  {
    title: "3. Configure providers",
    code: "loom init\nloom providers",
    desc: "Initialize a workspace and discover your AI providers.",
  },
  {
    title: "4. Set up local AI (optional)",
    code: "# Install Ollama\n# https://ollama.com/download\n\n# Pull a coding model\nollama pull qwen2.5-coder:7b\n\n# Run Loom locally\nloom --local",
    desc: "Fully offline AI coding. No cloud dependency.",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.4 },
};

export default function DownloadPage() {
  return (
    <div className="px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl text-white shadow-lg shadow-primary/30">
            L
          </div>
          <h1 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Install Loom
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-center text-muted">
            Choose your installation method. Loom works on Windows, macOS, and
            Linux.
          </p>
        </motion.div>

        <div className="mt-12 space-y-6">
          {installs.map((inst, i) => (
            <motion.div
              key={inst.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className={`rounded-xl border p-5 ${
                inst.pending
                  ? "border-border/50 opacity-60"
                  : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">
                    {inst.title}
                    {inst.pending && (
                      <span className="ml-2 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                        Coming soon
                      </span>
                    )}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted">{inst.desc}</p>
                </div>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-[#0a0a0f] p-3 font-mono text-sm text-green-400">
                <code>{inst.code}</code>
              </pre>
              {inst.note && (
                <p className="mt-2 text-xs text-muted">{inst.note}</p>
              )}
            </motion.div>
          ))}
        </div>

        <section className="mt-16">
          <motion.h2
            {...fadeUp}
            className="text-2xl font-bold tracking-tight"
          >
            After installing
          </motion.h2>
          <div className="mt-6 space-y-6">
            {postInstall.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className="rounded-xl border border-border p-5"
              >
                <h3 className="font-semibold">{step.title}</h3>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-[#0a0a0f] p-3 font-mono text-sm text-green-400">
                  <code>{step.code}</code>
                </pre>
                <p className="mt-2 text-sm text-muted">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

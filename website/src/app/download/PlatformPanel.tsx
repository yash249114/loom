"use client";

import { useState, useSyncExternalStore } from "react";
import { CopyButton } from "@/components/CopyButton";

type Platform = "macos" | "linux" | "windows" | "termux";

const platforms: { id: Platform; name: string; status: string }[] = [
  { id: "macos", name: "macOS", status: "Supported" },
  { id: "linux", name: "Linux", status: "Supported" },
  { id: "windows", name: "Windows", status: "Supported" },
  { id: "termux", name: "Termux", status: "Community · untested" },
];

const installCommands: Record<Platform, string> = {
  macos: `git clone https://github.com/yash249114/loom.git
cd loom
pnpm install
pnpm build
npm link

# Verify
loom --version`,
  linux: `git clone https://github.com/yash249114/loom.git
cd loom
pnpm install
pnpm build
npm link

# Verify
loom --version`,
  windows: `git clone https://github.com/yash249114/loom.git
cd loom
pnpm install
pnpm build
npm link

# Verify
loom --version

# Or run without linking
node dist/cli/index.js --help`,
  termux: `pkg install nodejs pnpm
git clone https://github.com/yash249114/loom.git
cd loom
pnpm install
pnpm build
npm link

# Ollama does not run on Android.
# Use a remote provider instead.`,
};

const notes: Record<Platform, string[]> = {
  macos: [
    "Apple Silicon and Intel are both supported.",
    "No Homebrew formula and no .dmg build yet.",
  ],
  linux: [
    "Any distribution with glibc 2.28 or newer.",
    "No .tar.gz or distro package yet.",
  ],
  windows: [
    "WSL 2 is the most compatible environment.",
    "PowerShell 7+ and Git Bash work natively.",
    "No .exe build yet.",
  ],
  termux: [
    "Community maintained, not officially tested.",
    "Ollama is unavailable — use remote providers.",
    "This is a terminal CLI, not an Android app.",
  ],
};

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("android")) return "termux";
  if (ua.includes("mac")) return "macos";
  if (ua.includes("win")) return "windows";
  return "linux";
}

const subscribe = () => () => {};

export function PlatformPanel() {
  const [selected, setSelected] = useState<Platform | null>(null);
  const detected = useSyncExternalStore<Platform | null>(
    subscribe,
    detectPlatform,
    () => null,
  );
  const active = selected ?? detected ?? "macos";

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Operating system">
        {platforms.map((platform) => {
          const isActive = active === platform.id;
          return (
            <button
              key={platform.id}
              type="button"
              role="tab"
              id={`${platform.id}-tab`}
              aria-selected={isActive}
              aria-controls={`${platform.id}-panel`}
              onClick={() => setSelected(platform.id)}
              className={`label inline-flex min-h-11 flex-wrap items-center gap-x-2 border px-4 py-2.5 transition-colors ${
                isActive
                  ? "border-copper bg-copper text-cream"
                  : "border-hairline text-ink/60 hover:border-copper-dark hover:text-copper-dark"
              }`}
            >
              {platform.name}
              <span className={`label-sm ${isActive ? "text-[#F4F0E9]/70" : "text-ink/35"}`}>
                {platform.status}
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${active}-panel`}
        aria-labelledby={`${active}-tab`}
        className="mt-8 grid gap-8 [&>*]:min-w-0 lg:grid-cols-2"
      >
        <div className="border section-rule p-6">
          <h2 className="font-display-medium text-xl text-ink">
            {platforms.find((platform) => platform.id === active)?.name}
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-ink/65">
            {notes[active].map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-2 h-1 w-1 flex-shrink-0 bg-copper" aria-hidden="true" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex min-h-0 flex-col border section-rule">
          <div className="flex justify-end border-b section-rule px-3 py-2">
            <CopyButton text={installCommands[active]} />
          </div>
          <pre className="min-h-0 flex-1 overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-ink/75 sm:p-6">
            <code>{installCommands[active]}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

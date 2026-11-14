import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";

const productLinks = [
  { href: "/features", label: "Features" },
  { href: "/providers", label: "Providers" },
  { href: "/docs", label: "Documentation" },
  { href: "/changelog", label: "Changelog" },
  { href: "/download", label: "Download" },
];

const projectLinks = [
  { href: "https://github.com/yash249114/loom", label: "GitHub", external: true },
  { href: "https://github.com/yash249114/loom/releases", label: "Releases", external: true },
  { href: "https://github.com/yash249114/loom/issues", label: "Issues", external: true },
  { href: "https://github.com/yash249114/loom/blob/main/LICENSE", label: "License (MIT)", external: true },
];

const installCommand = "git clone https://github.com/yash249114/loom.git && cd loom && pnpm install && pnpm build && npm link";

export function Footer() {
  return (
    <footer className="bg-black border-t section-rule" role="contentinfo">
      <div className="mx-auto max-w-[1400px] px-6 py-12 lg:py-16">
        <div className="grid gap-8 md:grid-cols-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 font-display-medium text-xl tracking-tight text-ink-on-black" aria-label="Loom home">
              <span className="relative flex h-8 w-8 items-center justify-center" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="14" cy="14" r="12" stroke="#B4552D" strokeWidth="2" />
                  <circle cx="14" cy="14" r="8" stroke="#B4552D" strokeWidth="1.5" strokeDasharray="4 4" />
                  <circle cx="14" cy="14" r="4" fill="#B4552D" />
                </svg>
              </span>
              LOOM
            </Link>
            <p className="mt-4 max-w-xs text-sm text-ink-on-black/60 leading-relaxed">
              Loom is a local-first, multi-model AI coding agent for the terminal.
              Connect your models, bring your own keys, and route every task to the right model.
            </p>
          </div>

          <nav aria-label="Product">
            <h3 className="label text-copper mb-3">Product</h3>
            <ul className="space-y-2">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-ink-on-black/60 hover:text-copper transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Project">
            <h3 className="label text-copper mb-3">Project</h3>
            <ul className="space-y-2">
              {projectLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="text-sm text-ink-on-black/60 hover:text-copper transition-colors"
                  >
                    {link.label}
                    {link.external && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1 -mt-0.5" aria-hidden="true">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                      </svg>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="label text-copper mb-3">Install</h3>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-ink-on-black/50">
                Source install (Node.js ≥ 18.17, pnpm required):
              </p>
              <CopyButton
                text={installCommand}
                className="flex-shrink-0 px-2 py-1 text-xs"
              />
            </div>
            <code className="mt-3 block font-mono text-xs bg-ink-on-black/10 p-3 text-ink-on-black/80 overflow-x-auto whitespace-pre-wrap break-all">
              {installCommand}
            </code>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t section-rule flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-ink-on-black/40">
            Loom is an independent open-source project. Version 0.1.0-beta.
          </p>
          <p className="text-sm text-ink-on-black/40">
            <a
              href="https://github.com/yash249114/loom"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-copper transition-colors underline underline-offset-2"
            >
              https://github.com/yash249114/loom
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
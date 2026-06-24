import Link from "next/link";

const footerLinks = [
  { href: "/features", label: "Features" },
  { href: "/docs", label: "Documentation" },
  { href: "/download", label: "Download" },
  { href: "/changelog", label: "Changelog" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-muted">
          <span className="font-bold text-foreground">Loom</span>
          <span>— Local-first AI coding agent</span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted">
          {footerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/yash249114/loom"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}

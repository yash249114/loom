"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/features", label: "Features" },
  { href: "/docs", label: "Docs" },
  { href: "/download", label: "Download" },
  { href: "/changelog", label: "Changelog" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white text-sm font-bold">
            L
          </span>
          Loom
        </Link>

        <div className="hidden items-center gap-6 sm:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm transition-colors hover:text-primary ${
                pathname === link.href ? "text-primary font-medium" : "text-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="flex flex-col gap-1 sm:hidden"
          aria-label="Menu"
        >
          <span className={`h-0.5 w-5 bg-foreground transition-all ${open ? "rotate-45 translate-y-1.5" : ""}`} />
          <span className={`h-0.5 w-5 bg-foreground transition-all ${open ? "opacity-0" : ""}`} />
          <span className={`h-0.5 w-5 bg-foreground transition-all ${open ? "-rotate-45 -translate-y-1.5" : ""}`} />
        </button>
      </div>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-t border-border bg-background px-4 py-4 sm:hidden"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className={`block py-2 text-sm ${pathname === link.href ? "text-primary font-medium" : "text-muted"}`}
            >
              {link.label}
            </Link>
          ))}
        </motion.div>
      )}
    </nav>
  );
}

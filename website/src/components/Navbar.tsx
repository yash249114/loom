"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const links = [
  { href: "/", label: "Product" },
  { href: "/features", label: "Features" },
  { href: "/providers", label: "Providers" },
  { href: "/docs", label: "Documentation" },
  { href: "/changelog", label: "Changelog" },
  { href: "/download", label: "Download" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const previousPath = useRef(pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onDark = pathname === "/" && !scrolled;
  const shell =
    scrolled || pathname !== "/"
      ? "bg-[#F4F0E9]/95 border-b border-hairline"
      : "bg-transparent border-b border-transparent";
  const logoTone = onDark ? "text-ink-on-black" : "text-ink";
  const linkTone = onDark
    ? "text-ink-on-black/60 hover:text-copper-light"
    : "text-ink/60 hover:text-copper-dark";
  const activeTone = onDark ? "text-copper-light" : "text-copper-dark";
  const burgerTone = onDark ? "bg-ink-on-black" : "bg-ink";

  return (
    <header className={`sticky top-0 z-50 h-16 transition-colors duration-300 ${shell}`}>
      <nav
        className="mx-auto flex h-full max-w-[1400px] items-center justify-between px-6"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className={`flex items-center gap-2 font-display-medium text-xl tracking-tight transition-colors ${logoTone}`}
          aria-label="Loom home"
        >
          <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <circle cx="14" cy="14" r="12" stroke="#B4552D" strokeWidth="2" />
            <circle cx="14" cy="14" r="8" stroke="#B4552D" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx="14" cy="14" r="4" fill="#B4552D" />
          </svg>
          LOOM
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`label text-sm transition-colors ${
                pathname === link.href ? activeTone : linkTone
              }`}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/yash249114/loom"
            target="_blank"
            rel="noopener noreferrer"
            className={`label text-sm transition-colors ${linkTone}`}
          >
            GitHub
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex flex-col gap-1.5 p-1 md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
        >
          <span className={`h-0.5 w-6 transition-all ${burgerTone} ${open ? "translate-y-2 rotate-45" : ""}`} aria-hidden="true" />
          <span className={`h-0.5 w-6 transition-all ${burgerTone} ${open ? "opacity-0" : ""}`} aria-hidden="true" />
          <span className={`h-0.5 w-6 transition-all ${burgerTone} ${open ? "-translate-y-2 -rotate-45" : ""}`} aria-hidden="true" />
        </button>
      </nav>

      {open && (
        <motion.div
          id="mobile-menu"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="border-t border-hairline bg-cream px-6 pb-4 md:hidden"
        >
          <div className="flex flex-col gap-1 pt-4">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`label py-2.5 transition-colors ${
                  pathname === link.href ? "text-copper-dark" : "text-ink/60 hover:text-copper-dark"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://github.com/yash249114/loom"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="label py-2.5 text-ink/60 transition-colors hover:text-copper-dark"
            >
              GitHub
            </a>
          </div>
        </motion.div>
      )}
    </header>
  );
}

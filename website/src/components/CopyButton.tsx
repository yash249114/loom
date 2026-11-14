"use client";

import { useState, useCallback } from "react";

export function CopyButton({
  text,
  children,
  className = "",
  onCopy,
}: {
  text: string;
  children?: React.ReactNode;
  className?: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [text, onCopy]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 text-sm font-ui font-medium
        border border-hairline bg-cream text-ink transition-colors
        hover:bg-ink hover:text-cream focus-visible:outline-copper
        ${copied ? "bg-copper text-cream border-copper" : ""}
        ${className}
      `}
      aria-label={copied ? "Copied to clipboard" : `Copy: ${text.slice(0, 50)}...`}
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Copied</span>
        </>
      ) : children || (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
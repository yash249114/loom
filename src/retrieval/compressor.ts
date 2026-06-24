import type { RepoFile, ContextPackage } from "./types.js";
import { estimateTokens } from "./builder.js";

export interface CompressOptions {
  stripComments: boolean;
  stripBlankLines: boolean;
  stripEmptyImports: boolean;
  truncateLines: boolean;
  maxLineLength: number;
  shortenSymbolNames: boolean;
}

const DEFAULT_COMPRESS: CompressOptions = {
  stripComments: true,
  stripBlankLines: true,
  stripEmptyImports: true,
  truncateLines: false,
  maxLineLength: 200,
  shortenSymbolNames: false,
};

const COMMENT_RE = /\/\/.*$/gm;
const BLOCK_COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const EMPTY_IMPORT_RE = /^import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/gm;
const IMPORT_WITH_DEFAULT_RE = /^import\s+\w+\s*,?\s*\{[^}]*\}\s+from\s+['"][^'"]+['"];?\s*$/gm;
const REQUIRE_RE = /(const|let|var)\s+\w+\s*=\s*require\(['"][^'"]+['"]\);?\s*$/gm;

const SINGLE_LINE_RE = /^\s*\n/gm;

export function compressContent(content: string, options: Partial<CompressOptions> = {}): string {
  const opts = { ...DEFAULT_COMPRESS, ...options };
  let result = content;

  if (opts.stripComments) {
    result = result.replace(BLOCK_COMMENT_RE, "");
    result = result.replace(COMMENT_RE, "");
  }

  if (opts.stripEmptyImports) {
    result = result.replace(EMPTY_IMPORT_RE, "");
    result = result.replace(IMPORT_WITH_DEFAULT_RE, "");
    result = result.replace(REQUIRE_RE, "");
  }

  if (opts.stripBlankLines) {
    result = result.replace(SINGLE_LINE_RE, "\n");
    result = result.replace(SINGLE_LINE_RE, "\n");
    result = result.replace(/^\n+/, "");
    result = result.replace(/\n{3,}/g, "\n\n");
  }

  if (opts.truncateLines) {
    result = result
      .split("\n")
      .map((line) =>
        line.length > opts.maxLineLength
          ? line.slice(0, opts.maxLineLength) + ` // ... truncated [${line.length - opts.maxLineLength} more chars]`
          : line
      )
      .join("\n");
  }

  return result.trim();
}

export function compressFile(file: RepoFile, options?: Partial<CompressOptions>): RepoFile {
  return {
    ...file,
    content: compressContent(file.content, options),
  };
}

export function compressPackage(
  pkg: ContextPackage,
  options?: Partial<CompressOptions>
): ContextPackage {
  const compressedFiles = pkg.files.map((f) => compressFile(f, options));
  const compressedContent = compressedFiles.map((f) => f.content).join("\n\n");

  const totalTokens = estimateTokens(compressedContent);
  const originalTokens = pkg.originalTokens;

  return {
    ...pkg,
    files: compressedFiles,
    totalTokens,
    originalTokens,
    compressionRatio:
      originalTokens > 0
        ? Number((1 - totalTokens / originalTokens).toFixed(4))
        : 0,
  };
}

export { estimateTokens };

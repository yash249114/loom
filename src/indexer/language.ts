import path from "node:path";
import type { Language } from "./types.js";

const EXT_MAP: Record<string, Language> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
};

export function detectLanguage(filePath: string): Language {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_MAP[ext] ?? "unknown";
}

export function getScanPatterns(): string[] {
  return ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts",
          "**/*.js", "**/*.jsx", "**/*.mjs", "**/*.cjs",
          "**/*.py", "**/*.go"];
}

export function isSupported(language: Language): boolean {
  return language !== "unknown";
}

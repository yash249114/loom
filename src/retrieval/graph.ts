import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import type { RepoFile, Symbol, Dependency, RepositoryGraph, SymbolKind } from "./types.js";

const IGNORE = ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.loom/**", "**/*.min.*", "**/*.map"];

const EXT_LANG: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescript",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".json": "json",
  ".md": "markdown",
  ".css": "css",
  ".html": "html",
  ".py": "python",
  ".rs": "rust",
  ".go": "go",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
};

const IMPORT_RE = /(?:import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))?)\s+from\s+['"]([^'"]+)['"])|(?:const\s+\w+\s*=\s*require\(['"]([^'"]+)['"]\))/g;
const EXPORT_FN_RE = /export\s+(?:async\s+)?function\s+(\w+)/g;
const EXPORT_CLASS_RE = /export\s+class\s+(\w+)/g;
const EXPORT_INTERFACE_RE = /export\s+interface\s+(\w+)/g;
const EXPORT_TYPE_RE = /export\s+type\s+(\w+)/g;
const EXPORT_ENUM_RE = /export\s+enum\s+(\w+)/g;
const EXPORT_CONST_RE = /export\s+(?:const|let|var)\s+(\w+)/g;
const EXPORT_DEFAULT_FN_RE = /export\s+default\s+(?:async\s+)?function\s+(\w+)/g;
const FN_RE = /(?:async\s+)?function\s+(\w+)/g;
const CLASS_RE = /class\s+(\w+)/g;
const INTERFACE_RE = /interface\s+(\w+)/g;
const TYPE_RE = /type\s+(\w+)\s*=/g;
const ENUM_RE = /enum\s+(\w+)/g;
const CONST_RE = /^(?:export\s+)?(?:const|let|var)\s+(\w+)/gm;
const COMPONENT_RE = /(?:export\s+)?(?:function|const)\s+(\w+)\s*(?:=\s*(?:\(|\w+\)\s*=>)|\([^)]*\)\s*(?::\s*\w+)?\s*=>)/g;
const JSDOC_RE = /\/\*\*[\s\S]*?\*\//g;

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return EXT_LANG[ext] || "unknown";
}

function extractSymbols(filePath: string, content: string, lines: string[]): Symbol[] {
  const symbols: Symbol[] = [];
  const ext = path.extname(filePath);

  if (![".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) return symbols;

  const docMap = new Map<number, string>();
  let match: RegExpExecArray | null;
  while ((match = JSDOC_RE.exec(content)) !== null) {
    const lineNum = content.slice(0, match.index).split("\n").length;
    docMap.set(lineNum, match[0]);
  }

  const addMatch = (re: RegExp, kind: SymbolKind, getDoc = true) => {
    re.lastIndex = 0;
    while ((match = re.exec(content)) !== null) {
      const lineNum = content.slice(0, match.index).split("\n").length;
      let doc: string | undefined;
      if (getDoc) {
        for (let l = lineNum - 1; l >= Math.max(0, lineNum - 10); l--) {
          const d = docMap.get(l);
          if (d) { doc = d; break; }
        }
      }
      symbols.push({ name: match[1], kind, file: filePath, line: lineNum, doc });
    }
  };

  addMatch(EXPORT_DEFAULT_FN_RE, "function");
  addMatch(EXPORT_FN_RE, "function");
  addMatch(EXPORT_CLASS_RE, "class");
  addMatch(EXPORT_INTERFACE_RE, "interface");
  addMatch(EXPORT_TYPE_RE, "type");
  addMatch(EXPORT_ENUM_RE, "enum");
  addMatch(EXPORT_CONST_RE, "variable");
  addMatch(FN_RE, "function");
  addMatch(CLASS_RE, "class");
  addMatch(INTERFACE_RE, "interface");
  addMatch(TYPE_RE, "type");
  addMatch(ENUM_RE, "enum");
  addMatch(CONST_RE, "variable");

  if ([".tsx", ".jsx"].includes(ext)) {
    addMatch(COMPONENT_RE, "component");
  }

  return symbols;
}

function extractDependencies(filePath: string, content: string): Dependency[] {
  const deps: Dependency[] = [];
  let match: RegExpExecArray | null;

  while ((match = IMPORT_RE.exec(content)) !== null) {
    const target = match[1] || match[2];
    if (!target || target.startsWith(".") || target.startsWith("@/") || target.startsWith("~")) {
      if (target) {
        const importLine = content.slice(0, match.index).split("\n").length;
        const names: string[] = [];
        const namedMatch = match[0].match(/\{([^}]+)\}/);
        if (namedMatch) {
          names.push(...namedMatch[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean));
        }
        // relative/local modules
        deps.push({ source: filePath, target, type: match[0].includes("require") ? "require" : "import", names });
      }
    }
    if ((target && !target.startsWith(".") && !target.startsWith("@/") && !target.startsWith("~"))) {
      deps.push({ source: filePath, target, type: match[0].includes("require") ? "require" : "import", names: [] });
    }
  }

  // dynamic imports
  const DYNAMIC_IMPORT_RE = /import\(['"]([^'"]+)['"]\)/g;
  while ((match = DYNAMIC_IMPORT_RE.exec(content)) !== null) {
    deps.push({ source: filePath, target: match[1], type: "dynamic", names: [] });
  }

  return deps;
}

export async function buildGraph(rootDir: string): Promise<RepositoryGraph> {
  const files = new Map<string, RepoFile>();
  const symbolsMap = new Map<string, Symbol[]>();
  const dependencyIndex = new Map<string, string[]>();
  const reverseDeps = new Map<string, string[]>();

  const MAX_SIZE = 1_000_000;

  const entries = await fg("**/*", {
    cwd: rootDir,
    ignore: IGNORE,
    onlyFiles: true,
    dot: false,
    absolute: false,
  });

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry);

    try {
      const stat = await fs.stat(fullPath);
      if (stat.size > MAX_SIZE || stat.size === 0) continue;

      const content = await fs.readFile(fullPath, "utf8");
      const lines = content.split("\n");
      const language = detectLanguage(entry);
      const symbols = extractSymbols(entry, content, lines);
      const dependencies = extractDependencies(entry, content);

      const repoFile: RepoFile = {
        path: entry,
        size: stat.size,
        language,
        content,
        symbols,
        dependencies,
      };

      files.set(entry, repoFile);
      symbolsMap.set(entry, symbols);

      if (dependencies.length > 0) {
        dependencyIndex.set(
          entry,
          dependencies.map((d) => d.target)
        );
      }

      for (const dep of dependencies) {
        const existing = reverseDeps.get(dep.target) || [];
        existing.push(entry);
        reverseDeps.set(dep.target, existing);
      }
    } catch {
      continue;
    }
  }

  return { files, symbols: symbolsMap, dependencyIndex, reverseDeps };
}

export function resolveLocalDependency(
  sourceFile: string,
  target: string,
  files: Map<string, RepoFile>
): RepoFile | undefined {
  const dir = path.dirname(sourceFile);
  const candidates = [
    path.normalize(path.join(dir, target)),
    path.normalize(path.join(dir, target + ".ts")),
    path.normalize(path.join(dir, target + ".tsx")),
    path.normalize(path.join(dir, target + ".js")),
    path.normalize(path.join(dir, target + ".jsx")),
    path.normalize(path.join(dir, target, "index.ts")),
    path.normalize(path.join(dir, target, "index.tsx")),
    path.normalize(path.join(dir, target, "index.js")),
    path.normalize(path.join(dir, target, "index.jsx")),
  ];

  for (const c of candidates) {
    const normalized = c.replace(/\\/g, "/");
    if (files.has(normalized)) return files.get(normalized);
  }
  return undefined;
}

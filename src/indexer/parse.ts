import type { IndexSymbol, FileDependency, ParseResult, Language } from "./types.js";

export function parseFile(
  content: string,
  filePath: string,
  language: Language
): ParseResult {
  switch (language) {
    case "typescript":
    case "javascript":
      return parseJsTs(content, filePath);
    case "python":
      return parsePython(content, filePath);
    case "go":
      return parseGo(content, filePath);
    default:
      return { symbols: [], dependencies: [] };
  }
}

function normalizePath(fp: string): string {
  return fp.replace(/\\/g, "/");
}

/* ─── JS/TS ─────────────────────────────────────────────────── */

function parseJsTs(
  content: string,
  filePath: string
): ParseResult {
  const symbols: IndexSymbol[] = [];
  const dependencies: FileDependency[] = [];
  const sourcePath = normalizePath(filePath);
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;
    const col = rawLine.search(/\S/) + 1 || 1;

    if (!trimmed) continue;

    const line = trimmed.replace(/\/\/.*$/, "").trim();
    if (!line) continue;

    /* ── dependencies ── */

    if (line.includes("import") || line.includes("require") || line.includes("from") || line.includes("import(")) {
      if (line.startsWith("import ") || line.startsWith("import(")) {
        const singleImport = line.match(
          /^import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+(?:\s*,\s*(?:\{[^}]*\}|\w+))?)\s+from\s+['"]([^'"]+)['"]/
        );
        if (singleImport) {
          const target = singleImport[1];
          const syms = extractImportNames(line);
          dependencies.push({
            source: sourcePath,
            target,
            type: line.includes("import type ") ? "type-import" : "import",
            symbols: syms,
          });
        } else {
          const bareImport = line.match(/^import\s+['"]([^'"]+)['"]/);
          if (bareImport) {
            dependencies.push({
              source: sourcePath,
              target: bareImport[1],
              type: "import",
            });
          }
        }
      }

      const requireMatch = line.match(
        /(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/
      );
      if (requireMatch) {
        dependencies.push({
          source: sourcePath,
          target: requireMatch[2],
          type: "require",
          symbols: [requireMatch[1]],
        });
      }

      const exportFromMatch = line.match(
        /^export\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\*)\s+from\s+['"]([^'"]+)['"]/
      );
      if (exportFromMatch) {
        dependencies.push({
          source: sourcePath,
          target: exportFromMatch[1],
          type: "import",
        });
      }

      const dynamicImportMatch = line.match(
        /import\s*\(\s*['"]([^'"]+)['"]/
      );
      if (dynamicImportMatch) {
        dependencies.push({
          source: sourcePath,
          target: dynamicImportMatch[1],
          type: "dynamic-import",
        });
      }
    }

    /* ── symbols ── */

    if (
      !line.includes("function") &&
      !line.includes("class") &&
      !line.includes("interface") &&
      !line.includes("type ") &&
      !line.includes("enum ") &&
      !line.includes("=>") &&
      !line.includes("const ") &&
      !line.includes("let ") &&
      !line.includes("var ")
    ) continue;

    const syms = extractJsTsSymbols(line, sourcePath, lineNum, col);
    for (const s of syms) symbols.push(s);
  }

  return { symbols, dependencies };
}

function extractImportNames(line: string): string[] | undefined {
  const names: string[] = [];
  const braceMatch = line.match(/\{\s*([^}]+)\s*}\s+from/);
  if (braceMatch) {
    for (const part of braceMatch[1].split(",")) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) names.push(name);
    }
  }
  const defaultMatch = line.match(/^import\s+(\w+)\s+from/);
  if (defaultMatch) names.push(defaultMatch[1]);
  return names.length > 0 ? names : undefined;
}

function extractJsTsSymbols(
  line: string,
  sourcePath: string,
  lineNum: number,
  col: number
): IndexSymbol[] {
  const result: IndexSymbol[] = [];
  let m: RegExpExecArray | null;

  if (/^export\s+default\s+(async\s+)?function\b/.test(line)) {
    m = /^export\s+default\s+(?:async\s+)?function\s*(\w+)?/.exec(line);
    const name = m && m[1] ? m[1] : "default";
    result.push({ name, kind: "function", file: sourcePath, line: lineNum, column: col, visibility: "default" });
  } else if (/^export\s+default\s+class\s+/.test(line)) {
    m = /^export\s+default\s+class\s+(\w+)/.exec(line);
    if (m) result.push({ name: m[1], kind: "class", file: sourcePath, line: lineNum, column: col, visibility: "default" });
  } else if (/^export\s+(?:async\s+)?(?:function|class|interface|type|enum|const|let|var|abstract\s+class)\s+/.test(line)) {
    m = /^export\s+(?:(?:async\s+)?function|class|interface|type|enum|const|let|var|abstract\s+class)\s+(\w+)/.exec(line);
    if (m) {
      const kind = detectExportKind(line);
      result.push({ name: m[1], kind, file: sourcePath, line: lineNum, column: col, visibility: "exported" });
    }
  } else if (/^(?:async\s+)?function\s+\w+/.test(line)) {
    m = /^(?:async\s+)?function\s+(\w+)/.exec(line);
    if (m) result.push({ name: m[1], kind: "function", file: sourcePath, line: lineNum, column: col, visibility: "public" });
  } else if (/^class\s+\w+/.test(line)) {
    m = /^class\s+(\w+)/.exec(line);
    if (m) result.push({ name: m[1], kind: "class", file: sourcePath, line: lineNum, column: col, visibility: "public" });
  } else if (/^(?:export\s+)?interface\s+\w+/.test(line)) {
    m = /^(?:export\s+)?interface\s+(\w+)/.exec(line);
    if (m) result.push({ name: m[1], kind: "interface", file: sourcePath, line: lineNum, column: col, visibility: line.startsWith("export") ? "exported" : "public" });
  } else if (/^(?:export\s+)?type\s+\w+/.test(line)) {
    m = /^(?:export\s+)?type\s+(\w+)/.exec(line);
    if (m) result.push({ name: m[1], kind: "type", file: sourcePath, line: lineNum, column: col, visibility: line.startsWith("export") ? "exported" : "public" });
  } else if (/^(?:export\s+)?enum\s+\w+/.test(line)) {
    m = /^(?:export\s+)?enum\s+(\w+)/.exec(line);
    if (m) result.push({ name: m[1], kind: "enum", file: sourcePath, line: lineNum, column: col, visibility: line.startsWith("export") ? "exported" : "public" });
  } else if ((/^(?:export\s+)?(?:const|let|var)\s+/.test(line) && !line.includes("require"))) {
    m = /^(?:export\s+)?(?:const|let|var)\s+(\w+)/.exec(line);
    if (m) {
      const isExported = line.startsWith("export");
      const kind: "constant" | "variable" = line.includes("const ") ? "constant" : "variable";
      result.push({ name: m[1], kind, file: sourcePath, line: lineNum, column: col, visibility: isExported ? "exported" : "public" });
    }
  }

  return result;
}

function detectExportKind(line: string): IndexSymbol["kind"] {
  if (/function\b/.test(line)) return "function";
  if (/class\b/.test(line)) return "class";
  if (/interface\b/.test(line)) return "interface";
  if (/type\b/.test(line)) return "type";
  if (/enum\b/.test(line)) return "enum";
  if (/const\b/.test(line)) return "constant";
  return "variable";
}

/* ─── Python ────────────────────────────────────────────────── */

function parsePython(
  content: string,
  filePath: string
): ParseResult {
  const symbols: IndexSymbol[] = [];
  const dependencies: FileDependency[] = [];
  const sourcePath = normalizePath(filePath);
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;
    const col = rawLine.search(/\S/) + 1 || 1;

    if (!trimmed || trimmed.startsWith("#")) continue;

    const line = trimmed.replace(/#.*$/, "").trim();
    if (!line) continue;

    /* ── dependencies ── */

    const fromImport = line.match(/^from\s+(\S+)\s+import\s+(.+)/);
    if (fromImport) {
      const target = fromImport[1];
      const syms: string[] = [];
      for (const part of fromImport[2].split(",")) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name && !name.startsWith("(")) syms.push(name);
      }
      dependencies.push({
        source: sourcePath,
        target,
        type: "import",
        symbols: syms.length > 0 ? syms : undefined,
      });
    }

    const importMatch = line.match(/^import\s+(\S+)/);
    if (importMatch && !fromImport) {
      const target = importMatch[1];
      dependencies.push({
        source: sourcePath,
        target,
        type: "import",
        symbols: [target.split(".").pop()!],
      });
    }

    /* ── symbols ── */

    const defMatch = line.match(/^(?:async\s+)?def\s+(\w+)/);
    if (defMatch) {
      symbols.push({
        name: defMatch[1],
        kind: "function",
        file: sourcePath,
        line: lineNum,
        column: col,
        visibility: defMatch[1].startsWith("_") ? "private" : "public",
      });
    }

    const classMatch = line.match(/^class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: "class",
        file: sourcePath,
        line: lineNum,
        column: col,
        visibility: classMatch[1].startsWith("_") ? "private" : "public",
      });
    }

    const assignMatch = line.match(/^(\w+)\s*=\s*(?:['"([]|\d+)/);
    if (assignMatch && !line.startsWith("self.") && !line.startsWith("cls.")) {
      const name = assignMatch[1];
      if (name === name.toUpperCase() && name.length > 1) {
        symbols.push({
          name,
          kind: "constant",
          file: sourcePath,
          line: lineNum,
          column: col,
          visibility: name.startsWith("_") ? "private" : "public",
        });
      }
    }
  }

  return { symbols, dependencies };
}

/* ─── Go ─────────────────────────────────────────────────────── */

function parseGo(
  content: string,
  filePath: string
): ParseResult {
  const symbols: IndexSymbol[] = [];
  const dependencies: FileDependency[] = [];
  const sourcePath = normalizePath(filePath);
  const lines = content.split("\n");

  let inImportBlock = false;
  let importBlockDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    const lineNum = i + 1;
    const col = rawLine.search(/\S/) + 1 || 1;

    if (!trimmed) continue;

    const line = trimmed.replace(/\/\/.*$/, "").trim();
    if (!line) continue;

    /* ── import handling ── */

    if (line.startsWith("import (")) {
      inImportBlock = true;
      importBlockDepth = 1;
      if (line.length > 8) {
        const rest = line.slice(8).trim();
        const innerMatch = rest.match(/^"([^"]+)"\s*\)/);
        if (innerMatch) {
          dependencies.push({
            source: sourcePath,
            target: innerMatch[1],
            type: "import",
          });
          inImportBlock = false;
          importBlockDepth = 0;
        }
        const innerOpenMatch = rest.match(/^"([^"]+)"/);
        if (innerOpenMatch) {
          dependencies.push({
            source: sourcePath,
            target: innerOpenMatch[1],
            type: "import",
          });
        }
      }
      continue;
    }

    if (inImportBlock) {
      if (line.includes("(")) importBlockDepth++;
      if (line.includes(")")) importBlockDepth--;
      if (importBlockDepth <= 0) {
        inImportBlock = false;
        importBlockDepth = 0;
        continue;
      }
      const importStr = line.match(/^"([^"]+)"/);
      if (importStr) {
        dependencies.push({
          source: sourcePath,
          target: importStr[1],
          type: "import",
        });
      }
      continue;
    }

    const singleImport = line.match(/^import\s+"([^"]+)"/);
    if (singleImport) {
      dependencies.push({
        source: sourcePath,
        target: singleImport[1],
        type: "import",
      });
      continue;
    }

    /* ── skip non-declaration lines ── */
    if (
      !line.startsWith("func ") &&
      !line.startsWith("type ") &&
      !line.startsWith("const ") &&
      !line.startsWith("var ")
    ) continue;

    /* ── symbols ── */

    const funcMatch = line.match(/^func\s+(?:\([^)]*\)\s+)?(\w+)/);
    if (funcMatch) {
      const name = funcMatch[1];
      const kind: IndexSymbol["kind"] = name[0] === name[0].toUpperCase() ? "function" : "function";
      symbols.push({
        name,
        kind,
        file: sourcePath,
        line: lineNum,
        column: col,
        visibility: name[0] === name[0].toUpperCase() ? "exported" : "public",
      });
    }

    const typeMatch = line.match(/^type\s+(\w+)\s+(struct|interface)\b/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        kind: typeMatch[2] === "struct" ? "class" : "interface",
        file: sourcePath,
        line: lineNum,
        column: col,
        visibility: typeMatch[1][0] === typeMatch[1][0].toUpperCase() ? "exported" : "public",
      });
    }

    const typeAlias = line.match(/^type\s+(\w+)\s+/);
    if (typeAlias && !typeMatch) {
      symbols.push({
        name: typeAlias[1],
        kind: "type",
        file: sourcePath,
        line: lineNum,
        column: col,
        visibility: typeAlias[1][0] === typeAlias[1][0].toUpperCase() ? "exported" : "public",
      });
    }
  }

  return { symbols, dependencies };
}

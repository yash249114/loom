import { describe, it, expect } from "vitest";
import { detectLanguage, getScanPatterns, isSupported } from "../../../src/indexer/language.js";
import { parseFile } from "../../../src/indexer/parse.js";
import type { IndexSymbol, FileDependency, ParseResult } from "../../../src/indexer/types.js";

describe("detectLanguage", () => {
  it("detects typescript from .ts", () => {
    expect(detectLanguage("src/index.ts")).toBe("typescript");
  });

  it("detects typescript from .tsx", () => {
    expect(detectLanguage("component.tsx")).toBe("typescript");
  });

  it("detects typescript from .mts", () => {
    expect(detectLanguage("module.mts")).toBe("typescript");
  });

  it("detects typescript from .cts", () => {
    expect(detectLanguage("module.cts")).toBe("typescript");
  });

  it("detects javascript from .js", () => {
    expect(detectLanguage("file.js")).toBe("javascript");
  });

  it("detects javascript from .jsx", () => {
    expect(detectLanguage("file.jsx")).toBe("javascript");
  });

  it("detects javascript from .mjs", () => {
    expect(detectLanguage("file.mjs")).toBe("javascript");
  });

  it("detects javascript from .cjs", () => {
    expect(detectLanguage("file.cjs")).toBe("javascript");
  });

  it("detects python from .py", () => {
    expect(detectLanguage("script.py")).toBe("python");
  });

  it("detects go from .go", () => {
    expect(detectLanguage("main.go")).toBe("go");
  });

  it("returns unknown for unsupported extensions", () => {
    expect(detectLanguage("readme.md")).toBe("unknown");
    expect(detectLanguage("style.css")).toBe("unknown");
    expect(detectLanguage("Dockerfile")).toBe("unknown");
  });
});

describe("getScanPatterns", () => {
  it("returns patterns for all supported extensions", () => {
    const patterns = getScanPatterns();
    expect(patterns).toContain("**/*.ts");
    expect(patterns).toContain("**/*.tsx");
    expect(patterns).toContain("**/*.js");
    expect(patterns).toContain("**/*.py");
    expect(patterns).toContain("**/*.go");
  });
});

describe("isSupported", () => {
  it("returns true for typescript", () => {
    expect(isSupported("typescript")).toBe(true);
  });

  it("returns false for unknown", () => {
    expect(isSupported("unknown")).toBe(false);
  });
});

describe("parseFile - TypeScript", () => {
  it("extracts exported function", () => {
    const code = `export function foo(): void { return; }`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("foo");
    expect(result.symbols[0].kind).toBe("function");
    expect(result.symbols[0].visibility).toBe("exported");
  });

  it("extracts exported class", () => {
    const code = `export class MyClass { }`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("MyClass");
    expect(result.symbols[0].kind).toBe("class");
    expect(result.symbols[0].visibility).toBe("exported");
  });

  it("extracts exported interface", () => {
    const code = `export interface Config { name: string; }`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Config");
    expect(result.symbols[0].kind).toBe("interface");
  });

  it("extracts exported type alias", () => {
    const code = `export type Result<T> = T | null;`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Result");
    expect(result.symbols[0].kind).toBe("type");
  });

  it("extracts exported const", () => {
    const code = `export const VERSION = "1.0";`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("VERSION");
    expect(result.symbols[0].kind).toBe("constant");
  });

  it("extracts default export function", () => {
    const code = `export default function handler() { }`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("handler");
    expect(result.symbols[0].visibility).toBe("default");
  });

  it("extracts unnamed default export", () => {
    const code = `export default function() { return 42; }`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("default");
  });

  it("extracts non-exported function", () => {
    const code = `function helper() { }`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("helper");
    expect(result.symbols[0].visibility).toBe("public");
  });

  it("extracts non-exported class", () => {
    const code = `class Internal { }`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Internal");
  });

  it("extracts enum", () => {
    const code = `export enum Color { Red, Green, Blue }`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Color");
    expect(result.symbols[0].kind).toBe("enum");
  });

  it("extracts import dependencies", () => {
    const code = `import { foo } from "./utils";\nimport bar from "lodash";`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.dependencies).toHaveLength(2);
    expect(result.dependencies[0].target).toBe("./utils");
    expect(result.dependencies[0].type).toBe("import");
    expect(result.dependencies[1].target).toBe("lodash");
  });

  it("extracts type imports", () => {
    const code = `import type { Config } from "./types";`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].type).toBe("type-import");
  });

  it("extracts re-exports from ... from", () => {
    const code = `export { handler } from "./routes";`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].target).toBe("./routes");
  });

  it("extracts require dependencies", () => {
    const code = `const fs = require("node:fs");`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].type).toBe("require");
    expect(result.dependencies[0].target).toBe("node:fs");
  });

  it("extracts dynamic imports", () => {
    const code = `const mod = await import("./lazy");`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].type).toBe("dynamic-import");
    expect(result.dependencies[0].target).toBe("./lazy");
  });

  it("captures imported symbol names from braces", () => {
    const code = `import { readFile, writeFile } from "fs";`;
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.dependencies[0].symbols).toContain("readFile");
    expect(result.dependencies[0].symbols).toContain("writeFile");
  });

  it("extracts multiple symbols from one file", () => {
    const code = [
      "export function add(a: number, b: number): number { return a + b; }",
      "export function subtract(a: number, b: number): number { return a - b; }",
    ].join("\n");
    const result = parseFile(code, "math.ts", "typescript");
    expect(result.symbols).toHaveLength(2);
    expect(result.symbols.map((s) => s.name)).toEqual(["add", "subtract"]);
  });

  it("handles empty file", () => {
    const result = parseFile("", "empty.ts", "typescript");
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });

  it("ignores comment lines", () => {
    const code = [
      "// import { x } from 'foo'",
      "// export function bar() {}",
      "const a = 1;",
    ].join("\n");
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.dependencies).toHaveLength(0);
  });
});

describe("parseFile - JavaScript", () => {
  it("parses JS like TS", () => {
    const code = `export function sum(a, b) { return a + b; }`;
    const result = parseFile(code, "file.js", "javascript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("sum");
  });
});

describe("parseFile - Python", () => {
  it("extracts function def", () => {
    const code = "def hello(name):\n    print(f'Hello {name}')";
    const result = parseFile(code, "hello.py", "python");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("hello");
    expect(result.symbols[0].kind).toBe("function");
  });

  it("extracts async function", () => {
    const code = "async def fetch(url):\n    return await get(url)";
    const result = parseFile(code, "fetch.py", "python");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("fetch");
  });

  it("extracts class and its constructor", () => {
    const code = "class User:\n    def __init__(self, name):\n        self.name = name";
    const result = parseFile(code, "models.py", "python");
    const classSyms = result.symbols.filter((s) => s.kind === "class");
    expect(classSyms).toHaveLength(1);
    expect(classSyms[0].name).toBe("User");
    expect(result.symbols.find((s) => s.kind === "function")?.name).toBe("__init__");
  });

  it("marks private symbols starting with _", () => {
    const code = "def _helper():\n    pass";
    const result = parseFile(code, "test.py", "python");
    expect(result.symbols[0].visibility).toBe("private");
  });

  it("extracts import from ... import", () => {
    const code = "from os.path import join, exists";
    const result = parseFile(code, "test.py", "python");
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].target).toBe("os.path");
    expect(result.dependencies[0].symbols).toContain("join");
    expect(result.dependencies[0].symbols).toContain("exists");
  });

  it("extracts simple import", () => {
    const code = "import sys";
    const result = parseFile(code, "test.py", "python");
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].target).toBe("sys");
  });

  it("handles import with alias", () => {
    const code = "import numpy as np";
    const result = parseFile(code, "test.py", "python");
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].target).toBe("numpy");
  });

  it("extracts constants (UPPER_CASE)", () => {
    const code = "MAX_SIZE = 1024\nMIN_SIZE = 64";
    const result = parseFile(code, "config.py", "python");
    const constants = result.symbols.filter((s) => s.kind === "constant");
    expect(constants).toHaveLength(2);
    expect(constants[0].name).toBe("MAX_SIZE");
    expect(constants[1].name).toBe("MIN_SIZE");
  });

  it("ignores comment lines", () => {
    const code = [
      "# from foo import bar",
      "# def helper(): pass",
      "x = 1",
    ].join("\n");
    const result = parseFile(code, "test.py", "python");
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });
});

describe("parseFile - Go", () => {
  it("extracts exported function", () => {
    const code = "func Hello() string {\n    return \"hello\"\n}";
    const result = parseFile(code, "main.go", "go");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Hello");
    expect(result.symbols[0].visibility).toBe("exported");
  });

  it("extracts unexported function", () => {
    const code = "func helper() {}";
    const result = parseFile(code, "main.go", "go");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("helper");
    expect(result.symbols[0].visibility).toBe("public");
  });

  it("extracts method", () => {
    const code = "func (u *User) GetName() string { return u.name }";
    const result = parseFile(code, "main.go", "go");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("GetName");
  });

  it("extracts struct", () => {
    const code = "type User struct {\n    Name string\n}";
    const result = parseFile(code, "main.go", "go");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("User");
    expect(result.symbols[0].kind).toBe("class");
  });

  it("extracts interface", () => {
    const code = "type Reader interface {\n    Read(p []byte) (n int, err error)\n}";
    const result = parseFile(code, "main.go", "go");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Reader");
    expect(result.symbols[0].kind).toBe("interface");
  });

  it("extracts type alias", () => {
    const code = "type HandlerFunc func(ResponseWriter, *Request)";
    const result = parseFile(code, "main.go", "go");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("HandlerFunc");
    expect(result.symbols[0].kind).toBe("type");
  });

  it("extracts single import", () => {
    const code = `import "fmt"`;
    const result = parseFile(code, "main.go", "go");
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].target).toBe("fmt");
  });

  it("extracts multi-line import block", () => {
    const code = [
      "import (",
      '    "fmt"',
      '    "strings"',
      '    "net/http"',
      ")",
    ].join("\n");
    const result = parseFile(code, "main.go", "go");
    expect(result.dependencies).toHaveLength(3);
    expect(result.dependencies[0].target).toBe("fmt");
    expect(result.dependencies[1].target).toBe("strings");
    expect(result.dependencies[2].target).toBe("net/http");
  });
});

describe("parseFile - edge cases", () => {
  it("handles mixed content: symbols + deps", () => {
    const code = [
      "import { useState } from 'react';",
      "import './styles.css';",
      "",
      "export function Counter() {",
      "  const [count, setCount] = useState(0);",
      "  return count;",
      "}",
    ].join("\n");
    const result = parseFile(code, "counter.tsx", "typescript");
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Counter");
    expect(result.dependencies.length).toBeGreaterThanOrEqual(2);
  });

  it("handles unknown language gracefully", () => {
    const result = parseFile("some content", "file.md", "unknown");
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });

  it("handles file with only comments", () => {
    const code = "// this is a comment\n// another one";
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);
  });

  it("handles file with only imports", () => {
    const code = 'import { a } from "./a";\nimport { b } from "./b";';
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(2);
  });

  it("preserves correct line numbers", () => {
    const code = [
      "// header",
      "",
      "export function foo() {}",
    ].join("\n");
    const result = parseFile(code, "test.ts", "typescript");
    expect(result.symbols[0].line).toBe(3);
  });
});

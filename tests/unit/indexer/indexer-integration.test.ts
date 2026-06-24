import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Indexer } from "../../../src/indexer/indexer.js";

describe("Indexer integration", () => {
  let tmpDir: string;
  let outputDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "loom-indexer-test-"));
    outputDir = path.join(tmpDir, ".loom");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("indexes a simple TypeScript file", async () => {
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "index.ts"),
      `import { helper } from "./helper.js";\nexport function main(): void { helper(); }\n`
    );
    fs.writeFileSync(
      path.join(srcDir, "helper.ts"),
      `export function helper(): void { console.log("ok"); }\n`
    );

    const indexer = new Indexer({ rootDir: tmpDir, verbose: false });
    const result = await indexer.run();

    expect(result.files).toHaveLength(2);
    expect(result.symbols).toHaveLength(2); // main + helper
    expect(result.dependencies).toHaveLength(1); // only the import

    // Check graph.json was written
    const graphPath = path.join(outputDir, "graph.json");
    expect(fs.existsSync(graphPath)).toBe(true);
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf-8"));
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);

    // Check symbols.json was written
    const symbolsPath = path.join(outputDir, "symbols.json");
    expect(fs.existsSync(symbolsPath)).toBe(true);
    const symbols = JSON.parse(fs.readFileSync(symbolsPath, "utf-8"));
    expect(symbols).toHaveLength(2);
  });

  it("indexes Python files", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "main.py"),
      "from utils import greet\n\ndef start():\n    greet()\n"
    );
    const utilsDir = path.join(tmpDir, "utils");
    fs.mkdirSync(utilsDir, { recursive: true });
    fs.writeFileSync(
      path.join(utilsDir, "__init__.py"),
      "def greet(name):\n    print(f'Hello {name}')\n"
    );
    fs.writeFileSync(
      path.join(utilsDir, "helpers.py"),
      "MAX_RETRIES = 3\nclass Helper:\n    pass\n"
    );

    const indexer = new Indexer({ rootDir: tmpDir, verbose: false });
    const result = await indexer.run();

    expect(result.files).toHaveLength(3);
    expect(result.symbols.some((s) => s.name === "start")).toBe(true);
    expect(result.symbols.some((s) => s.name === "greet")).toBe(true);
    expect(result.symbols.some((s) => s.name === "MAX_RETRIES")).toBe(true);
    expect(result.symbols.some((s) => s.name === "Helper")).toBe(true);
  });

  it("indexes Go files", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "main.go"),
      'package main\nimport "fmt"\nfunc Hello() string { return "hello" }\n'
    );

    const indexer = new Indexer({ rootDir: tmpDir, verbose: false });
    const result = await indexer.run();

    expect(result.files).toHaveLength(1);
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("Hello");
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0].target).toBe("fmt");
  });

  it("handles incremental indexing — unchanged files are cached", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "file.ts"),
      `export const x = 1;\n`
    );

    const indexer1 = new Indexer({ rootDir: tmpDir, verbose: false });
    const result1 = await indexer1.run();
    expect(result1.files).toHaveLength(1);

    // Run again without changes
    const indexer2 = new Indexer({ rootDir: tmpDir, verbose: false });
    const result2 = await indexer2.run();
    expect(result2.files).toHaveLength(1);
    expect(result2.symbols).toHaveLength(1);
    expect(result2.symbols[0].name).toBe("x");
  });

  it("handles incremental indexing — changed file is re-parsed", async () => {
    const filePath = path.join(tmpDir, "file.ts");
    fs.writeFileSync(filePath, `export const x = 1;\n`);

    const indexer1 = new Indexer({ rootDir: tmpDir, verbose: false });
    await indexer1.run();

    // Wait a tick for mtime to differ
    await new Promise((r) => setTimeout(r, 100));

    // Modify the file
    fs.writeFileSync(filePath, `export const y = 2;\n`);

    const indexer2 = new Indexer({ rootDir: tmpDir, verbose: false });
    const result = await indexer2.run();
    expect(result.symbols).toHaveLength(1);
    expect(result.symbols[0].name).toBe("y"); // should have picked up new symbol
  });

  it("handles deleted files", async () => {
    fs.writeFileSync(path.join(tmpDir, "a.ts"), `export const a = 1;\n`);
    fs.writeFileSync(path.join(tmpDir, "b.ts"), `export const b = 2;\n`);

    const indexer1 = new Indexer({ rootDir: tmpDir, verbose: false });
    await indexer1.run();

    // Delete one file
    fs.unlinkSync(path.join(tmpDir, "a.ts"));

    const indexer2 = new Indexer({ rootDir: tmpDir, verbose: false });
    const result = await indexer2.run();
    expect(result.files).toHaveLength(1);
    expect(result.symbols[0].name).toBe("b");
  });

  it("skips node_modules and .git directories", async () => {
    const nmDir = path.join(tmpDir, "node_modules", "some-pkg");
    fs.mkdirSync(nmDir, { recursive: true });
    fs.writeFileSync(path.join(nmDir, "index.ts"), `export const x = 1;\n`);

    const gitDir = path.join(tmpDir, ".git", "objects");
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, "file.ts"), `export const y = 2;\n`);

    // Also put a real file
    fs.writeFileSync(path.join(tmpDir, "real.ts"), `export const z = 3;\n`);

    const indexer = new Indexer({ rootDir: tmpDir, verbose: false });
    const result = await indexer.run();
    expect(result.files).toHaveLength(1);
    expect(result.symbols[0].name).toBe("z");
  });

  it("force reindex ignores cache", async () => {
    fs.writeFileSync(path.join(tmpDir, "file.ts"), `export const x = 1;\n`);

    const indexer1 = new Indexer({ rootDir: tmpDir, verbose: false });
    await indexer1.run();

    const indexer2 = new Indexer({ rootDir: tmpDir, force: true, verbose: false });
    const result = await indexer2.run(true);
    expect(result.files).toHaveLength(1);
    expect(result.symbols[0].name).toBe("x");
  });

  it("outputs correct structure for graph.json", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "entry.ts"),
      `import { util } from "./util.js";\nexport function entry() { util(); }\n`
    );
    fs.writeFileSync(
      path.join(tmpDir, "util.ts"),
      `export function util() {}\n`
    );

    const indexer = new Indexer({ rootDir: tmpDir, verbose: false });
    await indexer.run();

    const graphPath = path.join(outputDir, "graph.json");
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf-8"));
    expect(graph).toHaveProperty("version");
    expect(graph).toHaveProperty("generatedAt");
    expect(graph).toHaveProperty("nodes");
    expect(graph).toHaveProperty("edges");
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0].source).toContain("entry.ts");
    expect(graph.edges[0].target).toContain("util.ts");
  });

  it("handles empty project", async () => {
    const indexer = new Indexer({ rootDir: tmpDir, verbose: false });
    const result = await indexer.run();
    expect(result.files).toHaveLength(0);
    expect(result.symbols).toHaveLength(0);
    expect(result.dependencies).toHaveLength(0);

    // Output files should still be created (empty)
    expect(fs.existsSync(path.join(outputDir, "graph.json"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "symbols.json"))).toBe(true);
  });

  it("handles unsupported file types gracefully", async () => {
    fs.writeFileSync(path.join(tmpDir, "readme.md"), "# Hello\n");
    fs.writeFileSync(path.join(tmpDir, "style.css"), "body { color: red; }\n");
    fs.writeFileSync(path.join(tmpDir, "app.ts"), `export const app = "ok";\n`);

    const indexer = new Indexer({ rootDir: tmpDir, verbose: false });
    const result = await indexer.run();
    expect(result.files).toHaveLength(1); // only .ts file
    expect(result.symbols).toHaveLength(1);
  });

  it("preserves .loom directory creation", async () => {
    const indexer = new Indexer({ rootDir: tmpDir, verbose: false });
    await indexer.run();
    expect(fs.existsSync(outputDir)).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "index-cache.json"))).toBe(true);
  });
});

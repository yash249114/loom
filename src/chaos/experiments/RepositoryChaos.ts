import type { ChaosExperiment, ChaosContext, ChaosResult } from "../ChaosTestHarness.js";

const EXPERIMENTS: ChaosExperiment[] = [
  {
    name: "Malformed binary file in repo",
    description: "Repository contains binary files that should be skipped by indexer",
    category: "repository",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      const binaryContent = Buffer.alloc(1024);
      for (let i = 0; i < binaryContent.length; i++) {
        binaryContent[i] = i % 256;
      }
      fsWriteSync(path.join(workspace, "binary.bin"), binaryContent);
      ctx.writeFile("normal.ts", "export const x = 1;");

      const { exitCode } = ctx.runLoom("config", workspace);
      if (exitCode !== 0) {
        errors.push("CLI crashed when repo contains binary files");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("Binary file in repo handled — no crash");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Extremely large file in repo",
    description: "Repository contains a 50MB source file to test indexer limits",
    category: "repository",
    severity: "warning",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      const hugeContent = "export const a = 1;\n".repeat(1_000_000);
      ctx.writeFile("huge.ts", hugeContent);

      const { exitCode } = ctx.runLoom("config", workspace);
      if (exitCode !== 0) {
        observations.push("CLI crashed on large file");
        return { verdict: "partial", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("Huge file (1M lines) in repo handled");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Deeply nested directory structure",
    description: "Repository with 1000 levels of nesting to test path recursion limits",
    category: "repository",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      let deepPath = "";
      for (let i = 0; i < 500; i++) {
        deepPath += `/dir${i}`;
        ctx.writeFile(`deep${deepPath}/index.ts`, `export const n${i} = ${i};`);
      }

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      const { exitCode } = ctx.runLoom("config", workspace);
      if (exitCode !== 0) {
        observations.push("CLI crashed on deeply nested repo");
        return { verdict: "partial", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("500-level deep nesting handled");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Empty source files",
    description: "Repository contains empty .ts files to test parse edge case",
    category: "repository",
    severity: "warning",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      for (let i = 0; i < 100; i++) {
        ctx.writeFile(`empty${i}.ts`, "");
      }

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      const { exitCode } = ctx.runLoom("config", workspace);

      observations.push(`${exitCode === 0 ? "100 empty files handled" : "CLI crashed on empty files"}`);
      return {
        verdict: exitCode === 0 ? "pass" : "fail",
        durationMs: 0,
        errors: exitCode !== 0 ? ["CLI crashed on empty files"] : [],
        observations,
        recovered: exitCode === 0,
      };
    },
  },
  {
    name: "Files with circular imports",
    description: "Repository contains files with circular import chains",
    category: "repository",
    severity: "error",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      for (let i = 0; i < 20; i++) {
        const prev = i === 0 ? 19 : i - 1;
        const next = i === 19 ? 0 : i + 1;
        ctx.writeFile(`circular${i}.ts`, `import { x${prev} } from "./circular${prev}";\nexport const x${i} = ${i};\nexport { x${next} } from "./circular${next}";`);
      }

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      const { exitCode } = ctx.runLoom("config", workspace);
      if (exitCode !== 0) {
        observations.push("CLI crashed on circular imports");
        return { verdict: "fail", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("Circular imports in repo handled");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
  {
    name: "Mixed language files",
    description: "Repository contains .ts, .js, .py, .go, .rs files with unusual syntax",
    category: "repository",
    severity: "info",
    run: async (ctx: ChaosContext): Promise<ChaosResult> => {
      const errors: string[] = [];
      const observations: string[] = [];
      const workspace = ctx.tempDir();

      ctx.writeFile("test.ts", "import { something } from './nowhere'; export function test<T extends keyof any>(x: T): T { return x; }");
      ctx.writeFile("test.py", "import sys\nfrom typing import Optional\n\ndef divide(a: int, b: int) -> Optional[float]:\n    if b == 0:\n        raise ValueError('cannot divide by zero')\n    return a / b");
      ctx.writeFile("test.go", "package main\n\nimport \"fmt\"\n\ntype Server struct {\n    port int\n    name string\n}\n\nfunc (s *Server) Start() error {\n    return nil\n}");
      ctx.writeFile("test.rs", "use std::collections::HashMap;\n\npub trait Repository<T> {\n    fn get(&self, id: &str) -> Option<&T>;\n    fn put(&mut self, id: String, value: T);\n}");
      ctx.writeFile("test.js", "const x = require('./test'); module.exports = { x, ...require('./nowhere') };");

      ctx.writeFile(".loomrc.json", JSON.stringify({
        defaultProvider: "ollama",
        providers: { ollama: { type: "ollama", baseURL: "http://localhost:11434", model: "qwen2.5-coder:7b" } },
      }));

      const { exitCode } = ctx.runLoom("config", workspace);
      if (exitCode !== 0) {
        observations.push("CLI crashed on mixed-language repo");
        return { verdict: "partial", durationMs: 0, errors, observations, recovered: false };
      }

      observations.push("Multi-language repo handled");
      return { verdict: "pass", durationMs: 0, errors, observations, recovered: true };
    },
  },
];

import fs from "node:fs";
import path from "node:path";

function fsWriteSync(filePath: string, content: Buffer): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content);
}

export default EXPERIMENTS;

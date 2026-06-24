import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { generateRepo } from "../fixtures/large-repo-generator.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import { buildDefaultRegistry } from "../../src/tools/index.js";
import { loadConfig } from "../../src/config/loader.js";
import { readWorkspaceContext, workspaceLayout } from "../../src/workspace/workspace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

interface PerfResult {
  test: string;
  fileCount: number;
  durationMs: number;
  memoryMb: number;
  resultSize: number;
  passed: boolean;
}

describe("Large Repo Performance", () => {
  let tmpDir: string;
  const results: PerfResult[] = [];
  const config = loadConfig(PROJECT_ROOT).config;
  let registry: ToolRegistry;

  beforeAll(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "loom-perf-"));
    registry = buildDefaultRegistry(config);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const testScales = [100, 500, 1000];

  for (const scale of testScales) {
    describe(`${scale} files`, () => {
      let repo: Awaited<ReturnType<typeof generateRepo>>;

      beforeAll(async () => {
        repo = await generateRepo(path.join(tmpDir, `repo-${scale}`), scale, 3);
      }, 30000);

      afterAll(async () => {
        if (repo) await repo.cleanup();
      });

      it(`listdir non-recursive with ${scale} files`, async () => {
        const start = performance.now();
        const memBefore = process.memoryUsage().heapUsed;
        const tool = registry.get("listdir")!;
        const ctx = {
          workspaceRoot: repo.root,
          cwd: repo.root,
          log: () => {},
          confirm: async () => true,
        };
        const parsed = tool.parameters.parse({ path: ".", recursive: false });
        const result = await tool.handler(parsed, ctx);
        const duration = performance.now() - start;
        const memAfter = process.memoryUsage().heapUsed;
        results.push({
          test: "listdir",
          fileCount: scale,
          durationMs: Math.round(duration),
          memoryMb: Math.round((memAfter - memBefore) / 1024 / 1024),
          resultSize: result.length,
          passed: result.length > 0,
        });
        expect(result.length).toBeGreaterThan(0);
      });

      it(`listdir recursive with ${scale} files`, async () => {
        const start = performance.now();
        const memBefore = process.memoryUsage().heapUsed;
        const tool = registry.get("listdir")!;
        const ctx = {
          workspaceRoot: repo.root,
          cwd: repo.root,
          log: () => {},
          confirm: async () => true,
        };
        const parsed = tool.parameters.parse({ path: ".", recursive: true, maxEntries: 2000 });
        const result = await tool.handler(parsed, ctx);
        const duration = performance.now() - start;
        const memAfter = process.memoryUsage().heapUsed;
        results.push({
          test: "listdir-recursive",
          fileCount: scale,
          durationMs: Math.round(duration),
          memoryMb: Math.round((memAfter - memBefore) / 1024 / 1024),
          resultSize: result.length,
          passed: result.length > 0,
        });
        expect(result.length).toBeGreaterThan(0);
      });

      it(`searchfiles with ${scale} files`, async () => {
        const start = performance.now();
        const memBefore = process.memoryUsage().heapUsed;
        const tool = registry.get("searchfiles")!;
        const ctx = {
          workspaceRoot: repo.root,
          cwd: repo.root,
          log: () => {},
          confirm: async () => true,
        };
        const parsed = tool.parameters.parse({ pattern: "**/*.ts", maxResults: 50 });
        const result = await tool.handler(parsed, ctx);
        const duration = performance.now() - start;
        const memAfter = process.memoryUsage().heapUsed;
        results.push({
          test: "searchfiles-glob",
          fileCount: scale,
          durationMs: Math.round(duration),
          memoryMb: Math.round((memAfter - memBefore) / 1024 / 1024),
          resultSize: result.length,
          passed: result.length > 0,
        });
        expect(result.length).toBeGreaterThan(0);
      });

      it(`searchfiles with content grep on ${scale} files`, async () => {
        const start = performance.now();
        const memBefore = process.memoryUsage().heapUsed;
        const tool = registry.get("searchfiles")!;
        const ctx = {
          workspaceRoot: repo.root,
          cwd: repo.root,
          log: () => {},
          confirm: async () => true,
        };
        const parsed = tool.parameters.parse({
          pattern: "**/*.ts",
          contains: "function",
          maxResults: 20,
        });
        const result = await tool.handler(parsed, ctx);
        const duration = performance.now() - start;
        const memAfter = process.memoryUsage().heapUsed;
        results.push({
          test: "searchfiles-grep",
          fileCount: scale,
          durationMs: Math.round(duration),
          memoryMb: Math.round((memAfter - memBefore) / 1024 / 1024),
          resultSize: result.length,
          passed: result.length > 0,
        });
        expect(result.length).toBeGreaterThan(0);
      });

      it(`readfile on ${scale}th file`, async () => {
        const start = performance.now();
        const memBefore = process.memoryUsage().heapUsed;
        const tool = registry.get("readfile")!;
        const ctx = {
          workspaceRoot: repo.root,
          cwd: repo.root,
          log: () => {},
          confirm: async () => true,
        };
        const files = fs.readdirSync(repo.root);
        const target = files.find((f) => f.endsWith(".ts")) || files[0];
        const parsed = tool.parameters.parse({ path: target });
        const result = await tool.handler(parsed, ctx);
        const duration = performance.now() - start;
        const memAfter = process.memoryUsage().heapUsed;
        results.push({
          test: "readfile",
          fileCount: scale,
          durationMs: Math.round(duration),
          memoryMb: Math.round((memAfter - memBefore) / 1024 / 1024),
          resultSize: result.length,
          passed: result.length > 0,
        });
        expect(result.length).toBeGreaterThan(0);
      });

      it(`workspace context generation with ${scale} files`, async () => {
        const start = performance.now();
        const memBefore = process.memoryUsage().heapUsed;
        const context = await readWorkspaceContext(repo.root);
        const duration = performance.now() - start;
        const memAfter = process.memoryUsage().heapUsed;
        results.push({
          test: "workspace-context",
          fileCount: scale,
          durationMs: Math.round(duration),
          memoryMb: Math.round((memAfter - memBefore) / 1024 / 1024),
          resultSize: context.length,
          passed: true,
        });
        expect(typeof context).toBe("string");
      });
    });
  }

  it("collect all perf results", () => {
    const reportPath = path.join(PROJECT_ROOT, "PERFORMANCE_RAW.json");
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n=== Performance Results (${results.length} data points) ===`);
    console.table(results.map((r) => ({
      test: r.test,
      files: r.fileCount,
      ms: r.durationMs,
      mem: `${r.memoryMb}MB`,
      size: `${(r.resultSize / 1024).toFixed(1)}KB`,
      pass: r.passed ? "✓" : "✗",
    })));
  });
});

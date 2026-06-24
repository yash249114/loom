import fs from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { detectLanguage, getScanPatterns, isSupported } from "./language.js";
import { parseFile } from "./parse.js";
import type {
  Language,
  IndexSymbol,
  FileDependency,
  IndexedFile,
  IndexOutput,
  IndexOptions,
} from "./types.js";

const INDEX_VERSION = "1.0";
const CACHE_FILE = "index-cache.json";
const GRAPH_FILE = "graph.json";
const SYMBOLS_FILE = "symbols.json";

interface CacheEntry {
  mtimeMs: number;
  size: number;
  language: Language;
  symbols: IndexSymbol[];
  dependencies: FileDependency[];
}

interface IndexCache {
  version: string;
  generatedAt: string;
  files: Record<string, CacheEntry>;
}

export class Indexer {
  private rootDir: string;
  private outputDir: string;
  private verbose: boolean;
  private fileMap: Map<string, IndexedFile> = new Map();
  private cache: IndexCache;

  constructor(opts: IndexOptions) {
    this.rootDir = path.resolve(opts.rootDir);
    this.outputDir = opts.outputDir ?? path.join(this.rootDir, ".loom");
    this.verbose = opts.verbose ?? false;
    this.cache = {
      version: INDEX_VERSION,
      generatedAt: new Date().toISOString(),
      files: {},
    };
  }

  /* ── public API ────────────────────────────────────────────── */

  async run(force = false): Promise<IndexOutput> {
    this.log("info", `Indexing ${this.rootDir} ...`);

    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    this.loadCache();

    if (force) {
      this.log("info", "Force mode: full reindex");
      this.cache.files = {};
    }

    const files = await this.scanFiles();
    this.log("info", `Found ${files.length} supported files`);

    const pending = this.filterChanged(files);
    this.log("info", `${pending.length} files to process (${files.length - pending.length} cached)`);

    /* restore unchanged files from cache into fileMap */
    const pendingRelPaths = new Set(pending.map((p) => p.relPath));
    for (const f of files) {
      if (!this.cache.files[f.relPath]) continue;
      const cached = this.cache.files[f.relPath];
      if (!pendingRelPaths.has(f.relPath)) {
        this.fileMap.set(f.relPath, {
          path: f.relPath,
          language: cached.language,
          size: cached.size,
          mtimeMs: cached.mtimeMs,
          symbols: cached.symbols,
          dependencies: cached.dependencies,
        });
      }
    }

    /* parse changed / new files */
    await this.processBatch(pending);

    /* remove deleted files */
    const deleted = this.findDeleted(files);
    for (const d of deleted) {
      this.fileMap.delete(d);
      delete this.cache.files[d];
    }
    if (deleted.length > 0) {
      this.log("info", `Removed ${deleted.length} deleted files`);
    }

    /* build output */
    const allFiles = Array.from(this.fileMap.values());
    const allSymbols = this.collectSymbols(allFiles);
    const result = this.buildOutput(allFiles, allSymbols);

    this.writeOutputs(result);
    this.saveCache();

    this.log("success", `Indexed ${result.files.length} files, ${result.symbols.length} symbols, ${result.dependencies.length} deps`);
    return result;
  }

  /* ── file scanning ─────────────────────────────────────────── */

  private async scanFiles(): Promise<{ relPath: string; fullPath: string; mtimeMs: number; size: number }[]> {
    const patterns = getScanPatterns();
    const entries = await fg(patterns, {
      cwd: this.rootDir,
      absolute: true,
      stats: true,
      ignore: ["**/node_modules/**", "**/.git/**", "**/dist/**", "**/.loom/**", "**/coverage/**", "**/vendor/**"],
    });

    return entries.map((e) => {
      const relPath = path.relative(this.rootDir, e.path).replace(/\\/g, "/");
      return {
        relPath,
        fullPath: e.path,
        mtimeMs: e.stats?.mtimeMs ?? 0,
        size: e.stats?.size ?? 0,
      };
    });
  }

  /* ── incremental: compare against cache ────────────────────── */

  private filterChanged(
    files: { relPath: string; mtimeMs: number; size: number }[]
  ): { relPath: string; fullPath: string; mtimeMs: number; size: number }[] {
    const result: { relPath: string; fullPath: string; mtimeMs: number; size: number }[] = [];
    for (const f of files) {
      const cached = this.cache.files[f.relPath];
      if (!cached || cached.mtimeMs !== f.mtimeMs || cached.size !== f.size) {
        result.push(f as any);
      }
    }
    return result;
  }

  private findDeleted(
    scanned: { relPath: string }[]
  ): string[] {
    const scannedSet = new Set(scanned.map((s) => s.relPath));
    const deleted: string[] = [];
    for (const cachedPath of Object.keys(this.cache.files)) {
      if (!scannedSet.has(cachedPath)) {
        deleted.push(cachedPath);
      }
    }
    return deleted;
  }

  /* ── parsing pipeline ──────────────────────────────────────── */

  private async processBatch(
    files: { relPath: string; fullPath: string; mtimeMs: number; size: number }[]
  ): Promise<void> {
    const batchSize = 50;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      await Promise.all(
        batch.map((f) => this.processFile(f.relPath, f.fullPath, f.mtimeMs, f.size))
      );
      if (this.verbose) {
        const done = Math.min(i + batchSize, files.length);
        this.log("debug", `  processed ${done}/${files.length} files`);
      }
    }
  }

  private async processFile(
    relPath: string,
    fullPath: string,
    mtimeMs: number,
    size: number
  ): Promise<void> {
    try {
      const lang = detectLanguage(relPath);
      if (!isSupported(lang)) return;

      const ext = path.extname(relPath).toLowerCase();
      if (/\.(png|jpe?g|gif|bmp|ico|webp|mp[34]|wav|ogg|flac|wasm|exe|dll|so|dylib|zip|tar|gz|rar|7z|pdf|woff2?|ttf|otf|bin|dat)$/i.test(ext)) return;

      const content = await fs.promises.readFile(fullPath, "utf-8");
      const { symbols, dependencies } = parseFile(content, relPath, lang);

      const indexed: IndexedFile = {
        path: relPath,
        language: lang,
        size,
        mtimeMs,
        symbols,
        dependencies,
      };

      this.fileMap.set(relPath, indexed);
      this.cache.files[relPath] = {
        mtimeMs,
        size,
        language: lang,
        symbols,
        dependencies,
      };
    } catch (err: any) {
      this.log("warn", `Failed to parse ${relPath}: ${err.message}`);
    }
  }

  /* ── graph building / import resolution ────────────────────── */

  private buildOutput(
    files: IndexedFile[],
    symbols: IndexSymbol[]
  ): IndexOutput {
    const resolvedFiles = files.map((f) => ({
      ...f,
      dependencies: this.resolveDependencies(f.dependencies),
    }));

    const allDeps: FileDependency[] = [];
    for (const f of resolvedFiles) {
      for (const d of f.dependencies) {
        allDeps.push(d);
      }
    }

    return {
      version: INDEX_VERSION,
      generatedAt: new Date().toISOString(),
      files: resolvedFiles,
      symbols,
      dependencies: allDeps,
    };
  }

  private resolveDependencies(deps: FileDependency[]): FileDependency[] {
    return deps.map((d) => {
      if (!d.target.startsWith(".") && !d.target.startsWith("/")) {
        return { ...d, target: d.target };
      }
      const resolved = this.resolveImport(d.source, d.target);
      if (resolved) {
        return { ...d, target: resolved };
      }
      return d;
    });
  }

  private resolveImport(sourceFile: string, importPath: string): string | null {
    const sourceDir = path.dirname(sourceFile).replace(/\\/g, "/");
    const base = importPath.startsWith("/")
      ? importPath.slice(1)
      : path.join(sourceDir, importPath).replace(/\\/g, "/");

    const candidates = this.generateCandidates(base);
    for (const c of candidates) {
      if (this.fileMap.has(c)) {
        return c;
      }
    }

    if (this.verbose) {
      this.log("debug", `  unresolvable: ${sourceFile} -> ${importPath}`);
    }
    return null;
  }

  private generateCandidates(base: string): string[] {
    const exts = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go"];
    const candidates: string[] = [];
    const hasExt = exts.some((e) => base.endsWith(e));

    if (hasExt) {
      candidates.push(base);
      const withoutExt = base.slice(0, base.lastIndexOf("."));
      for (const ext of exts) {
        const c = `${withoutExt}${ext}`;
        if (c !== base && !candidates.includes(c)) {
          candidates.push(c);
        }
      }
      for (const ext of exts) {
        candidates.push(`${withoutExt}/index${ext}`);
      }
    } else {
      for (const ext of exts) {
        candidates.push(`${base}${ext}`);
      }
      for (const ext of exts) {
        candidates.push(`${base}/index${ext}`);
      }
    }

    return candidates;
  }

  /* ── output writers ────────────────────────────────────────── */

  private collectSymbols(files: IndexedFile[]): IndexSymbol[] {
    const all: IndexSymbol[] = [];
    for (const f of files) {
      for (const s of f.symbols) {
        all.push(s);
      }
    }
    return all;
  }

  private writeOutputs(output: IndexOutput): void {
    const graphPath = path.join(this.outputDir, GRAPH_FILE);
    const symbolsPath = path.join(this.outputDir, SYMBOLS_FILE);

    const graphData = this.buildGraphData(output);
    fs.writeFileSync(graphPath, JSON.stringify(graphData, null, 2), "utf-8");
    fs.writeFileSync(symbolsPath, JSON.stringify(output.symbols, null, 2), "utf-8");

    this.log("info", `Wrote ${graphPath}`);
    this.log("info", `Wrote ${symbolsPath}`);
  }

  private buildGraphData(output: IndexOutput): Record<string, unknown> {
    const nodes = output.files.map((f) => ({
      path: f.path,
      language: f.language,
      size: f.size,
      dependencies: f.dependencies.map((d) => d.target),
    }));

    const edges = output.dependencies.map((d) => ({
      source: d.source,
      target: d.target,
      type: d.type,
    }));

    return {
      version: INDEX_VERSION,
      generatedAt: output.generatedAt,
      nodes,
      edges,
    };
  }

  /* ── cache management ──────────────────────────────────────── */

  private loadCache(): void {
    const cachePath = path.join(this.outputDir, CACHE_FILE);
    try {
      if (fs.existsSync(cachePath)) {
        const raw = fs.readFileSync(cachePath, "utf-8");
        const parsed = JSON.parse(raw) as IndexCache;
        if (parsed.version === INDEX_VERSION) {
          this.cache = parsed;
          this.log("debug", `Loaded cache with ${Object.keys(parsed.files).length} entries`);
        }
      }
    } catch {
      this.log("debug", "Cache load failed, starting fresh");
    }
  }

  private saveCache(): void {
    const cachePath = path.join(this.outputDir, CACHE_FILE);
    this.cache.generatedAt = new Date().toISOString();
    fs.writeFileSync(cachePath, JSON.stringify(this.cache, null, 2), "utf-8");
  }

  /* ── helpers ───────────────────────────────────────────────── */

  private log(
    level: "info" | "success" | "warn" | "error" | "debug",
    msg: string
  ): void {
    if (!this.verbose && level === "debug") return;
    const prefix =
      level === "info"
        ? "\u2139"
        : level === "success"
          ? "\u2713"
          : level === "warn"
            ? "\u26A0"
            : level === "error"
              ? "\u2717"
              : "\u00B7";
    console.log(`${prefix} ${msg}`);
  }
}

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { Language, SymbolType, DependencyType, type SymbolNode, type DependencyNode, type FileInfo, type IndexStatus } from "./types.js";

export interface RepositoryIndexerConfig {
  root: string;
  patterns?: string[];
  exclude?: string[];
  maxFileSize?: number;
  maxParallelWorkers?: number;
  enableIncremental?: boolean;
}

export class RepositoryIndexer {
  private config: RepositoryIndexerConfig;
  private status: IndexStatus;

  constructor(config: RepositoryIndexerConfig) {
    this.config = {
      patterns: ["**/*.ts", "**/*.js", "**/*.tsx", "**/*.jsx", "**/*.py", "**/*.go", "**/*.rs"],
      exclude: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/.git/**", "**/.loom/**"],
      maxFileSize: 10 * 1024 * 1024,
      enableIncremental: true,
      ...config,
    };

    this.status = {
      isComplete: false,
      lastUpdated: 0,
      fileCount: 0,
      symbolCount: 0,
      dependencyCount: 0,
      progress: 0,
      estimatedTimeRemaining: 0,
    };
  }

  getStatus(): IndexStatus {
    return { ...this.status };
  }

  async index(): Promise<{ files: FileInfo[]; symbols: SymbolNode[]; dependencies: DependencyNode[] }> {
    const startTime = Date.now();
    const files = await this.discoverFiles();
    this.status.fileCount = files.length;

    const symbols: SymbolNode[] = [];
    const dependencies: DependencyNode[] = [];

    for (let i = 0; i < files.length; i++) {
      const fileInfo = files[i];
      if (!fileInfo) continue;

      const result = await this.processFile(fileInfo);
      symbols.push(...result.symbols);
      dependencies.push(...result.dependencies);

      this.status.progress = Math.round(((i + 1) / files.length) * 100);
      this.status.symbolCount = symbols.length;
      this.status.dependencyCount = dependencies.length;

      const elapsed = Date.now() - startTime;
      const rate = (i + 1) / elapsed;
      this.status.estimatedTimeRemaining = Math.round((files.length - i - 1) / rate);
    }

    this.status.isComplete = true;
    this.status.lastUpdated = Date.now();
    this.status.progress = 100;
    this.status.estimatedTimeRemaining = 0;

    return { files, symbols, dependencies };
  }

  private async discoverFiles(): Promise<FileInfo[]> {
    const globPattern = this.config.patterns?.length === 1
      ? this.config.patterns[0]
      : `{${this.config.patterns?.join(",")}}`;

    const matches = await fg(globPattern ?? "**/*", {
      cwd: this.config.root,
      ignore: this.config.exclude,
      onlyFiles: true,
      dot: false,
      absolute: false,
    });

    const files: FileInfo[] = [];
    for (const match of matches) {
      try {
        const fullPath = path.join(this.config.root, match);
        const stat = await fs.stat(fullPath);

        if (stat.size > (this.config.maxFileSize ?? 10 * 1024 * 1024)) {
          continue;
        }

        const fileInfo = this.createFileInfo(match, fullPath, stat);
        files.push(fileInfo);
      } catch {
        continue;
      }
    }

    return files;
  }

  private createFileInfo(relativePath: string, fullPath: string, stat: { size: number; mtimeMs: number }): FileInfo {
    const ext = path.extname(relativePath);
    const name = path.basename(relativePath);
    const language = this.detectLanguage(ext);
    const isTest = this.isTestFile(relativePath);
    const isConfig = this.isConfigFile(relativePath);
    const isDocumentation = this.isDocumentationFile(ext);
    const isBuildArtifact = this.isBuildArtifact(relativePath);

    return {
      path: relativePath,
      name,
      extension: ext,
      language,
      size: stat.size,
      lineCount: 0,
      symbolCount: 0,
      dependencyCount: 0,
      lastModified: stat.mtimeMs,
      isTest,
      isConfig,
      isDocumentation,
      isBuildArtifact,
      contentHash: "",
      astHash: "",
    };
  }

  private async processFile(fileInfo: FileInfo): Promise<{ symbols: SymbolNode[]; dependencies: DependencyNode[] }> {
    const fullPath = path.join(this.config.root, fileInfo.path);
    const symbols: SymbolNode[] = [];
    const dependencies: DependencyNode[] = [];

    try {
      const content = await fs.readFile(fullPath, "utf8");
      const lines = content.split("\n");
      fileInfo.lineCount = lines.length;

      const result = this.parseFile(content, fileInfo);
      symbols.push(...result.symbols);
      dependencies.push(...result.dependencies);

      fileInfo.symbolCount = symbols.length;
      fileInfo.dependencyCount = dependencies.length;
    } catch {
      // Skip unreadable files
    }

    return { symbols, dependencies };
  }

  private parseFile(content: string, fileInfo: FileInfo): { symbols: SymbolNode[]; dependencies: DependencyNode[] } {
    const symbols: SymbolNode[] = [];
    const dependencies: DependencyNode[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const trimmedLine = line.trim();

      if (fileInfo.language === Language.TYPESCRIPT || fileInfo.language === Language.JAVASCRIPT) {
        const importMatch = trimmedLine.match(/import\s+.*?\s+from\s+['"](.+?)['"]/);
        if (importMatch && importMatch[1]) {
          dependencies.push({
            id: `${fileInfo.path}:dep:${i}`,
            source: fileInfo.path,
            target: importMatch[1],
            type: DependencyType.IMPORT,
            strength: 1,
            metadata: { line: i + 1 },
            language: fileInfo.language,
          });
        }

        const exportMatch = trimmedLine.match(/export\s+(default\s+)?/);
        if (exportMatch) {
          const symbolMatch = trimmedLine.match(/export\s+(?:default\s+)?(?:class|function|interface|type|const|let|var)\s+(\w+)/);
          if (symbolMatch && symbolMatch[1]) {
            symbols.push({
              id: `${fileInfo.path}:${symbolMatch[1]}`,
              name: symbolMatch[1],
              type: this.determineSymbolType(trimmedLine),
              qualifiedName: symbolMatch[1],
              file: fileInfo.path,
              line: i + 1,
              column: line.indexOf(symbolMatch[1]),
              signature: trimmedLine,
              doc: "",
              modifiers: this.extractModifiers(trimmedLine),
              tags: [],
              exports: true,
              imports: [],
              language: fileInfo.language,
              metadata: {},
            });
          }
        }
      }
    }

    return { symbols, dependencies };
  }

  private determineSymbolType(line: string): SymbolType {
    if (line.includes("class")) return SymbolType.CLASS;
    if (line.includes("function")) return SymbolType.FUNCTION;
    if (line.includes("interface")) return SymbolType.INTERFACE;
    if (line.includes("type")) return SymbolType.TYPE_ALIAS;
    if (line.includes("const")) return SymbolType.CONSTANT;
    if (line.includes("let") || line.includes("var")) return SymbolType.VARIABLE;
    if (line.includes("enum")) return SymbolType.ENUM;
    return SymbolType.FUNCTION;
  }

  private extractModifiers(line: string): string[] {
    const modifiers: string[] = [];
    if (line.includes("export")) modifiers.push("export");
    if (line.includes("default")) modifiers.push("default");
    if (line.includes("async")) modifiers.push("async");
    if (line.includes("static")) modifiers.push("static");
    if (line.includes("abstract")) modifiers.push("abstract");
    if (line.includes("readonly")) modifiers.push("readonly");
    if (line.includes("private")) modifiers.push("private");
    if (line.includes("protected")) modifiers.push("protected");
    if (line.includes("public")) modifiers.push("public");
    return modifiers;
  }

  private detectLanguage(ext: string): Language {
    const extMap: Record<string, Language> = {
      ".ts": Language.TYPESCRIPT,
      ".tsx": Language.TYPESCRIPT,
      ".js": Language.JAVASCRIPT,
      ".jsx": Language.JAVASCRIPT,
      ".py": Language.PYTHON,
      ".go": Language.GO,
      ".rs": Language.RUST,
      ".java": Language.JAVA,
      ".cpp": Language.CPP,
      ".hpp": Language.CPP,
      ".c": Language.CPP,
      ".h": Language.CPP,
    };
    return extMap[ext] ?? Language.UNKNOWN;
  }

  private isTestFile(relativePath: string): boolean {
    const testPatterns = [".test.", ".spec.", "__tests__/", "test/", "tests/"];
    return testPatterns.some(p => relativePath.includes(p));
  }

  private isConfigFile(relativePath: string): boolean {
    const configPatterns = ["config", ".json", ".yaml", ".yml", ".toml", ".env"];
    return configPatterns.some(p => relativePath.toLowerCase().includes(p));
  }

  private isDocumentationFile(ext: string): boolean {
    return [".md", ".rst", ".txt", ".doc"].includes(ext);
  }

  private isBuildArtifact(relativePath: string): boolean {
    const buildPatterns = ["dist/", "build/", "node_modules/", ".next/", "coverage/"];
    return buildPatterns.some(p => relativePath.includes(p));
  }
}
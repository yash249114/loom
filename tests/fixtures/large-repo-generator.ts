import fs from "node:fs/promises";
import path from "node:path";

export interface GeneratedRepo {
  root: string;
  fileCount: number;
  totalBytes: number;
  cleanup: () => Promise<void>;
}

export async function generateRepo(
  root: string,
  fileCount: number,
  depth = 4
): Promise<GeneratedRepo> {
  let created = 0;
  let totalBytes = 0;

  const dirs = ["src", "lib", "components", "utils", "types", "tests", "docs", "scripts"];

  async function walk(dir: string, d: number): Promise<void> {
    if (created >= fileCount) return;
    for (let i = 0; i < 5 && created < fileCount; i++) {
      const isDir = d > 0 && i === 0;
      if (isDir && d > 0) {
        const sub = path.join(dir, dirs[(created + d) % dirs.length]);
        await fs.mkdir(sub, { recursive: true });
        await walk(sub, d - 1);
      } else {
        const name = `file_${created}_${Date.now()}.ts`;
        const content = generateFileContent(created);
        await fs.writeFile(path.join(dir, name), content, "utf8");
        totalBytes += Buffer.byteLength(content, "utf8");
        created++;
      }
    }
  }

  await walk(root, depth);
  return {
    root,
    fileCount: created,
    totalBytes,
    cleanup: async () => {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

function generateFileContent(index: number): string {
  const lines: string[] = [
    `// File ${index} - auto-generated`,
    `import { useState, useEffect } from "react";`,
    ``,
    `export interface Props${index} {`,
    `  id: string;`,
    `  name: string;`,
    `  value: number;`,
    `  onUpdate: (val: number) => void;`,
    `}`,
    ``,
    `const DATA_${index} = {`,
    `  version: "${index}.0.0",`,
    `  timestamp: ${Date.now()},`,
    `  items: [${Array.from({ length: 20 }, (_, i) => i).join(", ")}],`,
    `};`,
    ``,
    `export function process${index}(input: string): string {`,
    `  return input.split("").reverse().join("");`,
    `}`,
    ``,
    `export function calculate${index}(a: number, b: number): number {`,
    `  const result = a * b + Math.sqrt(Math.abs(a - b));`,
    `  return Math.round(result * 100) / 100;`,
    `}`,
    ``,
    `export class Manager${index} {`,
    `  private items: Map<string, Props${index}> = new Map();`,
    ``,
    `  add(key: string, props: Props${index}): void {`,
    `    this.items.set(key, props);`,
    `  }`,
    ``,
    `  get(key: string): Props${index} | undefined {`,
    `    return this.items.get(key);`,
    `  }`,
    ``,
    `  update(key: string, value: number): boolean {`,
    `    const item = this.items.get(key);`,
    `    if (!item) return false;`,
    `    item.onUpdate(value);`,
    `    item.value = value;`,
    `    return true;`,
    `  }`,
    `}`,
    ``,
    `export default Manager${index};`,
  ];
  return lines.join("\n");
}

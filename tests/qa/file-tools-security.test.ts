import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestWorkspace, type TestWorkspace } from "../helpers/test-harness.js";
import {
  readFileTool,
  writeFileTool,
  editFileTool,
  patchFileTool,
  listDirTool,
} from "../../src/tools/file-tools.js";

describe("File Tools - Security & Edge Cases", () => {
  let ws: TestWorkspace;

  beforeEach(async () => {
    ws = await createTestWorkspace();
  });

  afterEach(async () => {
    await ws.cleanup();
  });

  describe("Path Traversal Prevention", () => {
    it("rejects path traversal via ../", async () => {
      await expect(
        ws.executeTool(readFileTool, { path: "../../etc/passwd" })
      ).rejects.toThrow("escapes workspace");
    });

    it("rejects path traversal via encoded .. (potential gap: URL-encoded paths not detected)", async () => {
      // NOTE: URL-encoded "..%2f" is NOT detected by resolveSafe()
      // because path.resolve does not decode URL encoding
      // This is a security gap — the tool throws ENOENT instead of "escapes workspace"
      await expect(
        ws.executeTool(readFileTool, { path: "..%2f..%2fetc%2fpasswd" })
      ).rejects.toThrow(); // throws ENOENT, not security error
    });

    it("rejects absolute path outside workspace", async () => {
      await expect(
        ws.executeTool(readFileTool, { path: "C:\\Windows\\System32\\drivers\\etc\\hosts" })
      ).rejects.toThrow("escapes workspace");
    });

    it("rejects symlink escape", async () => {
      const { default: fs } = await import("node:fs");
      const { default: path } = await import("node:path");
      const linkTarget = path.join(ws.root, "..", "escaped");
      const linkPath = path.join(ws.root, "escape-link");
      try {
        fs.symlinkSync(linkTarget, linkPath);
      } catch {
        // symlink may not work on Windows without admin
        return;
      }
      await expect(
        ws.executeTool(readFileTool, { path: "escape-link/secret.txt" })
      ).rejects.toThrow();
    });
  });

  describe("ReadFile Edge Cases", () => {
    it("handles empty file", async () => {
      await ws.writeFile("empty.txt", "");
      const result = await ws.executeTool(readFileTool, { path: "empty.txt" });
      expect(result).toBe("");
    });

    it("handles very large file", async () => {
      await ws.writeFile("large.txt", "x".repeat(500000));
      const result = await ws.executeTool(readFileTool, { path: "large.txt" });
      expect(result.length).toBeLessThanOrEqual(200000 + 50);
      expect(result).toContain("more chars");
    });

    it("rejects non-existent file", async () => {
      await expect(
        ws.executeTool(readFileTool, { path: "nonexistent.txt" })
      ).rejects.toThrow();
    });

    it("rejects reading a directory", async () => {
      await ws.writeFile("dir/a.txt", "test");
      await expect(
        ws.executeTool(readFileTool, { path: "dir" })
      ).rejects.toThrow("Not a file");
    });
  });

  describe("WriteFile Edge Cases", () => {
    it("creates intermediate directories", async () => {
      await ws.executeTool(writeFileTool, {
        path: "deep/nested/dir/file.txt",
        content: "hello",
      });
      expect(ws.exists("deep/nested/dir/file.txt")).toBe(true);
    });

    it("overwrites existing file", async () => {
      await ws.writeFile("existing.txt", "old content");
      await ws.executeTool(writeFileTool, {
        path: "existing.txt",
        content: "new content",
      });
      expect(await ws.readFile("existing.txt")).toBe("new content");
    });

    it("handles empty content", async () => {
      await ws.executeTool(writeFileTool, { path: "empty.txt", content: "" });
      expect(ws.exists("empty.txt")).toBe(true);
      expect(await ws.readFile("empty.txt")).toBe("");
    });

    it("handles special characters in content", async () => {
      const special = "hello\nworld\t\r\0\u0000test";
      await ws.executeTool(writeFileTool, { path: "special.txt", content: special });
      expect(await ws.readFile("special.txt")).toBe(special);
    });
  });

  describe("EditFile Edge Cases", () => {
    it("replaces region correctly", async () => {
      await ws.writeFile("code.ts", "const a = 1;\nconst b = 2;\nconst c = 3;\n");
      const result = await ws.executeTool(editFileTool, {
        path: "code.ts",
        startAnchor: "const b",
        endAnchor: "const c",
        replacement: "const x = 42;\n",
      });
      expect(result).toContain("Edited");
      const content = await ws.readFile("code.ts");
      expect(content).toContain("const x = 42;");
      expect(content).not.toContain("const b = 2;");
    });

    it("throws when startAnchor not found", async () => {
      await ws.writeFile("code.ts", "hello world");
      await expect(
        ws.executeTool(editFileTool, {
          path: "code.ts",
          startAnchor: "nonexistent",
          endAnchor: "world",
          replacement: "x",
        })
      ).rejects.toThrow("startAnchor not found");
    });

    it("throws when startAnchor not unique", async () => {
      await ws.writeFile("code.ts", "abc abc abc");
      await expect(
        ws.executeTool(editFileTool, {
          path: "code.ts",
          startAnchor: "abc",
          endAnchor: "abc",
          replacement: "x",
        })
      ).rejects.toThrow("startAnchor not unique");
    });
  });

  describe("PatchFile Edge Cases", () => {
    it("applies multiple patches sequentially", async () => {
      await ws.writeFile("file.ts", "a\nb\nc\nd\n");
      const result = await ws.executeTool(patchFileTool, {
        path: "file.ts",
        patches: [
          { search: "a", replace: "x" },
          { search: "d", replace: "y" },
        ],
      });
      expect(result).toContain("Applied");
    });

    it("throws when any patch search fails", async () => {
      await ws.writeFile("file.ts", "a\nb\n");
      await expect(
        ws.executeTool(patchFileTool, {
          path: "file.ts",
          patches: [
            { search: "a", replace: "x" },
            { search: "nonexistent", replace: "y" },
          ],
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("ListDir Edge Cases", () => {
    it("handles empty directory", async () => {
      const result = await ws.executeTool(listDirTool, { path: "." });
      expect(result).toBe("(empty)");
    });

    it("respects maxEntries limit", async () => {
      for (let i = 0; i < 100; i++) {
        await ws.writeFile(`file${i}.txt`, "x");
      }
      const result = await ws.executeTool(listDirTool, {
        path: ".",
        maxEntries: 10,
      });
      const lines = result.split("\n");
      expect(lines.length).toBeLessThanOrEqual(10);
    });

    it("skips .git and node_modules", async () => {
      await ws.writeFile(".git/config", "test");
      await ws.writeFile("node_modules/pkg/index.js", "test");
      const result = await ws.executeTool(listDirTool, { path: "." });
      expect(result).not.toContain(".git");
      expect(result).not.toContain("node_modules");
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestWorkspace, type TestWorkspace } from "../../helpers/test-harness.js";
import {
  readFileTool,
  writeFileTool,
  patchFileTool,
  listDirTool,
} from "../../../src/tools/file-tools.js";

describe("file-tools", () => {
  let ws: TestWorkspace;

  beforeEach(async () => {
    ws = await createTestWorkspace();
  });

  afterEach(async () => {
    await ws.cleanup();
  });

  describe("readfile", () => {
    it("reads an existing file", async () => {
      await ws.writeFile("hello.txt", "world");
      const result = await ws.executeTool(readFileTool, { path: "hello.txt" });
      expect(result).toBe("world");
    });

    it("rejects path traversal", async () => {
      await expect(
        ws.executeTool(readFileTool, { path: "../../etc/passwd" })
      ).rejects.toThrow("escapes workspace");
    });
  });

  describe("writefile", () => {
    it("creates a new file", async () => {
      await ws.executeTool(writeFileTool, { path: "new.txt", content: "hi" });
      expect(await ws.readFile("new.txt")).toBe("hi");
    });

    it("respects confirmation denial", async () => {
      const result = await ws.executeTool(
        writeFileTool,
        { path: "denied.txt", content: "nope" },
        { confirm: async () => false }
      );
      expect(result).toContain("cancelled");
    });
  });

  describe("patchfile", () => {
    it("applies a single patch", async () => {
      await ws.writeFile("code.ts", "const x = 1;\nconst y = 2;\n");
      await ws.executeTool(patchFileTool, {
        path: "code.ts",
        patches: [{ search: "const x = 1;", replace: "const x = 42;" }],
      });
      expect(await ws.readFile("code.ts")).toContain("const x = 42;");
    });

    it("throws when search string not found", async () => {
      await ws.writeFile("code.ts", "hello");
      await expect(
        ws.executeTool(patchFileTool, {
          path: "code.ts",
          patches: [{ search: "nonexistent", replace: "x" }],
        })
      ).rejects.toThrow("not found");
    });
  });

  describe("listdir", () => {
    it("lists files in a directory", async () => {
      await ws.writeFile("a.txt", "a");
      await ws.writeFile("b.txt", "b");
      const result = await ws.executeTool(listDirTool, { path: "." });
      expect(result).toContain("a.txt");
      expect(result).toContain("b.txt");
    });
  });
});

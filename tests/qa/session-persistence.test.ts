import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { mkdtempSync } from "node:fs";
import { SessionStore } from "../../src/session/store.js";
import type { Message } from "../../src/core/types.js";

describe("Session Persistence", () => {
  let tmpDir: string;
  let store: SessionStore;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "loom-session-"));
    store = new SessionStore(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates a session with metadata", async () => {
    const session = await store.create({
      workspace: "/test/workspace",
      provider: "openrouter",
      model: "qwen3-coder",
    });
    expect(session.id).toBeTruthy();
    expect(session.id.startsWith("sess")).toBe(true);
    expect(session.workspace).toBe("/test/workspace");
    expect(session.provider).toBe("openrouter");
    expect(session.model).toBe("qwen3-coder");
    expect(session.messages).toEqual([]);
  });

  it("lists sessions in reverse chronological order", async () => {
    const s1 = await store.create({ workspace: "/a", provider: "p1", model: "m1" });
    await new Promise((r) => setTimeout(r, 10));
    const s2 = await store.create({ workspace: "/b", provider: "p2", model: "m2" });

    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].id).toBe(s2.id);
    expect(list[1].id).toBe(s1.id);
  });

  it("updates session messages", async () => {
    const session = await store.create({ workspace: "/w", provider: "p", model: "m" });
    const messages: Message[] = [
      { role: "user", content: "hello", timestamp: Date.now() },
      { role: "assistant", content: "world", timestamp: Date.now() + 1 },
    ];
    await store.update(session.id, messages);

    const loaded = await store.get(session.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.messages).toHaveLength(2);
  });

  it("attaches ids to messages on update", async () => {
    const session = await store.create({ workspace: "/w", provider: "p", model: "m" });
    const messages: Message[] = [
      { role: "user", content: "hi" },
    ];
    await store.update(session.id, messages);
    const loaded = await store.get(session.id);
    expect(loaded!.messages[0].id).toBeTruthy();
  });

  it("deletes sessions", async () => {
    const session = await store.create({ workspace: "/w", provider: "p", model: "m" });
    await store.delete(session.id);
    const loaded = await store.get(session.id);
    expect(loaded).toBeNull();
  });

  it("returns null for unknown session", async () => {
    const result = await store.get("nonexistent-id");
    expect(result).toBeNull();
  });

  it("persists data to disk", async () => {
    await store.create({ workspace: "/w", provider: "p", model: "m" });
    const dbFile = path.join(tmpDir, "sessions.json");
    expect(fs.existsSync(dbFile)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(dbFile, "utf8"));
    expect(raw.sessions).toHaveLength(1);
  });

  it("handles multiple concurrent writes", async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      store.create({
        workspace: `/w${i}`,
        provider: "p",
        model: "m",
      })
    );
    const sessions = await Promise.all(promises);
    expect(sessions).toHaveLength(10);
    const list = await store.list();
    expect(list).toHaveLength(10);
  });

  it("handles corrupt database gracefully", async () => {
    const dbFile = path.join(tmpDir, "sessions.json");
    fs.writeFileSync(dbFile, "corrupt json data");
    const newStore = new SessionStore(tmpDir);
    const list = await newStore.list();
    expect(list).toEqual([]);
  });
});

describe("Session Store - Edge Cases", () => {
  it("creates directory recursively", async () => {
    const deepDir = mkdtempSync(path.join(os.tmpdir(), "loom-deep-"));
    const nested = path.join(deepDir, "a", "b", "c");
    const store = new SessionStore(nested);
    await store.create({ workspace: "/w", provider: "p", model: "m" });
    expect(fs.existsSync(nested)).toBe(true);
    fs.rmSync(deepDir, { recursive: true, force: true });
  });

  it("handles empty update gracefully", async () => {
    const tmpDir = mkdtempSync(path.join(os.tmpdir(), "loom-empty-"));
    const store = new SessionStore(tmpDir);
    await store.update("nonexistent", []);
    const list = await store.list();
    expect(list).toHaveLength(0);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

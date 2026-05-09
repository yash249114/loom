import { describe, it, expect } from "vitest";
import { interpolateEnv, truncate, safeJSON, newId, withTimeout } from "../../../src/core/util.js";

describe("newId", () => {
  it("generates a string with the given prefix", () => {
    const id = newId("test");
    expect(id).toMatch(/^test/);
    expect(id.length).toBeGreaterThan(4);
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => newId("x")));
    expect(ids.size).toBe(100);
  });

  it("works without prefix", () => {
    const id = newId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});

describe("interpolateEnv", () => {
  it("replaces ${VAR} with env values", () => {
    process.env.__TEST_VAR = "hello";
    expect(interpolateEnv("${__TEST_VAR}")).toBe("hello");
    delete process.env.__TEST_VAR;
  });

  it("replaces missing vars with empty string", () => {
    delete process.env.__NONEXISTENT;
    expect(interpolateEnv("key=${__NONEXISTENT}")).toBe("key=");
  });

  it("recurses into objects", () => {
    process.env.__T = "val";
    const result = interpolateEnv({ a: "${__T}", b: { c: "${__T}" } });
    expect(result).toEqual({ a: "val", b: { c: "val" } });
    delete process.env.__T;
  });

  it("recurses into arrays", () => {
    process.env.__T = "x";
    expect(interpolateEnv(["${__T}", "plain"])).toEqual(["x", "plain"]);
    delete process.env.__T;
  });

  it("passes through numbers and booleans", () => {
    expect(interpolateEnv(42)).toBe(42);
    expect(interpolateEnv(true)).toBe(true);
  });
});

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("abc", 10)).toBe("abc");
  });

  it("truncates long strings with indicator", () => {
    const result = truncate("abcdefgh", 5);
    expect(result).toContain("…[3 more chars]");
    expect(result.startsWith("abcde")).toBe(true);
  });

  it("handles exact-length strings", () => {
    expect(truncate("abc", 3)).toBe("abc");
  });
});

describe("safeJSON", () => {
  it("parses valid JSON", () => {
    expect(safeJSON('{"a":1}')).toEqual({ a: 1 });
  });

  it("returns null for invalid JSON", () => {
    expect(safeJSON("not json")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(safeJSON("")).toBeNull();
  });
});

describe("withTimeout", () => {
  it("resolves if promise completes in time", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 1000);
    expect(result).toBe("ok");
  });

  it("rejects if promise exceeds timeout", async () => {
    const slow = new Promise((r) => setTimeout(() => r("late"), 5000));
    await expect(withTimeout(slow, 50, "test")).rejects.toThrow("timed out");
  });
});

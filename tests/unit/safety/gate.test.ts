import { describe, it, expect } from "vitest";
import { SafetyGate } from "../../../src/safety/gate.js";
import type { SafetyConfig } from "../../../src/core/types.js";

function makeConfig(overrides?: Partial<SafetyConfig>): SafetyConfig {
  return {
    requireConfirmForShell: true,
    requireConfirmForWrite: true,
    blockedCommands: ["rm -rf /"],
    sandbox: false,
    ...overrides,
  };
}

describe("SafetyGate", () => {
  it("prompts for shell confirmation when required", async () => {
    let prompted = false;
    const gate = new SafetyGate(makeConfig(), async () => {
      prompted = true;
      return true;
    });
    const result = await gate.confirmShell("ls");
    expect(prompted).toBe(true);
    expect(result).toBe(true);
  });

  it("skips shell confirmation when not required", async () => {
    let prompted = false;
    const gate = new SafetyGate(
      makeConfig({ requireConfirmForShell: false }),
      async () => { prompted = true; return true; }
    );
    await gate.confirmShell("ls");
    expect(prompted).toBe(false);
  });

  it("skips shell confirmation in sandbox mode", async () => {
    let prompted = false;
    const gate = new SafetyGate(
      makeConfig({ sandbox: true }),
      async () => { prompted = true; return true; }
    );
    const result = await gate.confirmShell("ls");
    expect(prompted).toBe(false);
    expect(result).toBe(true);
  });

  it("always allows when alwaysAllow is set", async () => {
    let prompted = false;
    const gate = new SafetyGate(makeConfig(), async () => {
      prompted = true;
      return false;
    });
    gate.setAlwaysAllow(true);
    expect(await gate.confirmShell("dangerous")).toBe(true);
    expect(await gate.confirmWrite("delete file")).toBe(true);
    expect(await gate.confirmGeneric("anything")).toBe(true);
    expect(prompted).toBe(false);
  });

  it("respects user denial", async () => {
    const gate = new SafetyGate(makeConfig(), async () => false);
    expect(await gate.confirmShell("rm -rf stuff")).toBe(false);
  });

  it("prompts for write confirmation when required", async () => {
    let prompted = false;
    const gate = new SafetyGate(
      makeConfig({ requireConfirmForWrite: true }),
      async () => { prompted = true; return true; }
    );
    await gate.confirmWrite("write 100 bytes");
    expect(prompted).toBe(true);
  });

  it("skips write confirmation when not required", async () => {
    let prompted = false;
    const gate = new SafetyGate(
      makeConfig({ requireConfirmForWrite: false }),
      async () => { prompted = true; return true; }
    );
    await gate.confirmWrite("write 100 bytes");
    expect(prompted).toBe(false);
  });

  it("always prompts for generic confirmation", async () => {
    let prompted = false;
    const gate = new SafetyGate(makeConfig(), async (msg) => {
      prompted = true;
      expect(msg).toBe("custom");
      return true;
    });
    await gate.confirmGeneric("custom");
    expect(prompted).toBe(true);
  });
});

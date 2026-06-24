import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { mkdtempSync } from "node:fs";
import { ToolRegistry } from "../../src/tools/registry.js";
import { loadPlugins } from "../../src/plugins/loader.js";

describe("Plugin System", () => {
  let tmpDir: string;
  let registry: ToolRegistry;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "loom-plugin-"));
    registry = new ToolRegistry();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads a valid ESM plugin", async () => {
    const pluginContent = `
import { z } from "zod";
export default function register(registry) {
  registry.register({
    name: "weather",
    description: "Get weather",
    parameters: z.object({ city: z.string() }),
    handler: async ({ city }) => \`Weather in \${city}: 22°C\`,
  });
}
`;
    fs.writeFileSync(path.join(tmpDir, "weather-plugin.js"), pluginContent);
    const loaded = await loadPlugins(tmpDir, registry);
    expect(loaded).toContain("weather-plugin.js");
    expect(registry.has("weather")).toBe(true);
  });

  it("loads plugins from non-existent directory", async () => {
    const loaded = await loadPlugins("/nonexistent/plugin/dir", registry);
    expect(loaded).toEqual([]);
  });

  it("loads multiple plugins", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "plugin-a.js"),
      `import { z } from "zod";
export default (r) => r.register({ name:"a", description:"", parameters:z.object({}), handler:async () => "a" });`
    );
    fs.writeFileSync(
      path.join(tmpDir, "plugin-b.js"),
      `import { z } from "zod";
export default (r) => r.register({ name:"b", description:"", parameters:z.object({}), handler:async () => "b" });`
    );
    const loaded = await loadPlugins(tmpDir, registry);
    expect(loaded).toHaveLength(2);
    expect(registry.has("a")).toBe(true);
    expect(registry.has("b")).toBe(true);
  });

  it("handles plugin load failure gracefully", async () => {
    fs.writeFileSync(path.join(tmpDir, "broken-plugin.js"), "not valid javascript {{{");
    const loaded = await loadPlugins(tmpDir, registry);
    expect(loaded).toHaveLength(0);
  });

  it("only loads .js and .mjs files", async () => {
    fs.writeFileSync(path.join(tmpDir, "plugin.js"), `export default () => {};`);
    fs.writeFileSync(path.join(tmpDir, "plugin.ts"), `export default () => {};`);
    fs.writeFileSync(path.join(tmpDir, "plugin.json"), `{}`);
    fs.writeFileSync(path.join(tmpDir, "readme.txt"), `hello`);
    const loaded = await loadPlugins(tmpDir, registry);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toBe("plugin.js");
  });

  it("handles plugin with no default export", async () => {
    fs.writeFileSync(path.join(tmpDir, "no-export.js"), `export const x = 1;`);
    const loaded = await loadPlugins(tmpDir, registry);
    expect(loaded).toHaveLength(0);
  });

  it("plugin can register multiple tools", async () => {
    const content = `
import { z } from "zod";
export default function(r) {
  r.register({ name:"tool1", description:"", parameters:z.object({}), handler:async () => "1" });
  r.register({ name:"tool2", description:"", parameters:z.object({}), handler:async () => "2" });
}`;
    fs.writeFileSync(path.join(tmpDir, "multi.js"), content);
    await loadPlugins(tmpDir, registry);
    expect(registry.has("tool1")).toBe(true);
    expect(registry.has("tool2")).toBe(true);
  });

  it("plugin can override existing tool", async () => {
    const z = require("zod");
    registry.register({
      name: "override-me",
      description: "original",
      parameters: z.object({}),
      handler: async () => "original",
    });
    const content = `
import { z } from "zod";
export default function(r) { r.register({ name:"override-me", description:"", parameters:z.object({}), handler:async () => "overridden" }); }`;
    fs.writeFileSync(path.join(tmpDir, "override.js"), content);
    await loadPlugins(tmpDir, registry);
    expect(registry.has("override-me")).toBe(true);
  });
});

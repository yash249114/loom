import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { ModelDiscovery } from "../providers/discovery.js";
import { SessionStore } from "../session/store.js";
import { workspaceLayout, readWorkspaceContext } from "../workspace/workspace.js";
import { gatherDashboardData } from "../core/dashboard-data.js";
import { B, D, G, R, Y, C, M, SEP, LOOM, PKG_VERSION, elapsedMs } from "./format.js";
import { currentAgent, switchAgent } from "../core/loom.js";
import type { CommandContext } from "./types.js";
import type { LoomConfig, ProviderKey } from "../core/types.js";

// ── Agent metadata ───────────────────────────────────────────────────

type AgentMode = "plan" | "build" | "review" | "debug" | "research" | "test";

const AGENTS: { id: AgentMode; label: string; icon: string }[] = [
  { id: "plan", label: "Plan", icon: "\u{1F3D7}" },
  { id: "build", label: "Build", icon: "\u2699" },
  { id: "review", label: "Review", icon: "\u{1F50D}" },
  { id: "debug", label: "Debug", icon: "\u{1F41B}" },
  { id: "research", label: "Research", icon: "\u{1F50E}" },
  { id: "test", label: "Test", icon: "\u{1F3AF}" },
];

// ── Core handlers ─────────────────────────────────────────────────────

export async function handleClear(args: string, ctx: CommandContext): Promise<void> {
  const printStartup = (await import("../core/loom.js")).printStartup;
  printStartup(ctx.cwd, ctx.branch, ctx.config);
}

export async function handleQuit(_args: string, _ctx: CommandContext): Promise<void> {
  console.log(D("Goodbye."));
  process.exit(0);
}

export function handleVersion(): void {
  console.log(`  ${LOOM}  ${D("v" + PKG_VERSION)}`);
}

export function handleConfig(_args: string, ctx: CommandContext): void {
  const config = ctx.config;
  console.log(`  ${B("Configuration")}`);
  console.log(SEP);
  console.log(`  ${D("Provider:")}      ${config.defaultProvider ?? "ollama"}`);
  console.log(`  ${D("Models:")}       coding=${config.models?.coding ?? "auto"}  local=${config.models?.local ?? "auto"}`);
  console.log(`  ${D("Routing:")}      ${config.routing?.defaultMode ?? "auto"}  ${D("(ttl: " + (config.routing?.cacheTtlMs ?? 300000) + "ms)")}`);
  const mk = Object.entries(config.providers ?? {})
    .filter(([, v]) => v?.apiKey)
    .map(([k]) => k);
  console.log(`  ${D("API keys:")}     ${mk.length ? mk.join(", ") : "none"}`);
  const mcpN = Object.keys(config.mcpServers ?? {}).length;
  console.log(`  ${D("MCP servers:")}  ${mcpN}`);
}

export async function handleTheme(args: string): Promise<void> {
  if (!args) {
    console.log(`  ${D("Theme support: built-in dark theme (default)")}`);
    console.log(`  ${D("Usage:")} /theme list   ${D("— list available themes")}`);
    return;
  }
  console.log(`  ${D("Theme: " + args + " (not yet implemented)")}`);
}

export async function handleDoctor(_args: string, ctx: CommandContext): Promise<void> {
  console.log(`  ${B("Doctor")}`);
  console.log(SEP);
  const discovery = new ModelDiscovery({ cacheTtlMs: ctx.config.routing.cacheTtlMs });
  const results = await discovery.discoverAll();
  let allOk = true;
  for (const r of results) {
    const icon = r.ok ? G("\u2713") : R("\u2717");
    const detail = r.ok
      ? `${r.models?.length ?? 0} models ${r.latencyMs ? "(" + r.latencyMs + "ms)" : ""}`
      : r.error ?? "unknown";
    console.log(`  ${icon} ${B(r.name.padEnd(12))} ${D(detail)}`);
    if (!r.ok) allOk = false;
  }
  console.log();
  if (allOk) console.log(`  ${G("\u2713")} ${B("All systems ready.")}`);
  else console.log(`  ${Y("\u26A0")} ${D("Some providers need attention.")}`);
}

// ── Repository handlers ───────────────────────────────────────────────

export async function handleInit(_args: string, ctx: CommandContext): Promise<void> {
  console.log(`  Initializing...`);
  try {
    const { initWorkspace } = await import("../workspace/workspace.js");
    await initWorkspace(ctx.cwd);
    console.log(`  ${G("\u2713")} Workspace initialized`);
  } catch (e: any) {
    console.log(`  ${R("\u2717")} ${e.message}`);
  }
}

export async function handleIndex(_args: string, ctx: CommandContext): Promise<void> {
  const t0 = Date.now();
  console.log(`  Indexing ${B(path.basename(ctx.cwd))}...`);
  try {
    const { Indexer } = await import("../indexer/indexer.js");
    const indexer = new Indexer({ rootDir: ctx.cwd, verbose: false });
    const result = await indexer.run(true);
    console.log(`  ${G("\u2713")} Indexed ${B(String(result.files.length))} files, ${B(String(result.symbols.length))} symbols, ${B(String(result.dependencies.length))} deps ${D("(" + elapsedMs(t0) + ")")}`);
  } catch (e: any) {
    console.log(`  ${R("\u2717")} Index failed: ${e.message}`);
  }
}

export async function handleGraph(_args: string, ctx: CommandContext): Promise<void> {
  const p = path.join(ctx.cwd, ".loom", "graph.json");
  try {
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    const edges = data.edges ?? [];
    const nodes = data.nodes ?? [];
    console.log(`  ${B("Dependency Graph")}`);
    console.log(SEP);
    console.log(`  ${D("Nodes:")} ${nodes.length}  ${D("Edges:")} ${edges.length}`);
    if (edges.length > 0) {
      console.log();
      for (const e of edges.slice(0, 20)) {
        console.log(`    ${D(e.source ?? "?")} ${D("\u2192")} ${D(e.target ?? "?")}`);
      }
      if (edges.length > 20) console.log(`    ${D("... and " + (edges.length - 20) + " more")}`);
    }
  } catch {
    console.log(`  ${D("No graph. Run /index first.")}`);
  }
}

export async function handleContext(_args: string, ctx: CommandContext): Promise<void> {
  console.log(`  ${B("Workspace Context")}`);
  console.log(SEP);
  try {
    const txt = await readWorkspaceContext(ctx.cwd);
    const lines = txt.split("\n").filter(Boolean);
    console.log(`  ${lines.length} ${D("context lines")}`);
    for (const l of lines.slice(0, 15)) {
      console.log(`  ${D("\u2022")} ${l.slice(0, 100)}`);
    }
    if (lines.length > 15) console.log(`  ${D("... and " + (lines.length - 15) + " more")}`);
  } catch {
    console.log(`  ${D("No workspace context.")}`);
  }
}

export async function handleSearch(args: string, ctx: CommandContext): Promise<void> {
  if (!args) {
    console.log(`  ${D("Usage: /search <query>")}`);
    return;
  }
  console.log(`  Searching for ${B(args)}...`);
  try {
    const { MemoryPipeline } = await import("../memory/pipeline.js");
    const { EventBus } = await import("../core/events.js");
    const events = new EventBus();
    const pipeline = new MemoryPipeline({ rootDir: ctx.cwd, verbose: false, eventBus: events });
    await pipeline.init();
    const results = await pipeline.searchAll(args, 20);
    const { symbols, memory, arch } = results;
    console.log();
    if (symbols.length) {
      console.log(`  ${B("Symbols")} ${D("(" + symbols.length + ")")}`);
      for (const s of symbols.slice(0, 10)) {
        console.log(`    ${C(s.name ?? "?")} ${D(s.file ? "\u2014 " + path.relative(ctx.cwd, s.file) : "")}`);
      }
      if (symbols.length > 10) console.log(`    ${D("... and " + (symbols.length - 10) + " more")}`);
      console.log();
    }
    if (memory.length) {
      console.log(`  ${B("Memory")} ${D("(" + memory.length + ")")}`);
      for (const m of memory.slice(0, 5)) {
        console.log(`    ${D("\u2022")} ${(m.content ?? "").slice(0, 100)}`);
      }
      console.log();
    }
    if (arch.length) {
      console.log(`  ${B("Architecture")} ${D("(" + arch.length + ")")}`);
      for (const a of arch.slice(0, 5)) {
        console.log(`    ${D("\u2022")} ${a.title ?? "ADR"}`);
      }
    }
    if (!symbols.length && !memory.length && !arch.length) {
      console.log(`  ${D("No results for \"" + args + "\"")}`);
    }
  } catch (e: any) {
    console.log(`  ${R("\u2717")} Search failed: ${e.message}`);
  }
}

export async function handleRepo(_args: string, ctx: CommandContext): Promise<void> {
  await handleStatus("", ctx);
}

// ── Memory handlers ───────────────────────────────────────────────────

export async function handleMemory(args: string, ctx: CommandContext): Promise<void> {
  const parts = args.split(/\s+/);
  const sub = parts[0]?.toLowerCase();

  if (!sub || sub === "list" || sub === "show") {
    console.log(`  ${B("Memory")}`);
    console.log(SEP);
    try {
      const { MemoryPipeline } = await import("../memory/pipeline.js");
      const { EventBus } = await import("../core/events.js");
      const events = new EventBus();
      const pipeline = new MemoryPipeline({ rootDir: ctx.cwd, verbose: false, eventBus: events });
      await pipeline.init();
      const all = await pipeline.longTermMemory.getAll();
      if (all.length) {
        for (const o of all.slice(0, 10)) {
          const label = o.type ?? "note";
          console.log(`  ${D("\u2022")} ${G("[" + label + "]")} ${(o.content ?? "").slice(0, 100)}`);
        }
        if (all.length > 10) console.log(`  ${D("... and " + (all.length - 10) + " more")}`);
        console.log(`  ${D(all.length + " total observations")}`);
      } else {
        console.log(`  ${D("No memory yet.")}`);
      }
    } catch {
      console.log(`  ${D("No memory yet.")}`);
    }
    return;
  }

  if (sub === "search" && parts[1]) {
    await handleSearch(parts.slice(1).join(" "), ctx);
    return;
  }

  if (sub === "add" && parts[1]) {
    const note = parts.slice(1).join(" ");
    console.log(`  Adding memory: ${note}`);
    try {
      const { MemoryPipeline } = await import("../memory/pipeline.js");
      const { EventBus } = await import("../core/events.js");
      const events = new EventBus();
      const pipeline = new MemoryPipeline({ rootDir: ctx.cwd, verbose: false, eventBus: events });
      await pipeline.init();
      const { newId } = await import("../core/util.js");
      await pipeline.longTermMemory.persist([
        { id: newId("mem"), type: "note", content: note, timestamp: Date.now(), confidence: 1, importance: 3, files: [], symbols: [], tags: [] } as any,
      ]);
      console.log(`  ${G("\u2713")} Note saved`);
    } catch (e: any) {
      console.log(`  ${R("\u2717")} ${e.message}`);
    }
    return;
  }

  if (sub === "clear") {
    console.log(`  ${D("Clearing memory...")}`);
    try {
      const { MemoryPipeline } = await import("../memory/pipeline.js");
      const { EventBus } = await import("../core/events.js");
      const events = new EventBus();
      const pipeline = new MemoryPipeline({ rootDir: ctx.cwd, verbose: false, eventBus: events });
      await pipeline.init();
      await fs.promises.writeFile(
        path.join(ctx.cwd, ".loom", "memory", "observations.json"),
        JSON.stringify({ observations: [], tags: {} }, null, 2)
      );
      console.log(`  ${G("\u2713")} Memory cleared`);
    } catch {
      console.log(`  ${D("No memory to clear.")}`);
    }
    return;
  }

  console.log(`  ${D("Usage: /memory [list|search <q>|add <note>|clear]")}`);
}

// ── Agent handlers ────────────────────────────────────────────────────

export async function handleAgents(_args: string): Promise<void> {
  console.log(`  ${B("Agent Modes")}`);
  console.log(SEP);
  for (const a of AGENTS) {
    const active = a.id === currentAgent;
    console.log(`  ${active ? G("\u25CF") : D("\u25CB")} ${a.icon} ${active ? B(a.label) : a.label}`);
  }
  console.log();
  console.log(`  ${D("Current:")} ${M(currentAgent)}`);
  console.log(`  ${D("Switch:")}  /agent switch <mode>`);
}

export async function handleAgent(args: string): Promise<void> {
  const parts = args.split(/\s+/);
  const sub = parts[0]?.toLowerCase();

  if (!sub || sub === "status") {
    console.log(`  ${B("Agent Status")}`);
    console.log(SEP);
    const a = AGENTS.find((x) => x.id === currentAgent);
    console.log(`  ${G("\u25CF")} ${a?.icon ?? ""} ${B(currentAgent)}  ${D("(active)")}`);
    console.log();
    for (const ag of AGENTS) {
      if (ag.id !== currentAgent) {
        console.log(`  ${D("\u25CB")} ${ag.icon} ${ag.label}`);
      }
    }
    return;
  }

  if (sub === "switch" && parts[1]) {
    const target = parts[1].toLowerCase() as AgentMode;
    if (AGENTS.find((a) => a.id === target)) {
      switchAgent(target as AgentMode);
      console.log(`  ${G("\u2713")} Switched to ${M(target)}`);
    } else {
      console.log(`  ${R("\u2717")} Unknown agent: ${target}`);
      console.log(`  ${D("Available:")} ${AGENTS.map((a) => a.id).join(", ")}`);
    }
    return;
  }

  if (sub === "mode") {
    console.log(`  ${B("Agent Modes")}`);
    console.log(SEP);
    for (const a of AGENTS) {
      console.log(`  ${a.icon} ${a.id}  ${D(a.label)}`);
    }
    console.log();
    console.log(`  ${D("Current:")} ${M(currentAgent)}`);
    return;
  }

  console.log(`  ${D("Usage: /agent [status|switch <mode>|mode]")}`);
}

// ── Provider handlers ─────────────────────────────────────────────────

export async function handleProviders(_args: string, ctx: CommandContext): Promise<void> {
  console.log(`  ${B("Providers")}`);
  console.log(SEP);
  const discovery = new ModelDiscovery({ workspaceDir: ctx.cwd, cacheTtlMs: ctx.config.routing.cacheTtlMs });
  const results = await discovery.discoverAll();

  for (const r of results) {
    const hasEp = !!(ctx.config.providerEndpoints?.[r.key as ProviderKey]?.apiKey);
    const hasProv = !!(ctx.config.providers?.[r.key]?.apiKey);
    const hasEnv = !!process.env[r.key.toUpperCase() + "_API_KEY"];
    const hasKey = hasEp || hasProv || hasEnv;

    const icon = r.ok ? G("\u25CF") : hasKey ? R("\u25CF") : D("\u25CB");
    const detail = r.ok
      ? `${G("online")} ${r.latencyMs ? "(" + r.latencyMs + "ms)" : ""} ${r.models ? "\u2014 " + r.models.length + " models" : ""}`
      : hasKey
        ? `${R("error")} \u2014 ${r.error ?? "connection failed"}`
        : `${D("no API key")}`;

    console.log(`  ${icon} ${B(r.name.padEnd(12))} ${detail}`);
  }
}

export async function handleModels(_args: string, ctx: CommandContext): Promise<void> {
  console.log(`  ${B("Models")}`);
  console.log(SEP);
  const discovery = new ModelDiscovery({ workspaceDir: ctx.cwd, cacheTtlMs: ctx.config.routing.cacheTtlMs });
  const results = await discovery.discoverAll();
  for (const r of results) {
    const icon = r.ok ? G("\u2713") : R("\u2717");
    const count = r.models ? ` ${r.models.length} models` : "";
    const lat = r.latencyMs ? D(" (" + r.latencyMs + "ms)") : "";
    console.log(`  ${icon} ${B(r.name)}${count}${lat}`);
    if (!r.ok && r.error) console.log(`      ${R(r.error)}`);
    if (r.models && r.models.length > 0) {
      const top = r.models.slice(0, 3).map((m) => m.id).join(", ");
      console.log(`      ${D(top + (r.models.length > 3 ? "..." : ""))}`);
    }
  }
}

export async function handleRouting(_args: string, ctx: CommandContext): Promise<void> {
  const config = ctx.config;
  console.log(`  ${B("Routing")}`);
  console.log(SEP);
  console.log(`  ${D("Mode:")}       ${config.routing?.defaultMode ?? "auto"}`);
  console.log(`  ${D("Cache TTL:")} ${config.routing?.cacheTtlMs ?? 300000}ms`);
  console.log(`  ${D("Coding:")}    ${config.models?.coding ?? "auto"}`);
  console.log(`  ${D("Reasoning:")} ${config.models?.reasoning ?? "auto"}`);
  console.log(`  ${D("Local:")}     ${config.models?.local ?? "codestral:latest"}`);
  console.log(`  ${D("General:")}   ${config.models?.general ?? "auto"}`);
  if (config.models?.fallback) console.log(`  ${D("Fallback:")}  ${config.models.fallback}`);
}

// ── Session handlers ──────────────────────────────────────────────────

export async function handleSessions(args: string, ctx: CommandContext): Promise<void> {
  const parts = args.split(/\s+/);
  const sub = parts[0]?.toLowerCase();

  try {
    const layout = workspaceLayout(ctx.cwd);
    const store = new SessionStore(layout.sessionsDir);

    if (!sub || sub === "list") {
      console.log(`  ${B("Sessions")}`);
      console.log(SEP);
      const list = await store.list();
      if (!list.length) {
        console.log(`  ${D("No sessions.")}`);
      } else {
        for (const s of list.slice(0, 10)) {
          const date = new Date(s.updatedAt).toLocaleDateString();
          const id = s.id.slice(0, 8);
          console.log(`  ${D("\u2022")} ${C(id)} ${date} ${s.provider}/${s.model} ${s.messages.length} msgs`);
        }
        if (list.length > 10) console.log(`  ${D("... and " + (list.length - 10) + " more")}`);
      }
      return;
    }

    if (sub === "new") {
      const s = await store.create({ workspace: ctx.cwd, provider: "unknown", model: "unknown" });
      console.log(`  ${G("\u2713")} Session ${C(s.id.slice(0, 8))} created`);
      return;
    }

    if (sub === "delete" && parts[1]) {
      await store.delete(parts[1]);
      console.log(`  ${G("\u2713")} Session ${C(parts[1].slice(0, 8))} deleted`);
      return;
    }

    if (sub === "load" && parts[1]) {
      const s = await store.get(parts[1]);
      if (s) {
        console.log(`  ${B("Session " + s.id.slice(0, 8))}`);
        console.log(SEP);
        console.log(`  ${D("Provider:")} ${s.provider}  ${D("Model:")} ${s.model}`);
        console.log(`  ${D("Messages:")} ${s.messages.length}  ${D("Updated:")} ${new Date(s.updatedAt).toLocaleString()}`);
        if (s.summary) console.log(`  ${D("Summary:")} ${s.summary}`);
      } else {
        console.log(`  ${R("\u2717")} Session not found`);
      }
      return;
    }

    console.log(`  ${D("Usage: /sessions [list|new|load <id>|delete <id>]")}`);
  } catch (e: any) {
    console.log(`  ${R("\u2717")} ${e.message}`);
  }
}

// ── MCP handlers ──────────────────────────────────────────────────────

export async function handleMcp(_args: string, ctx: CommandContext): Promise<void> {
  const parts = _args.split(/\s+/);
  const sub = parts[0]?.toLowerCase();
  const servers = ctx.config.mcpServers ?? {};
  const entries = Object.entries(servers);

  if (!sub || sub === "list" || sub === "status") {
    console.log(`  ${B("MCP Servers")}`);
    console.log(SEP);
    if (!entries.length) {
      console.log(`  ${D("No MCP servers configured.")}`);
    } else {
      for (const [name, srv] of entries) {
        console.log(`  ${G("\u25CF")} ${B(name)}  ${D([srv.command, ...(srv.args ?? [])].join(" "))}`);
      }
    }
    return;
  }

  console.log(`  ${D("Usage: /mcp [list|status]")}`);
}

// ── Status / Dashboard ────────────────────────────────────────────────

function statusIcon(s: string): string {
  if (s === "online") return G("\u25CF");
  if (s === "standby") return Y("\u25D0");
  return R("\u25CB");
}

export async function handleStatus(_args: string, ctx: CommandContext): Promise<void> {
  console.log(`  ${B("System Status")}`);
  console.log(SEP);
  const data = gatherDashboardData(ctx.cwd);
  const m = data.indexMetrics;
  console.log(`  ${D("Index:")}     ${m.filesIndexed} files, ${m.symbols} symbols, ${m.dependencies} deps`);
  console.log(`  ${D("Languages:")} ${m.languages.length > 0 ? m.languages.slice(0, 5).join(", ") : "none"}`);
  console.log();
  console.log(`  ${D("Health:")}`);
  const h = data.healthStatus;
  console.log(`    ${statusIcon(h.indexer)} Indexer`);
  console.log(`    ${statusIcon(h.graph)} Graph`);
  console.log(`    ${statusIcon(h.memory)} Memory`);
  console.log();
  console.log(`  ${D("Providers:")}`);
  for (const p of data.providers) {
    const icon = p.status === "online" || p.status === "models-available"
      ? G("\u25CF") : p.status === "api-key-missing" ? Y("\u25CB") : R("\u25CB");
    console.log(`    ${icon} ${p.name} ${p.modelsAvailable > 0 ? "\u2014 " + p.modelsAvailable + " models" : D("(" + p.status + ")")}`);
  }
  console.log();
  console.log(`  ${D("Agents:")}`);
  for (const a of data.agents) {
    const icon = a.status === "running" ? G("\u25CF") : D("\u25CB");
    console.log(`    ${icon} ${a.name} ${D(a.description)}`);
  }
}

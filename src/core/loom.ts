import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";
import { execSync } from "node:child_process";
import { loadConfig } from "../config/loader.js";
import { createRoutedProvider } from "../providers/factory.js";
import { buildDefaultRegistry } from "../tools/index.js";
import { SafetyGate } from "../safety/gate.js";
import { Agent } from "../agent/agent.js";
import { routeTask } from "../agent/router.js";
import { loadPlugins } from "../plugins/loader.js";
import { SessionStore } from "../session/store.js";
import { workspaceLayout, readWorkspaceContext } from "../workspace/workspace.js";
import { gatherDashboardData } from "./dashboard-data.js";
import { CommandRegistry, CommandHistory, setupCompletion, printHelp, createCommands } from "../commands/index.js";
import type { LoomConfig } from "./types.js";

import { B, D, G, R, Y, C, M, SEP, LOOM, PKG_VERSION, elapsedMs } from "../commands/format.js";

type AgentMode = "plan" | "build" | "review" | "debug" | "research" | "test";
export let currentAgent: AgentMode = "build";
export function switchAgent(mode: AgentMode): void { currentAgent = mode; }

function gitBranch(cwd: string): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      cwd, encoding: "utf8", timeout: 2000, stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "detached";
  }
}

function dot(n: number): string {
  return n ? `${G("\u25CF")}` : `${D("\u25CB")}`;
}

const LAYOUT = {
  quick: {
    Core: ["/help", "/clear", "/quit"],
    Repository: ["/index", "/search", "/graph", "/context"],
    Config: ["/config", "/doctor", "/version"],
    Providers: ["/providers", "/connect", "/models", "/routing"],
    Agents: ["/agents", "/memory", "/sessions"],
    Dashboard: ["/status", "/overview"],
  },
};

// ── Startup ──────────────────────────────────────────────────────────

export async function startLoom(): Promise<void> {
  const cwd = process.cwd();
  const branch = gitBranch(cwd);
  const { config } = loadConfig(cwd);

  // Build command registry
  const registry = new CommandRegistry();
  registry.registerAll(createCommands());
  const history = new CommandHistory();

  // Override /help to use registry
  registry.register({
    name: "/help",
    description: "Show all commands",
    category: "Core",
    handler: () => printHelp(registry),
  });

  printStartup(cwd, branch, config);
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${G(">")} `,
  });

  // Tab completion
  setupCompletion(rl, registry);

  // Arrow key history
  rl.on("line", (line: string) => {
    history.push(line);
  });

  rl.prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (!input) { rl.prompt(); continue; }

    try {
      if (input.startsWith("/")) {
        await handleSlash(input, cwd, config, branch, rl, registry, history);
      } else {
        await runTask(input, cwd, config);
      }
    } catch (e: any) {
      console.log(`${R("Error:")}: ${e.message || String(e)}`);
    }

    printFooter(cwd, branch, config);
    rl.prompt();
  }
}

// ── Screen printing ──────────────────────────────────────────────────

export function printStartup(cwd: string, branch: string, config: LoomConfig): void {
  console.clear();
  header(cwd, branch, config);
  statusBlocks(cwd);
  quickRef();
}

function header(cwd: string, _branch: string, config: LoomConfig): void {
  const ws = path.basename(cwd);
  const br = gitBranch(cwd);
  const model = briefModel(config);
  const ag = currentAgent;
  console.log(`  ${LOOM}  ${D("v" + PKG_VERSION)}`);
  console.log(`  ${D("\u{1F4C1}")} ${B(ws)}  ${D("\u{1F33F}")} ${G(br)}  ${D("model:")} ${model}  ${D("agent:")} ${M(ag)}`);
  console.log();
}

function briefModel(config: LoomConfig): string {
  try {
    const m = config.models?.coding || config.models?.local || "auto";
    return m;
  } catch {
    return "auto";
  }
}

function statusBlocks(cwd: string): void {
  try {
    const data = gatherDashboardData(cwd);
    const idx = data.indexMetrics;
    console.log(`  ${D("Repository:")}  ${B(String(idx.filesIndexed))} files  ${B(String(idx.symbols))} symbols  ${B(String(idx.dependencies))} deps`);

    const online = data.providers.filter((p) => p.status === "online" || p.status === "models-available").length;
    const total = data.providers.length;
    const provs = data.providers
      .slice(0, 4)
      .map((p) => {
        const ok = p.status === "online" || p.status === "models-available";
        return `${ok ? G(p.name) : D(p.name)}`;
      })
      .join("  ");
    console.log(`  ${D("Providers:")}  ${online}/${total} online  ${D("\u2014")}  ${provs}`);

    const agents = data.agents
      .slice(0, 3)
      .map((a) => {
        const active = a.status === "running";
        return `${active ? G("\u25CF") : D("\u25CB")} ${active ? B(a.name) : a.name}`;
      })
      .join("  ");
    console.log(`  ${D("Agents:")}    ${agents}`);
  } catch {
    console.log(`  ${D("Repository:")}  ${D("(not indexed)")}`);
    console.log(`  ${D("Providers:")}  ${D("checking...")}`);
  }
}

function quickRef(): void {
  console.log();
  console.log(`  ${D("Quick:")}  /help  /index  /providers  /agents  /memory  /status  /search  /connect`);
  console.log(SEP);
}

function printFooter(cwd: string, _branch: string, config: LoomConfig): void {
  const br = gitBranch(cwd);
  const model = briefModel(config);
  console.log();
  console.log(`  ${LOOM}  ${D(path.basename(cwd))}  ${G(br)}  ${D(model)}  ${M(currentAgent)}`);
  console.log(SEP);
}

// ── Slash dispatcher ─────────────────────────────────────────────────

async function handleSlash(
  input: string,
  cwd: string,
  config: LoomConfig,
  branch: string,
  rl: readline.Interface,
  registry: CommandRegistry,
  _history: CommandHistory,
): Promise<void> {
  const parts = input.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");

  const command = registry.resolve(cmd);
  if (command) {
    await command.handler(args, { cwd, config, branch, rl, agent: null });
    return;
  }

  console.log(`  ${R("\u2717")} Unknown: ${cmd}  ${D("Type /help")}`);
}

// ── Task execution ───────────────────────────────────────────────────

async function runTask(prompt: string, cwd: string, config: LoomConfig): Promise<void> {
  console.log();
  try {
    const routing = routeTask(prompt, config);
    console.log(`  ${D("[" + routing.category + "]")} ${C(routing.model)}  ${D("(" + routing.reason + ")")}`);
    const provider = createRoutedProvider(routing, config);

    const layout = workspaceLayout(cwd);
    const registry = buildDefaultRegistry(config);

    const pluginsDir = path.join(cwd, ".loom", "plugins");
    if (fs.existsSync(pluginsDir)) await loadPlugins(pluginsDir, registry);
    const homePlugins = path.join(os.homedir(), ".loom", "plugins");
    if (fs.existsSync(homePlugins)) await loadPlugins(homePlugins, registry);

    const safety = new SafetyGate(config.safety, async (msg) => {
      process.stdout.write(`\n  ${Y("[confirm]")} ${msg} ${D("[y/N]")} `);
      return new Promise((resolve) => {
        process.stdin.once("data", (d) => resolve(/^y(es)?$/i.test(String(d).trim())));
      });
    });

    const workspaceContext = await readWorkspaceContext(cwd);

    const agent = new Agent({
      provider, registry, safety, config, workspaceRoot: cwd, workspaceContext,
    });

    console.log();
    let buffer = "";
    agent.onTyped("stream:delta", (d) => {
      buffer += d;
      process.stdout.write(d);
    });
    agent.onTyped("stream:done", () => {
      process.stdout.write("\n");
      saveSession(cwd, routing.provider, routing.model, prompt, buffer);
    });
    agent.onTyped("tool:call", (c) =>
      console.log(`\n  ${D("\u26A1")} ${B(c.name)}${D("(" + JSON.stringify(c.arguments).slice(0, 80) + ")")}`)
    );
    agent.onTyped("tool:result", (r) => {
      if (r.ok) console.log(`  ${G("\u2713")} ${r.name}`);
      else console.log(`  ${R("\u2717")} ${r.name}: ${r.error}`);
    });

    await agent.run(prompt);
    console.log(`  ${D("Done.")}`);
  } catch (e: any) {
    console.log(`  ${R("\u2717")} ${e.message}`);
  }
}

async function saveSession(
  cwd: string, providerName: string, model: string,
  userPrompt: string, response: string
): Promise<void> {
  try {
    const layout = workspaceLayout(cwd);
    const store = new SessionStore(layout.sessionsDir);
    const session = await store.create({ workspace: cwd, provider: providerName, model });
    await store.update(session.id, [
      { role: "user", content: userPrompt, timestamp: Date.now() },
      { role: "assistant", content: response, timestamp: Date.now() },
    ]);
  } catch {
    // Silent fail on session save
  }
}

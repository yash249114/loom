#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import chalk from "chalk";
import { loadConfig, resolveProvider, writeConfig } from "../config/loader.js";
import { createProvider, createRoutedProvider, ModelDiscovery, ModelCache } from "../providers/factory.js";
import { PROVIDER_ENDPOINTS } from "../providers/capabilities.js";
import { buildDefaultRegistry } from "../tools/index.js";
import {
  initWorkspace,
  readWorkspaceContext,
  workspaceLayout,
} from "../workspace/workspace.js";
import { SessionStore } from "../session/store.js";
import { SafetyGate } from "../safety/gate.js";
import { Agent } from "../agent/agent.js";
import { routeTask } from "../agent/router.js";
import { loadPlugins } from "../plugins/loader.js";
import { logger } from "../core/logger.js";
import { registerIndexCommand } from "../indexer/cli.js";
// import { registerMemoryCommands } from "../memory/cli.js";

const program = new Command();
program
  .name("loom")
  .description("Local AI coding agent CLI")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a Loom workspace in the current directory")
  .action(async () => {
    const root = process.cwd();
    const layout = await initWorkspace(root);
    if (!fs.existsSync(layout.configFile)) {
      const { config } = loadConfig(root);
      writeConfig(layout.configFile, config);
    }
    logger.success(`Initialized .loom/ in ${root}`);
    logger.info(`Edit ${layout.configFile} to configure providers.`);
  });

program
  .command("config")
  .description("Show current resolved configuration")
  .action(() => {
    const { config, path: p } = loadConfig();
    logger.info(`Config source: ${p ?? "(defaults)"}`);
    console.log(JSON.stringify(config, null, 2));
  });

program
  .command("run <prompt...>")
  .description("Run a single prompt non-interactively")
  .option("-p, --provider <name>", "Provider alias")
  .option("-y, --yes", "Auto-confirm all prompts")
  .option("--local", "Force all requests through local Ollama")
  .action(async (promptParts: string[], options) => {
    const prompt = promptParts.join(" ");
    const root = process.cwd();
    const { config } = loadConfig(root);

    // Route the task
    const routing = routeTask(prompt, config, options.local);
    logger.info(`[router] ${routing.category} → ${routing.model} (${routing.reason})`);
    const provider = createRoutedProvider(routing, config);

    const layout = workspaceLayout(root);
    const registry = buildDefaultRegistry(config);
    if (fs.existsSync(layout.pluginsDir)) {
      await loadPlugins(layout.pluginsDir, registry);
    }
    const homePlugins = path.join(os.homedir(), ".loom", "plugins");
    if (fs.existsSync(homePlugins)) await loadPlugins(homePlugins, registry);

    const safety = new SafetyGate(
      config.safety,
      async (msg) => {
        if (options.yes) return true;
        process.stdout.write(chalk.yellow(`\n[confirm] ${msg} [y/N] `));
        return await readYesNo();
      },
      options.yes ?? false
    );

    const workspaceContext = await readWorkspaceContext(root);
    const agent = new Agent({
      provider,
      registry,
      safety,
      config,
      workspaceRoot: root,
      workspaceContext,
      forceLocal: options.local,
    });

    agent.onTyped("stream:delta", (d) => process.stdout.write(d));
    agent.onTyped("stream:done", () => process.stdout.write("\n"));
    agent.onTyped("log", (msg) => logger.info(msg));
    agent.onTyped("tool:call", (c) =>
      logger.info(
        `tool: ${c.name}(${JSON.stringify(c.arguments).slice(0, 120)})`
      )
    );
    agent.onTyped("tool:result", (r) => {
      if (r.ok) logger.success(`✓ ${r.name}`);
      else logger.error(`✗ ${r.name}: ${r.error}`);
    });

    try {
      await agent.run(prompt);
      logger.success("Done.");
    } catch (e: any) {
      logger.error(e.message);
      process.exit(1);
    }
  });

program
  .command("sessions")
  .description("List saved sessions in current workspace")
  .action(async () => {
    const layout = workspaceLayout(process.cwd());
    const store = new SessionStore(layout.sessionsDir);
    const list = await store.list();
    if (!list.length) {
      logger.info("No sessions.");
      return;
    }
    for (const s of list) {
      console.log(
        `${chalk.cyan(s.id)}  ${new Date(s.updatedAt).toISOString()}  ${s.provider}/${s.model}  msgs=${s.messages.length}`
      );
    }
  });

// Default command: prompt-first interface
program
  .command("chat", { isDefault: true })
  .description("Start interactive prompt-first interface (default)")
  .action(async () => {
    try {
      const { startLoom } = await import("../core/loom.js");
      await startLoom();
    } catch (err: any) {
      console.error("Failed to start loom:", err.message);
      console.log("Try: loom \"your task\" -- or use --help for other commands");
    }
  });

// Legacy dashboard (reachable via loom dashboard or /status inside loom)
program
  .command("dashboard")
  .description("Start the ANSI dashboard (legacy)")
  .action(async () => {
    try {
      const { startDashboard } = await import("../index.js");
      startDashboard(process.cwd());
    } catch (err: any) {
      console.error("Failed to start dashboard:", err.message);
    }
  });

// ── Provider Intelligence Commands ────────────────────────────────

program
  .command("providers")
  .description("Discover and validate all configured AI providers")
  .option("-f, --force", "Force re-discovery (skip cache)")
  .option("-k, --key <key>", "API key for validation")
  .action(async (options) => {
    const { config } = loadConfig();
    const discovery = new ModelDiscovery({
      workspaceDir: process.cwd(),
      cacheTtlMs: config.routing.cacheTtlMs,
    });

    logger.info("Discovering providers...\n");

    const results = await discovery.discoverAll(undefined, {
      force: options.force,
    });

    for (const r of results) {
      const icon = r.ok ? chalk.green("✓") : chalk.red("✗");
      const latency = r.latencyMs != null ? ` (${r.latencyMs}ms)` : "";
      const count = r.models ? ` — ${r.models.length} models` : "";
      console.log(`${icon} ${chalk.bold(r.key)}${latency}${count}`);
      if (r.error) console.log(`  ${chalk.red(r.error)}`);
      if (r.endpoint) console.log(`  ${chalk.gray(r.endpoint)}`);
    }
  });

program
  .command("models [provider]")
  .description("List discovered models from a provider (or all)")
  .option("-f, --force", "Force re-discovery")
  .option("-k, --key <key>", "API key")
  .option("--mode <mode>", "Filter by mode (low/medium/high/very-high/max/ultra)")
  .option("--min-capability <n>", "Minimum capability score (1-10)", "5")
  .option("--json", "Output as JSON")
  .action(async (providerArg, options) => {
    const { config } = loadConfig();
    const discovery = new ModelDiscovery({
      workspaceDir: process.cwd(),
      cacheTtlMs: config.routing.cacheTtlMs,
    });

    const providers = providerArg
      ? [providerArg]
      : ["openrouter", "gemini", "groq", "openai", "anthropic", "ollama"];

    const allModels: any[] = [];
    const modeFilter = options.mode?.toLowerCase();
    const minCap = parseInt(options.minCapability, 10);

    for (const p of providers) {
      const result = await discovery.discoverProvider(
        p as any,
        options.key,
        { force: options.force }
      );
      if (!result.ok) {
        logger.warn(`${p}: ${result.error}`);
        continue;
      }
      if (!result.models) continue;

      let models = result.models;

      if (modeFilter) {
        models = models.filter((m) => m.mode === modeFilter);
      }
      if (minCap > 0) {
        models = models.filter(
          (m) =>
            m.capabilities.coding >= minCap ||
            m.capabilities.reasoning >= minCap ||
            m.capabilities.general >= minCap
        );
      }

      models.sort((a, b) => b.contextWindow - a.contextWindow);

      allModels.push(
        ...models.map((m) => ({
          provider: p,
          id: m.id,
          mode: m.mode,
          ctx: m.contextWindow,
          coding: m.capabilities.coding,
          reasoning: m.capabilities.reasoning,
          general: m.capabilities.general,
          vision: m.capabilities.vision,
          tools: m.capabilities.toolCalls,
        }))
      );
    }

    if (options.json) {
      console.log(JSON.stringify(allModels, null, 2));
      return;
    }

    if (!allModels.length) {
      logger.info("No models found.");
      return;
    }

    console.log(`\n${chalk.bold("Available Models:")} (${allModels.length} total)\n`);
    console.log(
      chalk.gray(
        `${"PROVIDER".padEnd(12)} ${"MODE".padEnd(10)} ${"CTX".padEnd(8)} C  R  G  V  T  MODEL`
      )
    );
    console.log(chalk.gray("─".repeat(80)));

    for (const m of allModels) {
      const modeColor =
        m.mode === "ultra" || m.mode === "max" ? chalk.red :
        m.mode === "very-high" || m.mode === "high" ? chalk.yellow :
        chalk.green;
      console.log(
        `${m.provider.padEnd(12)} ${modeColor(m.mode.padEnd(10))} ${String(m.ctx).padEnd(8)} ${m.coding}  ${m.reasoning}  ${m.general}  ${m.vision ? "✓" : " "}  ${m.tools ? "✓" : " "}  ${m.id.slice(0, 40)}`
      );
    }
  });

program
  .command("doctor")
  .description("Check your full setup and discover providers")
  .option("-f, --force", "Force re-discovery")
  .action(async (options) => {
    const { config, path: cfgPath } = loadConfig();
    const discovery = new ModelDiscovery({
      workspaceDir: process.cwd(),
      cacheTtlMs: config.routing.cacheTtlMs,
    });

    console.log(chalk.cyan.bold("\n⌬ Loom Doctor\n"));
    console.log(`${chalk.gray("Config:")}  ${cfgPath ?? "(defaults)"}`);
    console.log(`${chalk.gray("Provider:")} ${config.defaultProvider}\n`);

    logger.info("Checking providers...\n");
    const results = await discovery.discoverAll(undefined, {
      force: options.force,
    });

    let allOk = true;
    for (const r of results) {
      const icon = r.ok ? chalk.green("✓") : chalk.red("✗");
      const detail = r.ok
        ? `${r.models?.length ?? 0} models`
        : r.error;
      console.log(` ${icon} ${chalk.bold(r.key)}  ${chalk.gray(detail)}`);
      if (!r.ok) allOk = false;
    }

    console.log();
    if (allOk) {
      logger.success("All providers reachable. Loom is ready.");
    } else {
      logger.warn("Some providers are unreachable. Check your API keys and endpoints.");
    }
  });

registerIndexCommand(program);

// ── Memory Commands ────────────────────────────────────────────────

program
  .command("memory")
  .description("Manage workspace memory (notes and summaries)")
  .option("-a, --add <note>", "Add a note to memory")
  .option("-s, --summary <text>", "Add a summary to memory")
  .option("-l, --list", "List all memory entries")
  .option("-c, --clear", "Clear all memory")
  .action(async (options) => {
    const { MemoryStore } = await import("../memory/store.js");
    const layout = workspaceLayout(process.cwd());
    const store = new MemoryStore(layout.memoryFile);

    if (options.add) {
      await store.addNote(options.add);
      logger.success(`Added note: ${options.add.slice(0, 50)}${options.add.length > 50 ? "..." : ""}`);
    } else if (options.summary) {
      await store.addSummary(options.summary);
      logger.success(`Added summary: ${options.summary.slice(0, 50)}${options.summary.length > 50 ? "..." : ""}`);
    } else if (options.clear) {
      await store.write({ notes: [], summaries: [] });
      logger.success("Memory cleared.");
    } else {
      // Default: list
      const doc = await store.read();
      if (doc.notes.length === 0 && doc.summaries.length === 0) {
        logger.info("No memory entries.");
        return;
      }
      if (doc.notes.length > 0) {
        console.log(chalk.bold("\nNotes:"));
        doc.notes.forEach((n, i) => console.log(`  ${i + 1}. ${n}`));
      }
      if (doc.summaries.length > 0) {
        console.log(chalk.bold("\nSummaries:"));
        doc.summaries.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));
      }
    }
  });

// ── MCP Commands ───────────────────────────────────────────────────

program
  .command("mcp")
  .description("Manage MCP (Model Context Protocol) servers")
  .option("-l, --list", "List configured MCP servers")
  .option("-a, --add <name>", "Add an MCP server")
  .option("-r, --remove <name>", "Remove an MCP server")
  .option("--start", "Start MCP server")
  .option("--stop", "Stop MCP server")
  .action(async (options) => {
    const { loadConfig, writeConfig: writeConfigFile } = await import("../config/loader.js");
    const { config, path: cfgPath } = loadConfig();

    // Initialize mcpServers if not present
    if (!config.mcpServers) {
      (config as any).mcpServers = {};
    }
    const mcpServers = (config as any).mcpServers as Record<string, { command: string; args?: string[] }>;

    if (options.list || (!options.add && !options.remove && !options.start && !options.stop)) {
      const servers = Object.entries(mcpServers);
      if (servers.length === 0) {
        logger.info("No MCP servers configured.");
        console.log("\nAdd a server with: loom mcp --add <name>");
        console.log("Example: loom mcp --add filesystem --command npx --args @modelcontextprotocol/server-filesystem");
        return;
      }
      console.log(chalk.bold("\nMCP Servers:\n"));
      for (const [name, server] of servers) {
        console.log(`  ${chalk.cyan(name)}: ${server.command} ${(server.args || []).join(" ")}`);
      }
    } else if (options.add) {
      const name = options.add;
      const command = options.command || "npx";
      const args = options.args ? options.args.split(" ") : [];
      mcpServers[name] = { command, args };
      if (cfgPath) {
        writeConfigFile(cfgPath, config);
      }
      logger.success(`Added MCP server: ${name}`);
    } else if (options.remove) {
      if (mcpServers[options.remove]) {
        delete mcpServers[options.remove];
        if (cfgPath) {
          writeConfigFile(cfgPath, config);
        }
        logger.success(`Removed MCP server: ${options.remove}`);
      } else {
        logger.error(`MCP server '${options.remove}' not found.`);
      }
    } else if (options.start || options.stop) {
      logger.info("MCP server management requires a running Loom session.");
      console.log("Use 'loom chat' to start a session with MCP support.");
    }
  });

program.parseAsync(process.argv).catch((e) => {
  if (e.code === "commander.helpDisplayed" || e.exitCode === 0) return;
  if (e.message?.includes("SIGINT") || e.name === "AbortError") {
    process.exit(0);
  }
  logger.error(e?.message ?? String(e));
  process.exit(1);
});

process.on("SIGINT", () => {
  process.exit(0);
});

async function readYesNo(): Promise<boolean> {
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", (d) => {
      process.stdin.pause();
      resolve(/^y(es)?$/i.test(String(d).trim()));
    });
  });
}

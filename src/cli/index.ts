#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import chalk from "chalk";
import { loadConfig, resolveProvider, writeConfig } from "../config/loader.js";
import { createProvider, createRoutedProvider } from "../providers/factory.js";
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
import { startTUI } from "../tui/app.js";
import { logger } from "../core/logger.js";

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

// Default command: interactive TUI
program
  .command("chat", { isDefault: true })
  .description("Start interactive TUI chat (default)")
  .option("-p, --provider <name>", "Provider alias")
  .option("-s, --session <id>", "Resume session by ID")
  .option("--local", "Force all requests through local Ollama")
  .action(async (options) => {
    await startTUI({
      providerName: options.provider,
      sessionId: options.session,
      forceLocal: options.local,
    });
  });

program.parseAsync(process.argv).catch((e) => {
  logger.error(e?.message ?? String(e));
  process.exit(1);
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

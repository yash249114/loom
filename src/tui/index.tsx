import React from "react";
import { render } from "ink";
import { LoomWorkspace } from "./app.js";
import { StateManager } from "../core/state.js";
import { ThemeManager } from "../theme/index.js";
import { EventBus, Events } from "../core/events.js";
import { SecurityService } from "../services/security.js";
import { Renderer } from "../core/renderer.js";
import { InputHandler } from "../core/input.js";
import { MemoryPipeline } from "../memory/pipeline.js";
import { loadConfig, resolveProvider } from "../config/loader.js";
import { createRoutedProvider } from "../providers/factory.js";
import { buildDefaultRegistry } from "../tools/index.js";
import { SafetyGate } from "../safety/gate.js";
import { Agent } from "../agent/agent.js";
import { routeTask } from "../agent/router.js";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadPlugins } from "../plugins/loader.js";

export interface TuiOptions {
  providerName?: string;
  sessionId?: string;
  forceLocal?: boolean;
}

export async function startTUI(opts: TuiOptions = {}): Promise<void> {
  const events = new EventBus();
  const themeManager = new ThemeManager();
  const stateManager = new StateManager();
  const security = new SecurityService();

  const renderer = new Renderer(themeManager.getColors());
  const input = new InputHandler(events, stateManager);

  events.on(Events.THEME_CHANGE, (themeId: string) => {
    themeManager.setTheme(themeId);
    renderer.updateTheme(themeManager.getColors());
  });

  const root = process.cwd();
  const { config } = loadConfig(root);

  const { key: providerKey, cfg: providerCfg } = resolveProvider(config, opts.providerName);
  const provider = createRoutedProvider(
    routeTask("hello", config, opts.forceLocal),
    config
  );

  const registry = buildDefaultRegistry(config);
  const pluginsDir = path.join(root, ".loom", "plugins");
  if (fs.existsSync(pluginsDir)) {
    await loadPlugins(pluginsDir, registry);
  }
  const homePlugins = path.join(os.homedir(), ".loom", "plugins");
  if (fs.existsSync(homePlugins)) {
    await loadPlugins(homePlugins, registry);
  }

  const safety = new SafetyGate(
    config.safety,
    async (msg) => {
      process.stdout.write(`\n[confirm] ${msg} [y/N] `);
      return await new Promise((resolve) => {
        process.stdin.resume();
        process.stdin.setEncoding("utf8");
        process.stdin.once("data", (d) => {
          process.stdin.pause();
          resolve(/^y(es)?$/i.test(String(d).trim()));
        });
      });
    },
    false
  );

  const agent = new Agent({
    provider,
    registry,
    safety,
    config,
    workspaceRoot: root,
    forceLocal: opts.forceLocal,
  });

  agent.onTyped("stream:delta", (delta: string) => {
    const current = stateManager.getState();
    const lastMsg = current.chatHistory[current.chatHistory.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && !lastMsg.id) {
      stateManager.setState({
        chatHistory: [
          ...current.chatHistory.slice(0, -1),
          { ...lastMsg, content: lastMsg.content + delta },
        ],
      });
    } else {
      stateManager.addMessage({
        role: "assistant",
        content: delta,
        model: providerCfg.model,
      });
    }
  });

  agent.onTyped("stream:done", () => {
    stateManager.setState({ isLoading: false });
  });

  agent.onTyped("tool:call", (call) => {
    stateManager.addToast({ message: `Tool: ${call.name}`, type: "info", duration: 3000 });
  });

  agent.onTyped("tool:result", (result) => {
    if (!result.ok) {
      stateManager.addToast({ message: `Tool error: ${result.name}: ${result.error}`, type: "error", duration: 5000 });
    }
  });

  events.on(Events.MESSAGE_SEND, async (content: string) => {
    stateManager.addMessage({ role: "user", content });
    stateManager.setState({ isLoading: true });

    try {
      await agent.run(content);
    } catch (e: any) {
      stateManager.addToast({ message: `Error: ${e.message}`, type: "error", duration: 5000 });
      stateManager.setState({ isLoading: false });
    }
  });

  events.on("modal:confirm", (_allowed: boolean) => {});

  const pipeline = new MemoryPipeline({
    rootDir: root,
    verbose: false,
    eventBus: events,
  });

  try {
    await pipeline.init();
  } catch {
    // pipeline init failed silently — dashboard will show empty stats
  }

  const { waitUntilExit } = render(
    React.createElement(LoomWorkspace, {
      stateManager,
      themeManager,
      eventBus: events,
      intelligence: pipeline.intelligence,
    })
  );

  input.start();

  return waitUntilExit();
}

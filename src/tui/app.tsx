import React from "react";
import { render } from "ink";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { loadConfig, resolveProvider } from "../config/loader.js";
import { createProvider } from "../providers/factory.js";
import { buildDefaultRegistry } from "../tools/index.js";
import {
  initWorkspace,
  readWorkspaceContext,
  workspaceLayout,
} from "../workspace/workspace.js";
import { SessionStore } from "../session/store.js";
import { loadPlugins } from "../plugins/loader.js";
import { ChatApp } from "./ChatApp.js";

export interface TUIOptions {
  providerName?: string;
  sessionId?: string;
  forceLocal?: boolean;
}

export async function startTUI(opts: TUIOptions): Promise<void> {
  // Ink requires an interactive TTY for raw mode input.
  // Provide a clear error when running in piped/non-interactive environments.
  if (!process.stdin.isTTY) {
    console.error(
      [
        "✗ Loom TUI requires an interactive terminal (TTY).",
        "  Run directly in your terminal: pnpm dev",
        "  For non-interactive use: pnpm dev run \"<your prompt>\"",
      ].join("\n")
    );
    process.exit(1);
  }

  const root = process.cwd();
  const layout = workspaceLayout(root);
  if (!fs.existsSync(layout.loomDir)) await initWorkspace(root);

  const { config } = loadConfig(root);
  const { key, cfg } = resolveProvider(config, opts.providerName);
  const provider = createProvider(key, cfg);

  const registry = buildDefaultRegistry(config);
  if (fs.existsSync(layout.pluginsDir))
    await loadPlugins(layout.pluginsDir, registry);
  const homePlugins = path.join(os.homedir(), ".loom", "plugins");
  if (fs.existsSync(homePlugins)) await loadPlugins(homePlugins, registry);

  const sessions = new SessionStore(layout.sessionsDir);
  const session = opts.sessionId
    ? await sessions.get(opts.sessionId)
    : await sessions.create({
        workspace: root,
        provider: key,
        model: provider.model,
      });

  if (!session) {
    console.error(`Session ${opts.sessionId} not found`);
    process.exit(1);
  }

  const workspaceContext = await readWorkspaceContext(root);

  const { waitUntilExit } = render(
    <ChatApp
      config={config}
      provider={provider}
      providerKey={key}
      registry={registry}
      sessions={sessions}
      session={session}
      workspaceRoot={root}
      workspaceContext={workspaceContext}
      forceLocal={opts.forceLocal}
    />
  );
  await waitUntilExit();
}

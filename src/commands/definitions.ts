import type { Command } from "./types.js";
import {
  handleClear, handleQuit, handleVersion, handleConfig, handleTheme, handleDoctor,
  handleInit, handleIndex, handleGraph, handleContext, handleSearch, handleRepo,
  handleMemory, handleAgents, handleAgent,
  handleProviders, handleModels, handleRouting,
  handleSessions, handleMcp, handleStatus,
} from "./handlers.js";

export function createCommands(): Command[] {
  return [
    // Core
    { name: "/help", description: "Show all commands", category: "Core", handler: () => {} },
    { name: "/clear", description: "Clear screen", category: "Core", handler: handleClear },
    { name: "/quit", description: "Exit Loom", category: "Core", handler: handleQuit, aliases: ["/exit"] },
    { name: "/version", description: "Show version", category: "Core", handler: handleVersion },
    { name: "/config", description: "Show configuration", category: "Core", handler: handleConfig },
    { name: "/doctor", description: "Run diagnostics", category: "Core", handler: handleDoctor },
    { name: "/theme", description: "Manage themes", category: "Core", handler: handleTheme, usage: "[list|<name>]" },

    // Repository
    { name: "/init", description: "Initialize workspace", category: "Repository", handler: handleInit },
    { name: "/index", description: "Build intelligence index", category: "Repository", handler: handleIndex },
    { name: "/search", description: "Search symbols/files", category: "Repository", handler: handleSearch, usage: "<query>" },
    { name: "/graph", description: "Show dependency graph", category: "Repository", handler: handleGraph },
    { name: "/context", description: "Show context engine", category: "Repository", handler: handleContext },
    { name: "/repo", description: "Repository overview", category: "Repository", handler: handleRepo },

    // Providers
    { name: "/providers", description: "List providers", category: "Providers", handler: handleProviders, aliases: ["/connect"] },
    { name: "/models", description: "List models", category: "Providers", handler: handleModels, aliases: ["/model"] },
    { name: "/routing", description: "Configure routing", category: "Providers", handler: handleRouting },

    // Agents
    { name: "/agents", description: "List/switch agents", category: "Agents", handler: handleAgents },
    { name: "/agent", description: "Agent commands", category: "Agents", handler: handleAgent, usage: "[status|switch <mode>|mode]" },
    { name: "/memory", description: "Memory management", category: "Agents", handler: handleMemory, usage: "[list|search <q>|add <note>|clear]" },

    // Sessions
    { name: "/sessions", description: "Session management", category: "Sessions", handler: handleSessions, aliases: ["/session"], usage: "[list|new|load <id>|delete <id>]" },
    { name: "/mcp", description: "MCP server management", category: "Sessions", handler: handleMcp, usage: "[list|status]" },

    // Dashboard
    { name: "/status", description: "Dashboard view", category: "Dashboard", handler: handleStatus, aliases: ["/overview"] },
  ];
}

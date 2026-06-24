import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { useApp } from "./AppContext.js";

interface SlashOption {
  id: string;
  label: string;
  description: string;
  category: "Agents" | "Providers" | "Workspace" | "Sessions" | "Advanced";
  action: string;
  payload?: string;
}

const SLASH_OPTIONS: SlashOption[] = [
  // Agents
  { id: "plan", label: "/agent plan", description: "Strategic planning mode", category: "Agents", action: "SET_AGENT", payload: "plan" },
  { id: "build", label: "/agent build", description: "Implementation mode", category: "Agents", action: "SET_AGENT", payload: "build" },
  { id: "review", label: "/agent review", description: "Code review mode", category: "Agents", action: "SET_AGENT", payload: "review" },
  { id: "debug", label: "/agent debug", description: "Debugging mode", category: "Agents", action: "SET_AGENT", payload: "debug" },
  { id: "research", label: "/agent research", description: "Research mode", category: "Agents", action: "SET_AGENT", payload: "research" },
  { id: "test", label: "/agent test", description: "Test writing mode", category: "Agents", action: "SET_AGENT", payload: "test" },

  // Providers
  { id: "providers", label: "/providers", description: "View connected providers", category: "Providers", action: "SET_VIEW", payload: "connect" },
  { id: "models", label: "/models", description: "Browse available models", category: "Providers", action: "SET_VIEW", payload: "connect" },
  { id: "connect", label: "/connect", description: "Manage provider connections", category: "Providers", action: "SET_VIEW", payload: "connect" },

  // Workspace
  { id: "index", label: "/index", description: "Re-index workspace symbols", category: "Workspace", action: "SET_VIEW", payload: "repository" },
  { id: "graph", label: "/graph", description: "View dependency graph", category: "Workspace", action: "SET_VIEW", payload: "repository" },
  { id: "status", label: "/status", description: "Workspace health overview", category: "Workspace", action: "SET_VIEW", payload: "status" },
  { id: "memory", label: "/memory", description: "View workspace memory", category: "Workspace", action: "SET_VIEW", payload: "memory" },

  // Sessions
  { id: "sessions", label: "/sessions", description: "List saved sessions", category: "Sessions", action: "SET_VIEW", payload: "sessions" },
  { id: "save", label: "/save", description: "Save current conversation", category: "Sessions", action: "SEND_MESSAGE", payload: "/save" },

  // Advanced
  { id: "mcp", label: "/mcp", description: "Manage MCP servers", category: "Advanced", action: "SET_VIEW", payload: "mcps" },
  { id: "clear", label: "/clear", description: "Clear chat history", category: "Advanced", action: "SEND_MESSAGE", payload: "/clear" },
  { id: "help", label: "/help", description: "Show all commands", category: "Advanced", action: "SEND_MESSAGE", payload: "/help" },
  { id: "exit", label: "/exit", description: "Quit Loom", category: "Advanced", action: "SEND_MESSAGE", payload: "/exit" },
];

const CATEGORY_ORDER: string[] = ["Agents", "Providers", "Workspace", "Sessions", "Advanced"];

export function SlashPopup({ query, onSelect, onClose }: { query: string; onSelect: (action: string, payload?: string) => void; onClose: () => void }) {
  const { theme } = useApp();
  const [selected, setSelected] = useState(0);

  const filtered = query
    ? SLASH_OPTIONS.filter((o) => o.label.includes(query.toLowerCase()) || o.description.toLowerCase().includes(query.toLowerCase()))
    : SLASH_OPTIONS;

  const categorized = CATEGORY_ORDER
    .map((cat) => ({ category: cat, items: filtered.filter((o) => o.category === cat) }))
    .filter((g) => g.items.length > 0);

  useEffect(() => { setSelected(0); }, [query]);

  useInput((_input, key) => {
    if (key.escape) { onClose(); return; }
    if (key.upArrow) { setSelected(Math.max(0, selected - 1)); return; }
    if (key.downArrow) { setSelected(Math.min(filtered.length - 1, selected + 1)); return; }
    if (key.return && filtered[selected]) {
      onSelect(filtered[selected].action, filtered[selected].payload);
      onClose();
    }
  });

  let idx = -1;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent.primary} marginTop={1}>
      {categorized.map((group) => (
        <Box key={group.category} flexDirection="column">
          <Box paddingX={1} height={1}>
            <Text color={theme.accent.secondary} bold>{group.category}</Text>
          </Box>
          {group.items.map((item) => {
            idx++;
            const isSelected = idx === selected;
            return (
              <Box key={item.id} height={1} paddingX={1}>
                <Text
                  color={isSelected ? theme.accent.primary : theme.text.primary}
                  bold={isSelected}
                >
                  {isSelected ? "▸ " : "  "}{item.label}
                </Text>
                <Text color={theme.text.tertiary}>  — {item.description}</Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

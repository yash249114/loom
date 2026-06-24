import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { useApp } from "./AppContext.js";

const ALL_ACTIONS = [
  // Views
  { id: "chat", label: "Switch to Chat", category: "Views", action: "SET_VIEW" as const, payload: "chat" as const },
  { id: "sessions", label: "Switch to Sessions", category: "Views", action: "SET_VIEW" as const, payload: "sessions" as const },
  { id: "memory", label: "Switch to Memory", category: "Views", action: "SET_VIEW" as const, payload: "memory" as const },
  { id: "connect", label: "Switch to Providers", category: "Views", action: "SET_VIEW" as const, payload: "connect" as const },
  { id: "mcps", label: "Switch to MCPs", category: "Views", action: "SET_VIEW" as const, payload: "mcps" as const },
  { id: "status", label: "Switch to Status", category: "Views", action: "SET_VIEW" as const, payload: "status" as const },
  { id: "settings", label: "Switch to Settings", category: "Views", action: "SET_VIEW" as const, payload: "settings" as const },

  // Agents
  { id: "plan", label: "Set Agent: Plan", category: "Agents", action: "SET_AGENT" as const, payload: "plan" as const },
  { id: "build", label: "Set Agent: Build", category: "Agents", action: "SET_AGENT" as const, payload: "build" as const },
  { id: "review", label: "Set Agent: Review", category: "Agents", action: "SET_AGENT" as const, payload: "review" as const },
  { id: "debug", label: "Set Agent: Debug", category: "Agents", action: "SET_AGENT" as const, payload: "debug" as const },
  { id: "research", label: "Set Agent: Research", category: "Agents", action: "SET_AGENT" as const, payload: "research" as const },
  { id: "test", label: "Set Agent: Test", category: "Agents", action: "SET_AGENT" as const, payload: "test" as const },

  // Slash commands
  { id: "/help", label: "/help — Show all commands", category: "Commands", action: "SEND_MESSAGE" as const, payload: "/help" as const },
  { id: "/clear", label: "/clear — Clear chat", category: "Commands", action: "SEND_MESSAGE" as const, payload: "/clear" as const },
  { id: "/status", label: "/status — Workspace health", category: "Commands", action: "SEND_MESSAGE" as const, payload: "/status" as const },
  { id: "/sessions", label: "/sessions — List sessions", category: "Commands", action: "SEND_MESSAGE" as const, payload: "/sessions" as const },

  // Themes
  { id: "midnight", label: "Theme: Midnight", category: "Themes", action: "SET_THEME" as const, payload: "midnight" as const },
  { id: "nord", label: "Theme: Nord", category: "Themes", action: "SET_THEME" as const, payload: "nord" as const },
  { id: "catppuccin", label: "Theme: Catppuccin", category: "Themes", action: "SET_THEME" as const, payload: "catppuccin" as const },
  { id: "tokyo-night", label: "Theme: Tokyo Night", category: "Themes", action: "SET_THEME" as const, payload: "tokyo-night" as const },
  { id: "cyberpunk", label: "Theme: Cyberpunk", category: "Themes", action: "SET_THEME" as const, payload: "cyberpunk" as const },
  { id: "matrix", label: "Theme: Matrix", category: "Themes", action: "SET_THEME" as const, payload: "matrix" as const },
];

const CATEGORY_ORDER = ["Views", "Agents", "Commands", "Themes"];

export function CommandPalette() {
  const { state, theme, dispatch, togglePalette } = useApp();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);

  const filtered = query
    ? ALL_ACTIONS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : ALL_ACTIONS;

  const categorized = CATEGORY_ORDER
    .map((cat) => ({ category: cat, items: filtered.filter((c) => c.category === cat).slice(0, 8) }))
    .filter((g) => g.items.length > 0);

  useEffect(() => { setSelected(0); }, [query]);

  useInput((input, key) => {
    if (!state.commandPaletteOpen) return;
    if (key.escape) { togglePalette(); return; }
    if (key.return && filtered[selected]) {
      const cmd = filtered[selected];
      if (cmd.action === "SET_VIEW") dispatch({ type: "SET_VIEW", view: cmd.payload as any });
      else if (cmd.action === "SET_AGENT") dispatch({ type: "SET_AGENT", agent: cmd.payload as any });
      else if (cmd.action === "SET_THEME") dispatch({ type: "SET_THEME", themeId: cmd.payload as string });
      else if (cmd.action === "SEND_MESSAGE") dispatch({ type: "SEND_MESSAGE", content: cmd.payload as string });
      togglePalette();
      return;
    }
    if (key.upArrow) { setSelected(Math.max(0, selected - 1)); return; }
    if (key.downArrow) { setSelected(Math.min(filtered.length - 1, selected + 1)); return; }
    if (key.backspace || key.delete) { setQuery((q) => q.slice(0, -1)); return; }
    if (input && !key.ctrl && !key.meta && input.length === 1) { setQuery((q) => q + input); }
  });

  if (!state.commandPaletteOpen) return null;

  let idx = -1;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent.primary} marginTop={1}>
      <Box paddingX={1}>
        <Text color={theme.text.primary}>🔍 {query || "Search commands, agents, themes..."}</Text>
      </Box>
      {categorized.map((group) => (
        <Box key={group.category} flexDirection="column" paddingX={1}>
          <Text color={theme.accent.secondary} bold>{group.category}</Text>
          {group.items.map((cmd) => {
            idx++;
            const isSelected = idx === selected;
            return (
              <Box key={cmd.id} height={1}>
                <Text
                  color={isSelected ? theme.accent.primary : theme.text.secondary}
                  bold={isSelected}
                >
                  {isSelected ? "▸ " : "  "}{cmd.label}
                </Text>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

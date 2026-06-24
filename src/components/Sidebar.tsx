import React from "react";
import { Box, Text } from "ink";
import { useApp } from "./AppContext.js";

const NAV_ITEMS: { id: string; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "💬" },
  { id: "agents", label: "Agents", icon: "🤖" },
  { id: "repository", label: "Repository", icon: "📁" },
  { id: "memory", label: "Memory", icon: "🧠" },
  { id: "sessions", label: "Sessions", icon: "📋" },
  { id: "skills", label: "Skills", icon: "🛠" },
  { id: "mcps", label: "MCPs", icon: "🔌" },
  { id: "connect", label: "Connect", icon: "🔗" },
  { id: "status", label: "Status", icon: "📊" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const { state, theme, setView } = useApp();
  const collapsed = state.sidebarCollapsed;
  const w = collapsed ? 5 : 22;

  return (
    <Box
      width={w}
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.border.default}
    >
      {NAV_ITEMS.map((item) => {
        const active = state.currentView === item.id;
        return (
          <Box key={item.id} height={1}>
            <Text
              color={active ? theme.accent.primary : theme.text.secondary}
              backgroundColor={active ? theme.background.tertiary : undefined}
              bold={active}
            >
              {collapsed
                ? ` ${item.icon}`
                : ` ${item.icon} ${item.label.padEnd(16)}`}
            </Text>
          </Box>
        );
      })}
      <Box flexGrow={1} />
      <Box height={1}>
        <Text color={theme.text.tertiary}>
          {collapsed ? " ≡" : " Ctrl+B toggle"}
        </Text>
      </Box>
    </Box>
  );
}

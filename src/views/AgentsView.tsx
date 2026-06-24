import React from "react";
import { Box, Text } from "ink";
import { useApp } from "../components/AppContext.js";
import type { AgentMode } from "../core/types.js";

const AGENTS: { id: AgentMode; label: string; desc: string; icon: string }[] = [
  { id: "plan", label: "Plan", desc: "Architecture & design", icon: "📐" },
  { id: "build", label: "Build", desc: "Implementation", icon: "⚡" },
  { id: "review", label: "Review", desc: "Code review & QA", icon: "🔍" },
  { id: "debug", label: "Debug", desc: "Bug fixing", icon: "🐛" },
  { id: "research", label: "Research", desc: "Codebase exploration", icon: "🔬" },
  { id: "test", label: "Test", desc: "Test generation", icon: "🧪" },
];

export function AgentsView() {
  const { state, theme, setAgent } = useApp();

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box height={1}>
        <Text color={theme.accent.primary} bold>Agent Modes</Text>
      </Box>
      <Box
        flexGrow={1}
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.default}
        padding={1}
        marginTop={1}
      >
        {AGENTS.map((a) => {
          const active = state.currentAgent === a.id;
          return (
            <Box key={a.id} height={3} paddingLeft={1} marginBottom={1}>
              <Text>
                <Text color={active ? theme.accent.primary : theme.text.secondary}>
                  {a.icon}
                </Text>
                <Text> </Text>
                <Text color={active ? theme.accent.primary : theme.text.primary} bold={active}>
                  {a.label}
                </Text>
                <Text> — </Text>
                <Text color={theme.text.secondary}>{a.desc}</Text>
                {active && (
                  <Text>
                    <Text> </Text>
                    <Text color={theme.status.success}>● active</Text>
                  </Text>
                )}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

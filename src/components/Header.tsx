import React from "react";
import { Box, Text } from "ink";
import { useApp } from "./AppContext.js";

export function Header() {
  const { state, theme } = useApp();
  const dir = state.cwd.split(/[/\\]/).pop() || state.cwd;
  const header = `  ⌬ Loom  ${dir}  `;
  const agentLabels: Record<string, string> = {
    plan: "Plan", build: "Build", review: "Review",
    debug: "Debug", research: "Research", test: "Test",
  };

  return (
    <Box width="100%" height={1}>
      <Text backgroundColor={theme.background.secondary} color={theme.accent.primary} bold>
        {header.padEnd(state.terminalWidth - 1)}
      </Text>
    </Box>
  );
}

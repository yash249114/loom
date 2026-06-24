import React from "react";
import { Box, Text } from "ink";
import { useApp } from "./AppContext.js";

export function StatusBar() {
  const { state, theme } = useApp();

  return (
    <Box width="100%" height={1} borderStyle="single" borderColor={theme.border.default}>
      <Text backgroundColor={theme.background.secondary} color={theme.text.tertiary}>
        {state.provider
          ? `${state.provider.name}/${state.selectedModel?.id ?? "—"}`
          : "No provider"}{"  "}
        {state.terminalWidth}x{state.terminalHeight}{"  "}
        {state.isLoading ? "⏳ working..." : "● idle"}{"  "}
        Ctrl+K palette
      </Text>
    </Box>
  );
}

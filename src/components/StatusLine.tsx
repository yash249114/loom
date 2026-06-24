import React from "react";
import { Box, Text } from "ink";
import { useApp } from "./AppContext.js";

export function StatusLine() {
  const { state, theme } = useApp();

  const agentLabels: Record<string, string> = {
    plan: "Plan", build: "Build", review: "Review",
    debug: "Debug", research: "Research", test: "Test",
  };

  const agent = agentLabels[state.currentAgent] || "Build";
  const model = state.selectedModel?.id || "—";
  const msgCount = state.chatHistory.length;
  const providerName = state.provider?.name || "—";

  return (
    <Box width="100%" height={1} borderStyle="single" borderColor={theme.border.default}>
      <Box marginLeft={1}>
        <Text color={theme.accent.primary}>{agent}</Text>
        <Text color={theme.text.tertiary}> | </Text>
        <Text color={theme.text.primary}>{model}</Text>
        <Text color={theme.text.tertiary}> | </Text>
        <Text color={theme.status.info}>{msgCount} messages</Text>
        <Text color={theme.text.tertiary}> | </Text>
        <Text color={theme.text.secondary}>{providerName}</Text>
        {state.isLoading && (
          <>
            <Text color={theme.text.tertiary}> | </Text>
            <Text color={theme.status.warning}>⏳ working...</Text>
          </>
        )}
      </Box>
      <Text color={theme.text.tertiary}>  Ctrl+K palette</Text>
    </Box>
  );
}

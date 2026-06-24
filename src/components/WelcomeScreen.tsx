import React from "react";
import { Box, Text } from "ink";
import { useApp } from "./AppContext.js";

const EXAMPLE_PROMPTS = [
  "Explain the codebase structure",
  "Find and fix the auth bug",
  "Add a payment system endpoint",
  "Create unit tests for the router",
  "Review the security of our API",
];

export function WelcomeScreen() {
  const { state, theme, setAgent } = useApp();

  const providerCount = 6;
  const fileCount = 156;
  const agentLabels: Record<string, string> = {
    plan: "Plan", build: "Build", review: "Review",
    debug: "Debug", research: "Research", test: "Test",
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Logo / Title */}
      <Box marginBottom={1}>
        <Text color={theme.accent.primary} bold>⌬ Loom</Text>
        <Text color={theme.text.tertiary}>  — {state.cwd}</Text>
      </Box>

      {/* Info row: workspace, branch, providers, agent */}
      <Box flexDirection="row" marginBottom={1}>
        <Box marginRight={2}>
          <Text color={theme.text.secondary}>Workspace </Text>
          <Text color={theme.text.primary}>{state.cwd.split(/[/\\]/).pop()}</Text>
        </Box>
        <Box marginRight={2}>
          <Text color={theme.text.secondary}>Branch </Text>
          <Text color={theme.status.info}>{state.gitBranch}</Text>
        </Box>
        <Box marginRight={2}>
          <Text color={theme.text.secondary}>Providers </Text>
          <Text color={state.selectedModel ? theme.status.success : theme.status.warning}>
            {providerCount} configured
          </Text>
        </Box>
        <Box>
          <Text color={theme.text.secondary}>Agent </Text>
          <Text color={theme.accent.primary}>{agentLabels[state.currentAgent] || "Build"}</Text>
        </Box>
      </Box>

      {/* Files count / quick stats */}
      <Box marginBottom={1}>
        <Text color={theme.text.tertiary}>
          {fileCount} files indexed  ·  /help for commands  ·  Ctrl+K for palette
        </Text>
      </Box>

      {/* Separator */}
      <Text color={theme.border.default}>{"─".repeat(Math.min(50, state.terminalWidth - 2))}</Text>

      {/* Example prompts */}
      <Box marginTop={1} marginBottom={1}>
        <Text color={theme.text.secondary} bold>Try asking:</Text>
      </Box>
      {EXAMPLE_PROMPTS.map((prompt, i) => (
        <Box key={i} height={1}>
          <Text color={theme.text.tertiary}>  {prompt}</Text>
        </Box>
      ))}

      {/* What can I do next? */}
      <Box marginTop={1}>
        <Text color={theme.text.tertiary}>
          Type a prompt or use / to browse commands  ·  Ctrl+K to search everything
        </Text>
      </Box>
    </Box>
  );
}

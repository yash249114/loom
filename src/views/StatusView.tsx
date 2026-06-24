import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useApp } from "../components/AppContext.js";

export function StatusView() {
  const { state, theme } = useApp();
  const [gitBranch, setGitBranch] = useState(state.gitBranch);

  useEffect(() => {
    import("node:child_process").then(({ execSync }) => {
      try {
        const branch = execSync("git rev-parse --abbrev-ref HEAD", {
          cwd: state.cwd,
          encoding: "utf8",
          timeout: 2000,
        }).trim();
        setGitBranch(branch);
      } catch {
        setGitBranch("(not a git repo)");
      }
    }).catch(() => {});
  }, [state.cwd]);

  const agentLabels: Record<string, string> = {
    plan: "Plan", build: "Build", review: "Review",
    debug: "Debug", research: "Research", test: "Test",
  };

  const stats = [
    { label: "Workspace", value: state.cwd.split(/[/\\]/).pop() || state.cwd },
    { label: "Git Branch", value: gitBranch },
    { label: "Provider", value: state.provider?.name ?? "Not connected" },
    { label: "Model", value: state.selectedModel?.id ?? "—" },
    { label: "Agent", value: agentLabels[state.currentAgent] || "Build" },
    { label: "Messages", value: String(state.chatHistory.length) },
  ];

  const actions = [
    "/providers  — Connect a provider",
    "/sessions   — View saved sessions",
    "/memory     — View workspace memory",
    "/clear      — Clear conversation",
  ];

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box height={1}>
        <Text color={theme.accent.primary} bold>Status</Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.default}
        padding={1}
        marginTop={1}
      >
        {stats.map((s) => (
          <Box key={s.label} height={1}>
            <Box width={14}>
              <Text color={theme.text.secondary}>{s.label}</Text>
            </Box>
            <Text color={theme.text.primary}>{s.value}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.text.secondary} bold>What can I do next?</Text>
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {actions.map((a) => (
          <Box key={a} height={1}>
            <Text color={theme.text.tertiary}>  {a}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

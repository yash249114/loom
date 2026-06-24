import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useApp } from "../components/AppContext.js";

interface ThemeInfo {
  id: string;
  name: string;
}

export function SettingsView() {
  const { state, theme, themeMeta, dispatch } = useApp();
  const [themes, setThemes] = useState<ThemeInfo[]>([]);

  useEffect(() => {
    import("../theme/index.js").then(({ ThemeManager }) => {
      const manager = new ThemeManager();
      const available = manager.getAvailableThemes().map((t) => ({
        id: t.id,
        name: t.name,
      }));
      setThemes(available);
    }).catch(() => {});
  }, []);

  const actions = [
    "/theme <name>  — Switch theme",
    "/providers     — Configure providers",
    "/config        — View current config",
  ];

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box height={1}>
        <Text color={theme.accent.primary} bold>Settings</Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.default}
        padding={1}
        marginTop={1}
      >
        <Box marginBottom={1}>
          <Text color={theme.text.secondary} bold>Theme</Text>
        </Box>
        <Box flexDirection="column" marginBottom={2}>
          {themes.length === 0 ? (
            <Text color={theme.text.tertiary}>Loading themes...</Text>
          ) : (
            themes.map((t) => {
              const active = themeMeta.id === t.id;
              return (
                <Box key={t.id} height={1}>
                  <Text
                    color={active ? theme.accent.primary : theme.text.secondary}
                    bold={active}
                  >
                    {" "}{active ? "●" : "○"} {t.name}
                  </Text>
                </Box>
              );
            })
          )}
        </Box>
        <Box marginBottom={1}>
          <Text color={theme.text.secondary} bold>Agent</Text>
        </Box>
        <Box height={1}>
          <Text color={theme.text.secondary}>  Mode: </Text>
          <Text color={theme.text.primary}>{state.currentAgent}</Text>
        </Box>
        <Box height={1}>
          <Text color={theme.text.secondary}>  Provider: </Text>
          <Text color={theme.text.primary}>{state.provider?.name ?? "Not connected"}</Text>
        </Box>
        <Box height={1}>
          <Text color={theme.text.secondary}>  Model: </Text>
          <Text color={theme.text.primary}>{state.selectedModel?.id ?? "—"}</Text>
        </Box>
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

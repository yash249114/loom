import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useApp } from "../components/AppContext.js";

export function SessionsView() {
  const { state, theme } = useApp();
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    import("../session/store.js").then(({ SessionStore }) => {
      const store = new SessionStore(state.cwd + "/.loom/sessions");
      store.list().then(setSessions).catch(() => setSessions([]));
    });
  }, []);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box height={1}>
        <Text color={theme.accent.primary} bold>Sessions</Text>
        <Text color={theme.text.tertiary}> — {sessions.length} sessions</Text>
      </Box>
      <Box
        flexGrow={1}
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.default}
        padding={1}
        marginTop={1}
      >
        {sessions.length === 0 && (
          <Text color={theme.text.tertiary}>No saved sessions.</Text>
        )}
        {sessions.map((s) => (
          <Box key={s.id} height={2} marginBottom={1}>
            <Box width={20}>
              <Text color={theme.text.secondary}>
                {new Date(s.updatedAt).toLocaleDateString()}
              </Text>
            </Box>
            <Box width={15}>
              <Text color={theme.text.primary}>{s.provider}</Text>
            </Box>
            <Box width={20}>
              <Text color={theme.text.primary}>{s.model}</Text>
            </Box>
            <Box>
              <Text color={theme.text.tertiary}>{s.messages.length} msgs</Text>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useApp } from "../components/AppContext.js";

export function MemoryView() {
  const { theme, intelligence, dashboardStats } = useApp();
  const [notes, setNotes] = useState<string[]>([]);
  const [summaries, setSummaries] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (intelligence) {
      intelligence.markDirty();
    }
    import("../memory/store.js").then(({ MemoryStore }) => {
      const store = new MemoryStore(process.cwd() + "/.loom/memory.json");
      store.read().then((doc) => {
        setNotes(doc.notes);
        setSummaries(doc.summaries);
        setLoaded(true);
      }).catch(() => setLoaded(true));
    }).catch(() => setLoaded(true));
  }, []);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box height={1}>
        <Text color={theme.accent.primary} bold>Memory</Text>
      </Box>
      <Box
        flexGrow={1}
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.default}
        padding={1}
        marginTop={1}
      >
        {dashboardStats && dashboardStats.memory.total > 0 ? (
          <>
            <Box marginBottom={1}>
              <Text color={theme.text.secondary}>
                {dashboardStats.memory.total} observation{dashboardStats.memory.total > 1 ? "s" : ""}
              </Text>
            </Box>
            <Box flexDirection="column">
              {Object.entries(dashboardStats.memory.byType).map(([type, count]) => (
                <Box key={type} height={1}>
                  <Box width={16}>
                    <Text color={theme.text.secondary}>{type}</Text>
                  </Box>
                  <Text color={theme.text.primary}>{String(count)}</Text>
                </Box>
              ))}
            </Box>
            <Box marginTop={1}>
              <Text color={theme.text.tertiary}>
                {dashboardStats.arch.adrs} ADRs · {dashboardStats.arch.patterns} patterns
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color={theme.text.tertiary}>
                {dashboardStats.tokenBudget.used} / {dashboardStats.tokenBudget.total} tokens used
              </Text>
            </Box>
          </>
        ) : (
          <Text color={theme.text.tertiary}>No intelligence observations yet.</Text>
        )}

        {loaded && (notes.length > 0 || summaries.length > 0) && (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.accent.primary} bold>Workspace Memory</Text>
            {notes.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text color={theme.text.secondary} bold>Notes ({notes.length})</Text>
                {notes.slice(-10).map((n, i) => (
                  <Text key={i} color={theme.text.tertiary}>  · {n.length > 80 ? n.slice(0, 80) + "..." : n}</Text>
                ))}
              </Box>
            )}
            {summaries.length > 0 && (
              <Box flexDirection="column" marginTop={1}>
                <Text color={theme.text.secondary} bold>Summaries ({summaries.length})</Text>
                {summaries.slice(-5).map((s, i) => (
                  <Text key={i} color={theme.text.tertiary}>  · {s.length > 80 ? s.slice(0, 80) + "..." : s}</Text>
                ))}
              </Box>
            )}
          </Box>
        )}

        {loaded && notes.length === 0 && summaries.length === 0 && dashboardStats?.memory.total === 0 && (
          <Box marginTop={1}>
            <Text color={theme.text.tertiary}>No memory entries yet. Memory is populated as you work.</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}

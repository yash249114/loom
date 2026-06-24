import React, { useEffect } from "react";
import { Box, Text } from "ink";
import { useApp } from "../components/AppContext.js";
import { Dots } from "../components/AnimatedLoader.js";

export function RepositoryView() {
  const { state, theme, intelligence, dashboardStats } = useApp();

  useEffect(() => {
    if (intelligence) {
      intelligence.markDirty();
    }
  }, [intelligence]);

  const stats = dashboardStats;

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box height={1}>
        <Text color={theme.accent.primary} bold>Repository Explorer</Text>
      </Box>
      <Box
        flexGrow={1}
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.default}
        padding={1}
        marginTop={1}
      >
        <Box marginBottom={1}>
          <Text color={theme.text.secondary}>📁 {state.cwd}</Text>
        </Box>

        {stats ? (
          <>
            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.text.secondary}>Files</Text>
              <Text color={theme.text.tertiary}>  ◦ {stats.files.total} files tracked</Text>
              {Object.entries(stats.files.byLanguage).length > 0 && (
                <Text color={theme.text.tertiary}>  ◦ Languages: {Object.entries(stats.files.byLanguage)
                  .filter(([_, count]) => count > 0)
                  .map(([lang, count]) => `${lang} (${count})`)
                  .join(", ")}</Text>
              )}
            </Box>

            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.text.secondary}>Symbols</Text>
              <Text color={theme.text.tertiary}>  ◦ {stats.symbols.total} symbols indexed</Text>
              {Object.entries(stats.symbols.byType).length > 0 && (
                <Text color={theme.text.tertiary}>  ◦ Types: {Object.entries(stats.symbols.byType)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([type, count]) => `${type.toLowerCase()} (${count})`)
                  .join(", ")}</Text>
              )}
            </Box>

            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.text.secondary}>Dependencies</Text>
              <Text color={theme.text.tertiary}>  ◦ {stats.dependencies.total} dependencies mapped</Text>
              <Text color={theme.text.tertiary}>  ◦ {stats.graph.edges} edges in graph</Text>
              {stats.dependencies.cycles > 0 ? (
                <Text color={theme.status.warning}>
                  {"  ⚠ "}{stats.dependencies.cycles} circular dep{stats.dependencies.cycles > 1 ? "s" : ""} detected
                </Text>
              ) : (
                <Text color={theme.text.tertiary}>  ◦ No circular dependencies</Text>
              )}
            </Box>

            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.text.secondary}>Memory & Architecture</Text>
              <Text color={theme.text.tertiary}>  ◦ {stats.memory.total} observations ({Object.entries(stats.memory.byType).map(([t, c]) => `${t} ${c}`).join(", ")})</Text>
              <Text color={theme.text.tertiary}>  ◦ {stats.arch.adrs} ADRs, {stats.arch.patterns} architecture patterns</Text>
            </Box>

            <Box flexDirection="column" marginTop={1}>
              <Text color={theme.text.secondary}>Token Budget</Text>
              <Text color={theme.text.tertiary}>  ◦ {stats.tokenBudget.used} / {stats.tokenBudget.total} used ({stats.tokenBudget.available} available)</Text>
            </Box>

            {stats.graph.lastIndexed > 0 && (
              <Box marginTop={1}>
                <Text color={theme.text.tertiary}>
                  Last indexed: {new Date(stats.graph.lastIndexed).toLocaleTimeString()} ({stats.graph.indexDuration}ms)
                </Text>
              </Box>
            )}
          </>
        ) : (
          <Box flexDirection="column" marginTop={1}>
            <Text color={theme.text.tertiary}>No repository data yet.</Text>
            <Text color={theme.text.tertiary}>Run the indexer to populate the graph.</Text>
            <Box marginTop={1}>
              <Dots label="Waiting for data" />
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}

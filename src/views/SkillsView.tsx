import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useApp } from "../components/AppContext.js";

interface ToolInfo {
  name: string;
  description: string;
  dangerous?: boolean;
}

export function SkillsView() {
  const { theme } = useApp();
  const [tools, setTools] = useState<ToolInfo[]>([]);

  useEffect(() => {
    import("../tools/index.js").then(({ buildDefaultRegistry }) => {
      import("../config/loader.js").then(({ loadConfig }) => {
        const { config } = loadConfig();
        const registry = buildDefaultRegistry(config);
        const toolList = registry.list().map((t) => ({
          name: t.name,
          description: t.description,
          dangerous: t.dangerous,
        }));
        setTools(toolList);
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box height={1}>
        <Text color={theme.accent.primary} bold>Skills</Text>
        <Text color={theme.text.tertiary}> — {tools.length} installed</Text>
      </Box>
      <Box
        flexGrow={1}
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.default}
        padding={1}
        marginTop={1}
      >
        {tools.length === 0 ? (
          <Text color={theme.text.tertiary}>Loading tools...</Text>
        ) : (
          tools.map((t) => (
            <Box key={t.name} height={2} marginBottom={1}>
              <Box width={3}>
                <Text color={t.dangerous ? theme.status.warning : theme.status.success}>
                  {t.dangerous ? "⚠" : "✓"}
                </Text>
              </Box>
              <Box flexDirection="column" paddingLeft={1}>
                <Text color={theme.text.primary} bold>{t.name}</Text>
                <Text color={theme.text.tertiary}>{t.description}</Text>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { useApp } from "../components/AppContext.js";

interface McpServer {
  name: string;
  command: string;
  args: string[];
}

export function MCPsView() {
  const { theme } = useApp();
  const [servers, setServers] = useState<McpServer[]>([]);

  useEffect(() => {
    import("../config/loader.js").then(({ loadConfig }) => {
      const { config } = loadConfig();
      const mcpServers = config.mcpServers ?? {};
      const list = Object.entries(mcpServers).map(([name, cfg]) => ({
        name,
        command: cfg.command,
        args: cfg.args ?? [],
      }));
      setServers(list);
    }).catch(() => {});
  }, []);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box height={1}>
        <Text color={theme.accent.primary} bold>MCP Servers</Text>
        <Text color={theme.text.tertiary}> — {servers.length} configured</Text>
      </Box>
      <Box
        flexGrow={1}
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.default}
        padding={1}
        marginTop={1}
      >
        {servers.length === 0 ? (
          <Text color={theme.text.tertiary}>No MCP servers configured.</Text>
        ) : (
          servers.map((s) => (
            <Box key={s.name} height={2} marginBottom={1}>
              <Box width={3}>
                <Text color={theme.status.info}>●</Text>
              </Box>
              <Box flexDirection="column" paddingLeft={1}>
                <Text color={theme.text.primary} bold>{s.name}</Text>
                <Text color={theme.text.tertiary}>{s.command} {s.args.join(" ")}</Text>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

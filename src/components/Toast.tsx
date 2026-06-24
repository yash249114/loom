import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import { useApp } from "./AppContext.js";

export function Toasts() {
  const { state, theme } = useApp();

  if (state.toasts.length === 0) return null;

  const colorMap: Record<string, string> = {
    success: theme.status.success,
    error: theme.status.error,
    warning: theme.status.warning,
    info: theme.status.info,
  };
  const iconMap: Record<string, string> = {
    success: "✓", error: "✗", warning: "⚠", info: "ℹ",
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.border.default} marginTop={1}>
      {state.toasts.slice(-5).map((t) => (
        <Text key={t.id} color={colorMap[t.type] ?? theme.text.primary}>
          {" "}{iconMap[t.type] ?? "•"} {t.message}
        </Text>
      ))}
    </Box>
  );
}

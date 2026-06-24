import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useApp } from "./AppContext.js";

export function SecurityModal() {
  const { state, theme, closeModal, emit } = useApp();
  const [selected, setSelected] = useState<"yes" | "no">("no");

  useInput((_input, key) => {
    if (state.activeModal !== "sensitive-file") return;
    if (key.escape) { emit("modal:confirm", false); closeModal(); return; }
    if (key.leftArrow || key.rightArrow) { setSelected((s) => (s === "yes" ? "no" : "yes")); return; }
    if (key.return) { emit("modal:confirm", selected === "yes"); closeModal(); return; }
    if (_input === "y" || _input === "Y") { emit("modal:confirm", true); closeModal(); return; }
    if (_input === "n" || _input === "N") { emit("modal:confirm", false); closeModal(); return; }
  });

  if (state.activeModal !== "sensitive-file") return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.status.warning} marginTop={1}>
      <Box justifyContent="center">
        <Text color={theme.status.warning} bold>⚠ Sensitive File</Text>
      </Box>
      <Box paddingX={2}>
        <Text color={theme.text.secondary}>This file may contain secrets and API keys.</Text>
      </Box>
      <Text color={theme.text.primary}>Allow Access?</Text>
      <Box justifyContent="center" columnGap={2}>
        <Text
          color={selected === "yes" ? theme.status.success : theme.text.secondary}
          inverse={selected === "yes"}
          bold={selected === "yes"}
        >
          {selected === "yes" ? " [Y] Yes " : "  Y Yes "}
        </Text>
        <Text
          color={selected === "no" ? theme.status.error : theme.text.secondary}
          inverse={selected === "no"}
          bold={selected === "no"}
        >
          {selected === "no" ? " [N] No " : "  N No "}
        </Text>
      </Box>
      <Text color={theme.text.tertiary}>← → navigate, Enter confirm, Esc cancel</Text>
    </Box>
  );
}

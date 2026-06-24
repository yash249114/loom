import React, { useState, useEffect, useCallback } from "react";
import { Box, Text } from "ink";
import { useApp } from "../components/AppContext.js";
import { loadConfig } from "../config/loader.js";
import type { ProviderKey } from "../core/types.js";

const PROVIDER_META: { key: ProviderKey; label: string }[] = [
  { key: "openrouter", label: "OpenRouter" },
  { key: "gemini", label: "Gemini" },
  { key: "groq", label: "Groq" },
  { key: "openai", label: "OpenAI" },
  { key: "anthropic", label: "Anthropic" },
  { key: "ollama", label: "Ollama (Local)" },
];

export function ConnectView() {
  const { state, theme } = useApp();
  const [statuses, setStatuses] = useState<{ key: string; online: boolean; keySet: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    const { config } = loadConfig(state.cwd);
    const entries: { key: string; online: boolean; keySet: boolean }[] = [];

    for (const meta of PROVIDER_META) {
      const ep = config.providerEndpoints?.[meta.key];
      const prov = config.providers?.[meta.key];
      const keySet = !!(ep?.apiKey || prov?.apiKey);
      const endpoint = ep?.baseURL || prov?.baseURL;
      let online = keySet;
      if (keySet && endpoint) {
        try {
          const res = await fetch(endpoint, { method: "HEAD", signal: AbortSignal.timeout(3000) });
          online = res.ok;
        } catch {
          online = false;
        }
      }
      entries.push({ key: meta.key, online, keySet });
    }

    setStatuses(entries);
    setLoading(false);
  }, [state.cwd]);

  useEffect(() => {
    check();
  }, [check]);

  const actions = [
    "/connect      — Re-check provider status",
    "/providers    — Manage provider configuration",
    "Use Ctrl+K to switch providers quickly",
  ];

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      <Box height={1}>
        <Text color={theme.accent.primary} bold>Provider Connections</Text>
      </Box>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.border.default}
        padding={1}
        marginTop={1}
      >
        {loading ? (
          <Text color={theme.text.tertiary}>Checking...</Text>
        ) : (
          PROVIDER_META.map((meta) => {
            const s = statuses.find((x) => x.key === meta.key);
            return (
              <Box key={meta.key} height={1}>
                <Box width={14}>
                  <Text color={theme.text.secondary}>{meta.label}</Text>
                </Box>
                <Text color={s?.online ? theme.status.success : theme.status.error}>
                  {s?.online ? "● Connected" : s?.keySet ? "● Disconnected" : "○ No key"}
                </Text>
                <Text color={theme.text.tertiary}>
                  {" "}{s?.online ? "" : s?.keySet ? "(check endpoint)" : "(set API key)"}
                </Text>
              </Box>
            );
          })
        )}
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

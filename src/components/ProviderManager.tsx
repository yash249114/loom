import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { useApp } from "./AppContext.js";
import { ModelDiscovery } from "../providers/discovery.js";
import { HealthMonitor } from "../providers/health.js";
import { loadConfig, writeConfig } from "../config/loader.js";
import type { ProviderKey, ProviderStatus, ModelInfo } from "../core/types.js";

const PROVIDER_META: { key: ProviderKey; label: string; icon: string }[] = [
  { key: "openrouter", label: "OpenRouter", icon: "🔄" },
  { key: "gemini", label: "Gemini", icon: "🔮" },
  { key: "groq", label: "Groq", icon: "⚡" },
  { key: "openai", label: "OpenAI", icon: "🤖" },
  { key: "anthropic", label: "Anthropic", icon: "🌿" },
  { key: "ollama", label: "Ollama (Local)", icon: "📦" },
];

type Step = "list" | "detail" | "validating" | "fetching";

export function ProviderManager({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { state, theme, addToast } = useApp();
  const [step, setStep] = useState<Step>("list");
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModelIdx, setSelectedModelIdx] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState("");
  const [editingKey, setEditingKey] = useState(false);

  const refresh = useCallback(async () => {
    const discovery = new ModelDiscovery({ workspaceDir: state.cwd });
    const { config } = loadConfig(state.cwd);
    const apiKeys: Partial<Record<ProviderKey, string>> = {};

    for (const meta of PROVIDER_META) {
      const key = meta.key;
      const ep = config.providerEndpoints?.[key];
      const prov = config.providers?.[key];
      if (ep?.apiKey) apiKeys[key] = ep.apiKey;
      else if (prov?.apiKey) apiKeys[key] = prov.apiKey;
    }

    return { discovery, apiKeys, config };
  }, [state.cwd]);

  useEffect(() => {
    if (!isOpen) return;
    (async () => {
      const { discovery, apiKeys } = await refresh();
      const results = await discovery.discoverAll(apiKeys);
      setStatuses(results);

      const health = new HealthMonitor();
      for (const r of results) {
        await health.checkProvider(r.key, async () => ({
          ok: r.ok, latencyMs: r.latencyMs ?? 0,
          modelCount: r.models?.length ?? 0, error: r.error,
        }));
      }
    })();
  }, [isOpen]);

  const currentProvider = PROVIDER_META[selectedIdx];
  const currentStatus = statuses.find((s) => s.key === currentProvider?.key);

  useInput((_input, key) => {
    if (!isOpen) return;

    if (step === "list" && !editingKey) {
      if (key.escape) { onClose(); return; }
      if (key.return && currentProvider) { enterDetail(); return; }
      if (key.upArrow) { setSelectedIdx((i) => Math.max(0, i - 1)); return; }
      if (key.downArrow) { setSelectedIdx((i) => Math.min(PROVIDER_META.length - 1, i + 1)); return; }
      if (_input === "p") { onClose(); return; }
      return;
    }

    if (editingKey) {
      if (key.return || key.escape) { setEditingKey(false); return; }
      if (key.backspace || key.delete) { setApiKey((k) => k.slice(0, -1)); return; }
      if (_input && !key.ctrl && !key.meta && _input.length === 1) {
        setApiKey((k) => k + _input); return;
      }
      return;
    }

    if (step === "detail") {
      if (key.escape) { setStep("list"); setModels([]); setStatusMessage(null); return; }
      if (_input === "e" || _input === "E") {
        setEditingKey(true);
        setApiKey(savedKey || currentStatus?.error?.includes("API key") ? "" : savedKey);
        return;
      }
      if (_input === "v" || _input === "V") { validateKey(); return; }
      if (_input === "f" || _input === "F") { fetchModels(); return; }
      if (_input === "s" || _input === "S") { saveConfig(); return; }
      if (models.length > 0) {
        if (key.upArrow) { setSelectedModelIdx((i) => Math.max(0, i - 1)); return; }
        if (key.downArrow) { setSelectedModelIdx((i) => Math.min(models.length - 1, i + 1)); return; }
      }
      return;
    }

    if (step === "fetching") {
      if (key.escape) { setStep("detail"); setStatusMessage(null); return; }
      return;
    }
  });

  async function enterDetail() {
    const { discovery, apiKeys, config } = await refresh();
    const key = currentProvider!.key;
    const ep = config.providerEndpoints?.[key];
    const prov = config.providers?.[key];
    const existingKey = ep?.apiKey || prov?.apiKey || "";
    setSavedKey(existingKey);
    setApiKey(existingKey);
    setModels(currentStatus?.models ?? []);
    setSelectedModelIdx(0);
    setStatusMessage(null);
    setStep("detail");
  }

  async function validateKey() {
    if (!currentProvider) return;
    setStep("validating");
    setStatusMessage("Validating API key...");
    try {
      const { discovery } = await refresh();
      const result = await discovery.validateProvider(currentProvider.key, apiKey || undefined);
      if (result.ok) {
        setStatusMessage(`✓ Valid — ${result.models?.length ?? 0} models found (${result.latencyMs}ms)`);
        currentStatus!.ok = true;
        currentStatus!.models = result.models;
        currentStatus!.latencyMs = result.latencyMs;
        setModels(result.models ?? []);
        addToast(`${currentProvider.label} key valid`, "success");
      } else {
        setStatusMessage(`✗ ${result.error ?? "Validation failed"}`);
        addToast(`${currentProvider.label}: ${result.error ?? "Validation failed"}`, "error");
      }
    } catch (err: any) {
      setStatusMessage(`✗ ${err.message ?? "Validation error"}`);
    }
    setStep("detail");
  }

  async function fetchModels() {
    if (!currentProvider) return;
    setStep("fetching");
    setStatusMessage("Fetching models...");
    try {
      const { discovery, apiKeys } = await refresh();
      const result = await discovery.discoverProvider(
        currentProvider.key,
        apiKey || apiKeys[currentProvider.key],
        { force: true }
      );
      if (result.ok) {
        setStatusMessage(`✓ ${result.models?.length ?? 0} models fetched (${result.latencyMs}ms)`);
        currentStatus!.ok = true;
        currentStatus!.models = result.models;
        currentStatus!.latencyMs = result.latencyMs;
        setModels(result.models ?? []);
        addToast(`${currentProvider.label}: ${result.models?.length ?? 0} models`, "success");
      } else {
        setStatusMessage(`✗ ${result.error ?? "Fetch failed"}`);
        addToast(`${currentProvider.label}: fetch failed`, "error");
      }
    } catch (err: any) {
      setStatusMessage(`✗ ${err.message ?? "Fetch error"}`);
    }
    setStep("detail");
  }

  function saveConfig() {
    if (!currentProvider) return;
    try {
      const { config: loomConfig } = loadConfig(state.cwd);
      if (!loomConfig.providerEndpoints) {
        (loomConfig as any).providerEndpoints = {};
      }
      loomConfig.providerEndpoints[currentProvider.key] = {
        baseURL: loomConfig.providerEndpoints?.[currentProvider.key]?.baseURL ?? "",
        apiKey: apiKey || undefined,
      };
      const { path: configPath } = loadConfig(state.cwd);
      const targetPath = configPath || `${state.cwd}/.loomrc.json`;
      writeConfig(targetPath, loomConfig as any);
      setSavedKey(apiKey);
      setStatusMessage("✓ Saved to " + targetPath);
      addToast(`${currentProvider.label} config saved`, "success");
    } catch (err: any) {
      setStatusMessage(`✗ Save failed: ${err.message}`);
      addToast(`Save failed: ${err.message}`, "error");
    }
  }

  if (!isOpen) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.accent.primary} marginTop={1}>
      <Box paddingX={1}>
        <Text color={theme.accent.primary} bold>
          {step === "list" ? "Provider Manager" : `Provider Manager — ${currentProvider?.icon} ${currentProvider?.label}`}
        </Text>
        {step !== "list" && (
          <Text color={theme.text.tertiary}> — [Esc] back</Text>
        )}
      </Box>
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        {step === "list" && renderList()}
        {step === "detail" && renderDetail()}
        {step === "validating" && renderBusy("Validating API key...")}
        {step === "fetching" && renderBusy("Fetching models...")}

        <Box marginTop={1}>
          {step === "list" && (
            <Text color={theme.text.tertiary}>
              ▲/▼ select  [Enter] manage  [Esc] close
            </Text>
          )}
          {step === "detail" && !editingKey && (
            <Text color={theme.text.tertiary}>
              [E] edit key  [V] validate  [F] fetch  ▲/▼ model  [S] save
            </Text>
          )}
          {editingKey && (
            <Text color={theme.text.tertiary}>
              Type API key  [Enter] done  [Esc] cancel
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );

  function renderList() {
    return (
      <Box flexDirection="column">
        {PROVIDER_META.map((m, i) => {
          const s = statuses.find((st) => st.key === m.key);
          const active = i === selectedIdx;
          const statusColor = s?.ok
            ? s.latencyMs && s.latencyMs > 0 ? theme.status.success : theme.status.warning
            : theme.status.error;
          const statusLabel = s?.ok
            ? s.latencyMs && s.latencyMs > 0 ? "Online" : "Cached"
            : s?.error?.includes("API key") ? "No Key"
            : s ? "Offline" : "Checking...";

          return (
            <Box key={m.key} height={1}>
              <Text
                color={active ? theme.accent.primary : theme.text.primary}
                bold={active}
              >
                {active ? "▸ " : "  "}{m.icon} {m.label.padEnd(16)}
              </Text>
              <Text color={statusColor}>
                ● {statusLabel.padEnd(8)}
              </Text>
              <Text color={theme.text.tertiary}>
                {s?.models ? `${s.models.length} models` : ""}
                {s?.latencyMs ? ` (${s.latencyMs}ms)` : ""}
              </Text>
            </Box>
          );
        })}
      </Box>
    );
  }

  function renderDetail() {
    if (!currentProvider || !currentStatus) return null;
    const statusColor = currentStatus.ok
      ? currentStatus.latencyMs && currentStatus.latencyMs > 0 ? theme.status.success : theme.status.warning
      : theme.status.error;
    const statusLabel = currentStatus.ok
      ? currentStatus.latencyMs && currentStatus.latencyMs > 0 ? "Online" : "Cached"
      : currentStatus.error?.includes("API key") ? "No API Key"
      : "Offline";
    const masked = savedKey
      ? savedKey.slice(0, 4) + "*".repeat(Math.min(savedKey.length - 4, 16))
      : "";

    return (
      <Box flexDirection="column">
        <Box height={1}>
          <Text>  Status: </Text>
          <Text color={statusColor}>● {statusLabel}</Text>
          {currentStatus.latencyMs ? <Text color={theme.text.tertiary}> ({currentStatus.latencyMs}ms)</Text> : null}
        </Box>
        <Box height={1}>
          <Text>  Models: </Text>
          <Text color={theme.text.primary}>{currentStatus.models?.length ?? 0} available</Text>
        </Box>

        <Box height={1} marginTop={1}>
          <Text>  API Key: </Text>
          {editingKey ? (
            <Text color={theme.accent.primary}>
              {apiKey ? apiKey : "<type new key>"}
            </Text>
          ) : (
            <Text color={savedKey ? theme.text.primary : theme.text.tertiary}>
              {savedKey ? masked : "Not set"}
            </Text>
          )}
        </Box>

        {statusMessage && (
          <Box height={1} marginTop={1}>
            <Text color={statusMessage.startsWith("✓") ? theme.status.success : theme.status.warning}>
              {statusMessage}
            </Text>
          </Box>
        )}

        {models.length > 0 && (
          <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor={theme.border.default} paddingX={1}>
            <Text color={theme.text.secondary} bold>  Models ({models.length})</Text>
            {models.slice(0, 8).map((m, i) => (
              <Box key={m.id} height={1}>
                <Text
                  color={i === selectedModelIdx ? theme.accent.primary : theme.text.primary}
                  bold={i === selectedModelIdx}
                >
                  {i === selectedModelIdx ? "▸ " : "  "}{m.id}
                </Text>
              </Box>
            ))}
            {models.length > 8 && (
              <Text color={theme.text.tertiary}>  ... and {models.length - 8} more</Text>
            )}
          </Box>
        )}
      </Box>
    );
  }

  function renderBusy(msg: string) {
    return (
      <Box>
        <Text color={theme.text.tertiary}>{msg}</Text>
      </Box>
    );
  }
}

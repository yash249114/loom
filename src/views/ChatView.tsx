import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { useApp } from "../components/AppContext.js";
import { TypingIndicator } from "../components/AnimatedLoader.js";
import { WelcomeScreen } from "../components/WelcomeScreen.js";
import { SlashPopup } from "../components/SlashPopup.js";

const HELP_TEXT = [
  "Available commands:",
  "",
  "/help       — Show this help",
  "/index      — Switch to Repository view",
  "/graph      — View dependency graph",
  "/memory     — View workspace memory",
  "/providers  — View connected providers",
  "/models     — Browse available models",
  "/sessions   — List saved sessions",
  "/mcp        — Manage MCP servers",
  "/status     — Workspace health overview",
  "/clear      — Clear chat history",
  "/agent <mode> — Switch agent (plan/build/review/debug/research/test)",
  "/exit       — Quit Loom",
  "",
  "Shortcuts:",
  "Ctrl+K      — Command palette (search everything)",
  "Ctrl+B      — Toggle sidebar",
].join("\n");

const SLASH_COMMANDS: Record<string, (app: ReturnType<typeof useApp>) => void> = {
  help: (app) => {
    app.dispatch({ type: "ADD_MESSAGE", msg: { role: "system", content: HELP_TEXT } });
    app.addToast("Available commands — type /help to see them", "info");
  },
  index: (app) => { app.setView("repository"); app.addToast("Switched to Repository view", "info"); },
  graph: (app) => { app.setView("repository"); app.addToast("Showing dependency graph", "info"); },
  memory: (app) => { app.setView("memory"); app.addToast("Switched to Memory view", "info"); },
  providers: (app) => { app.setView("connect"); app.addToast("Switched to Providers view", "info"); },
  models: (app) => { app.setView("connect"); app.addToast("View providers for available models", "info"); },
  sessions: (app) => { app.setView("sessions"); app.addToast("Switched to Sessions view", "info"); },
  mcp: (app) => { app.setView("mcps"); app.addToast("Switched to MCPs view", "info"); },
  status: (app) => { app.setView("status"); app.addToast("Switched to Status view", "info"); },
  clear: (app) => { app.clearChat(); app.addToast("Chat cleared", "info"); },
  agent: (app) => {
    app.addToast("Switch agent via Ctrl+K palette: Plan/Build/Review/Debug/Research/Test", "info");
  },
  exit: () => process.exit(0),
  quit: () => process.exit(0),
};

function handleSlash(input: string, app: ReturnType<typeof useApp>): boolean {
  const parts = input.slice(1).trim().split(/\s+/);
  const name = parts[0].toLowerCase();
  const handler = SLASH_COMMANDS[name];
  if (handler) {
    handler(app);
    return true;
  }
  app.dispatch({
    type: "ADD_MESSAGE",
    msg: { role: "system", content: `Unknown command: /${name}. Type /help for available commands.` },
  });
  return true;
}

export function ChatView() {
  const app = useApp();
  const { state, theme } = app;
  const [input, setInput] = useState("");
  const [showSlash, setShowSlash] = useState(false);

  useInput((_input, key) => {
    if (key.return && input.trim()) {
      const trimmed = input.trim();
      setInput("");
      setShowSlash(false);
      if (trimmed.startsWith("/")) {
        handleSlash(trimmed, app);
        return;
      }
      app.sendMessage(trimmed);
      return;
    }
    if (key.backspace || key.delete) {
      const next = input.slice(0, -1);
      setInput(next);
      setShowSlash(next.startsWith("/") && next.length > 1);
      return;
    }
    if (_input && !key.ctrl && !key.meta && !key.escape && _input.length === 1) {
      const next = input + _input;
      setInput(next);
      if (next === "/") setShowSlash(true);
      else if (next.startsWith("/") && next.length > 1) setShowSlash(true);
      else setShowSlash(false);
    }
  });

  const messages = state.chatHistory.slice(-50);
  const showWelcome = messages.length === 0 && !input;

  return (
    <Box flexDirection="column" height="100%">
      {/* Message area */}
      <Box flexGrow={1} flexDirection="column" padding={1}>
        {showWelcome ? (
          <WelcomeScreen />
        ) : (
          <Box
            flexGrow={1}
            flexDirection="column"
            borderStyle="single"
            borderColor={theme.border.default}
            padding={1}
          >
            {messages.map((m) => {
              const isUser = m.role === "user";
              const isSystem = m.role === "system";
              const color = isUser ? theme.accent.primary : isSystem ? theme.status.warning : theme.status.info;
              const prefix = isUser ? "You" : isSystem ? "System" : m.model ?? "Assistant";
              return (
                <Box key={m.id} flexDirection="column" marginBottom={1}>
                  <Text color={color} bold>{prefix}:</Text>
                  <Text color={theme.text.primary}>{m.content.slice(0, 2000)}</Text>
                </Box>
              );
            })}
            {state.isLoading && <TypingIndicator />}
          </Box>
        )}
      </Box>

      {/* Slash popup */}
      {showSlash && (
        <Box paddingX={1}>
          <SlashPopup
            query={input.slice(1)}
            onSelect={(action, payload) => {
              if (action === "SET_VIEW") app.setView(payload as any);
              else if (action === "SET_AGENT") app.setAgent(payload as any);
              else if (action === "SEND_MESSAGE" && payload) {
                if (payload === "/clear") app.clearChat();
                else if (payload === "/help") {
                  app.dispatch({ type: "ADD_MESSAGE", msg: { role: "system", content: HELP_TEXT } });
                } else if (payload === "/exit") process.exit(0);
                else app.sendMessage(payload);
              }
              setInput("");
              setShowSlash(false);
            }}
            onClose={() => setShowSlash(false)}
          />
        </Box>
      )}

      {/* Input bar */}
      <Box height={1} marginTop={1} paddingLeft={1} paddingRight={1}>
        <Text backgroundColor={theme.background.tertiary}>
          <Text color={theme.text.tertiary}>❯ </Text>
          {input.startsWith("/") ? (
            <Text color={theme.accent.secondary}>{input || "Type a command..."}</Text>
          ) : (
            <Text color={theme.text.primary}>{input || "Ask anything...  (/ for commands)"}</Text>
          )}
        </Text>
      </Box>
    </Box>
  );
}

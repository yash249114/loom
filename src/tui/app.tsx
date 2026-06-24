import React, { useState } from "react";
import { Box, useInput } from "ink";
import { AppContextProvider, useApp } from "../components/AppContext.js";
import { Header } from "../components/Header.js";
import { StatusLine } from "../components/StatusLine.js";
import { CommandPalette } from "../components/CommandPalette.js";
import { SecurityModal } from "../components/SecurityModal.js";
import { Toasts } from "../components/Toast.js";
import { ProviderManager } from "../components/ProviderManager.js";
import { ChatView } from "../views/ChatView.js";
import { SessionsView } from "../views/SessionsView.js";
import { MemoryView } from "../views/MemoryView.js";
import { SkillsView } from "../views/SkillsView.js";
import { MCPsView } from "../views/MCPsView.js";
import { ConnectView } from "../views/ConnectView.js";
import { StatusView } from "../views/StatusView.js";
import { SettingsView } from "../views/SettingsView.js";
import type { ViewType } from "../core/types.js";
import type { StateManager } from "../core/state.js";
import type { ThemeManager } from "../theme/index.js";
import type { EventBus } from "../core/events.js";
import type { RepositoryIntelligence } from "../memory/intelligence-api.js";

const VIEW_COMPONENTS: Record<string, React.FC> = {
  chat: ChatView,
  sessions: SessionsView,
  memory: MemoryView,
  skills: SkillsView,
  mcps: MCPsView,
  connect: ConnectView,
  status: StatusView,
  settings: SettingsView,
};

function WorkspaceContent() {
  const { state, togglePalette } = useApp();
  const [providerManagerOpen, setProviderManagerOpen] = useState(false);

  useInput((_input, key) => {
    if (key.ctrl && _input === "k") { togglePalette(); return; }
    if (!key.ctrl && _input === "p") { setProviderManagerOpen((v) => !v); return; }
  });

  const ViewComponent = VIEW_COMPONENTS[state.currentView];

  return (
    <Box flexDirection="column" minHeight="100%">
      <Header />
      <Box flexGrow={1}>
        <ViewComponent />
      </Box>
      <StatusLine />
      <CommandPalette />
      <SecurityModal />
      <ProviderManager isOpen={providerManagerOpen} onClose={() => setProviderManagerOpen(false)} />
      <Toasts />
    </Box>
  );
}

export function LoomWorkspace({
  stateManager,
  themeManager,
  eventBus,
  intelligence,
}: {
  stateManager: StateManager;
  themeManager: ThemeManager;
  eventBus: EventBus;
  intelligence?: RepositoryIntelligence | null;
}) {
  return (
    <AppContextProvider stateManager={stateManager} themeManager={themeManager} eventBus={eventBus} intelligence={intelligence}>
      <WorkspaceContent />
    </AppContextProvider>
  );
}

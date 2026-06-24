import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { AppState, ViewType, AgentMode, Toast, Message } from "../core/types.js";
import type { Theme, ThemeColors } from "../theme/types.js";
import { StateManager } from "../core/state.js";
import { ThemeManager } from "../theme/index.js";
import { EventBus, Events } from "../core/events.js";
import type { RepositoryIntelligence, DashboardStats } from "../memory/intelligence-api.js";

interface AppContextValue {
  state: AppState;
  theme: ThemeColors;
  themeMeta: Theme;
  dispatch: (action: AppAction) => void;
  emit: (event: string, ...args: any[]) => void;
  setView: (v: ViewType) => void;
  setAgent: (a: AgentMode) => void;
  sendMessage: (content: string) => void;
  clearChat: () => void;
  toggleSidebar: () => void;
  togglePalette: () => void;
  openModal: (m: NonNullable<AppState["activeModal"]>) => void;
  closeModal: () => void;
  addToast: (msg: string, type: Toast["type"]) => void;
  intelligence: RepositoryIntelligence | null;
  dashboardStats: DashboardStats | null;
}

export type AppAction =
  | { type: "SET_VIEW"; view: ViewType }
  | { type: "SET_AGENT"; agent: AgentMode }
  | { type: "SEND_MESSAGE"; content: string }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "TOGGLE_PALETTE" }
  | { type: "OPEN_MODAL"; modal: NonNullable<AppState["activeModal"]> }
  | { type: "CLOSE_MODAL" }
  | { type: "ADD_TOAST"; message: string; kind: Toast["type"] }
  | { type: "REMOVE_TOAST"; id: string }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "ADD_MESSAGE"; msg: Omit<Message, "id" | "timestamp"> }
  | { type: "SET_THEME"; themeId: string }
  | { type: "CLEAR_CHAT" };

const AppContext = createContext<AppContextValue | null>(null);

export function AppContextProvider({
  stateManager,
  themeManager,
  eventBus,
  intelligence,
  children,
}: {
  stateManager: StateManager;
  themeManager: ThemeManager;
  eventBus: EventBus;
  intelligence?: RepositoryIntelligence | null;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AppState>(stateManager.getState());
  const [theme, setTheme] = useState<ThemeColors>(themeManager.getColors());
  const [themeMeta, setThemeMeta] = useState<Theme>(themeManager.getTheme());
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const intRef = useRef(intelligence ?? null);

  useEffect(() => {
    const unsubState = stateManager.subscribe((s) => setState({ ...s }));
    themeManager.onChange((t) => {
      setTheme(t.colors);
      setThemeMeta(t);
    });
    intRef.current = intelligence ?? null;
    if (intRef.current) {
      const unsub = intRef.current.subscribe((stats) => {
        setDashboardStats(stats);
      });
      intRef.current.markDirty();
      return () => { unsubState(); unsub(); };
    }
    return () => unsubState();
  }, []);

  const dispatch = useCallback((action: AppAction) => {
    switch (action.type) {
      case "SET_VIEW":
        stateManager.setView(action.view);
        break;
      case "SET_AGENT":
        stateManager.setAgent(action.agent);
        eventBus.emit(Events.AGENT_CHANGE, action.agent);
        break;
      case "SEND_MESSAGE":
        eventBus.emit(Events.MESSAGE_SEND, action.content);
        break;
      case "TOGGLE_SIDEBAR":
        stateManager.toggleSidebar();
        break;
      case "TOGGLE_PALETTE":
        stateManager.toggleCommandPalette();
        break;
      case "OPEN_MODAL":
        stateManager.openModal(action.modal);
        break;
      case "CLOSE_MODAL":
        stateManager.closeModal();
        break;
      case "ADD_TOAST":
        stateManager.addToast({ message: action.message, type: action.kind, duration: 3000 });
        break;
      case "REMOVE_TOAST":
        stateManager.removeToast(action.id);
        break;
      case "SET_LOADING":
        stateManager.setState({ isLoading: action.loading });
        break;
      case "ADD_MESSAGE":
        stateManager.addMessage(action.msg);
        break;
      case "SET_THEME":
        eventBus.emit(Events.THEME_CHANGE, action.themeId);
        break;
      case "CLEAR_CHAT":
        stateManager.clearChat();
        break;
    }
  }, []);

  const emit = useCallback((event: string, ...args: any[]) => {
    eventBus.emit(event, ...args);
  }, []);

  const value: AppContextValue = {
    state, theme, themeMeta,
    dispatch,
    emit,
    setView: (v) => dispatch({ type: "SET_VIEW", view: v }),
    setAgent: (a) => dispatch({ type: "SET_AGENT", agent: a }),
    sendMessage: (c) => dispatch({ type: "SEND_MESSAGE", content: c }),
    clearChat: () => dispatch({ type: "CLEAR_CHAT" }),
    toggleSidebar: () => dispatch({ type: "TOGGLE_SIDEBAR" }),
    togglePalette: () => dispatch({ type: "TOGGLE_PALETTE" }),
    openModal: (m) => dispatch({ type: "OPEN_MODAL", modal: m }),
    closeModal: () => dispatch({ type: "CLOSE_MODAL" }),
    addToast: (msg, type) => dispatch({ type: "ADD_TOAST", message: msg, kind: type }),
    intelligence: intRef.current,
    dashboardStats,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppContextProvider");
  return ctx;
}

import { AppState, ViewType, AgentMode, Message, Toast, AgentStep, FileNode, DiffLine, SessionInfo } from './types.js'

const generateId = () => Math.random().toString(36).substr(2, 9)

const initialState: AppState = {
  currentView: 'chat',
  sidebarCollapsed: false,
  contextPanelOpen: false,
  currentAgent: 'build',
  provider: null,
  models: [],
  selectedModel: null,
  chatHistory: [],
  tokenUsage: 0,
  tokenLimit: 8000,
  commandPaletteOpen: false,
  activeModal: null,
  toasts: [],
  isLoading: false,
  gitBranch: 'main',
  cwd: process.cwd(),
  terminalWidth: process.stdout.columns || 120,
  terminalHeight: process.stdout.rows || 40,
  inputBuffer: '',
  inputMode: false,
  slashCommandMode: false,
  commandPaletteIndex: 0,
  commandPaletteQuery: '',
  agentSteps: [],
  reasoningActive: false,
  streamingContent: '',
  streamingActive: false,
  chatScrollOffset: 0,
  fileExplorerOpen: false,
  diffOpen: false,
  sessionTimelineOpen: false,
  onboardingComplete: false,
  files: [],
  fileExplorerCursor: 0,
  diffLines: [],
  diffScrollOffset: 0,
  sessions: [],
}

export class StateManager {
  private state: AppState
  private listeners: ((state: AppState) => void)[] = []

  constructor() {
    this.state = { ...initialState }
    this.setupResizeHandler()
  }

  getState(): AppState {
    return { ...this.state }
  }

  setState(partial: Partial<AppState>) {
    this.state = { ...this.state, ...partial }
    this.notifyListeners()
  }

  subscribe(listener: (state: AppState) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.state))
  }

  private setupResizeHandler() {
    process.stdout.on('resize', () => {
      this.setState({
        terminalWidth: process.stdout.columns || 120,
        terminalHeight: process.stdout.rows || 40
      })
    })
  }

  // ── View ──────────────────────────────────────────────────────────

  setView(view: ViewType) {
    this.setState({ currentView: view })
  }

  toggleSidebar() {
    this.setState({ sidebarCollapsed: !this.state.sidebarCollapsed })
  }

  // ── Agent ─────────────────────────────────────────────────────────

  setAgent(agent: AgentMode) {
    this.setState({ currentAgent: agent })
  }

  // ── Chat ──────────────────────────────────────────────────────────

  addMessage(message: Omit<Message, 'id' | 'timestamp'>) {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: Date.now()
    }
    this.setState({
      chatHistory: [...this.state.chatHistory, newMessage],
      chatScrollOffset: 0,
    })
  }

  clearChat() {
    this.setState({ chatHistory: [], chatScrollOffset: 0 })
  }

  scrollChat(delta: number) {
    const maxOffset = Math.max(0, this.state.chatHistory.length - 5)
    const newOffset = Math.max(0, Math.min(maxOffset, this.state.chatScrollOffset + delta))
    this.setState({ chatScrollOffset: newOffset })
  }

  // ── Streaming ─────────────────────────────────────────────────────

  startStreaming() {
    this.setState({ streamingContent: '', streamingActive: true })
  }

  appendStreamChunk(chunk: string) {
    this.setState({ streamingContent: this.state.streamingContent + chunk })
  }

  finishStreaming(finalContent?: string) {
    const content = finalContent || this.state.streamingContent
    this.setState({
      streamingContent: '',
      streamingActive: false,
    })
    if (content) {
      this.addMessage({ role: 'assistant', content })
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────

  addToast(toast: Omit<Toast, 'id'>) {
    const newToast: Toast = {
      ...toast,
      id: generateId()
    }
    this.setState({
      toasts: [...this.state.toasts, newToast]
    })

    setTimeout(() => {
      this.removeToast(newToast.id)
    }, toast.duration || 3000)
  }

  removeToast(id: string) {
    this.setState({
      toasts: this.state.toasts.filter(t => t.id !== id)
    })
  }

  // ── Modal ─────────────────────────────────────────────────────────

  openModal(modal: NonNullable<AppState['activeModal']>) {
    this.setState({ activeModal: modal })
  }

  closeModal() {
    this.setState({ activeModal: null })
  }

  // ── Command Palette ───────────────────────────────────────────────

  toggleCommandPalette() {
    this.setState({
      commandPaletteOpen: !this.state.commandPaletteOpen,
      commandPaletteIndex: 0,
      commandPaletteQuery: '',
    })
  }

  // ── Input Buffer ──────────────────────────────────────────────────

  setInputBuffer(value: string) {
    this.setState({ inputBuffer: value })
  }

  clearInputBuffer() {
    this.setState({ inputBuffer: '', slashCommandMode: false })
  }

  // ── Slash Commands ────────────────────────────────────────────────

  enterSlashCommandMode() {
    this.setState({ slashCommandMode: true, inputBuffer: '/' })
  }

  exitSlashCommandMode() {
    this.setState({ slashCommandMode: false, inputBuffer: '' })
  }

  // ── Command Palette Navigation ────────────────────────────────────

  setCommandPaletteIndex(index: number) {
    this.setState({ commandPaletteIndex: index })
  }

  setCommandPaletteQuery(query: string) {
    this.setState({ commandPaletteQuery: query, commandPaletteIndex: 0 })
  }

  // ── Agent Reasoning ───────────────────────────────────────────────

  setAgentSteps(steps: AgentStep[]) {
    this.setState({ agentSteps: steps })
  }

  setReasoningActive(active: boolean) {
    this.setState({ reasoningActive: active })
  }

  addAgentStep(text: string) {
    const steps = [...this.state.agentSteps, { text, status: 'active' as const }]
    if (steps.length > 1) steps[steps.length - 2].status = 'done'
    this.setState({ agentSteps: steps })
  }

  finishAgentSteps() {
    const steps = this.state.agentSteps.map(s => ({ ...s, status: 'done' as const }))
    this.setState({ agentSteps: steps, reasoningActive: false })
  }

  // ── File Explorer ─────────────────────────────────────────────────

  toggleFileExplorer() {
    this.setState({ fileExplorerOpen: !this.state.fileExplorerOpen })
  }

  setFiles(files: FileNode[]) {
    this.setState({ files })
  }

  moveFileCursor(delta: number) {
    const total = this.countFiles(this.state.files)
    const newCursor = Math.max(0, Math.min(total - 1, this.state.fileExplorerCursor + delta))
    this.setState({ fileExplorerCursor: newCursor })
  }

  private countFiles(nodes: FileNode[]): number {
    let count = 0
    for (const node of nodes) {
      count++
      if (node.children) count += this.countFiles(node.children)
    }
    return count
  }

  // ── Diff Viewer ───────────────────────────────────────────────────

  toggleDiff() {
    this.setState({ diffOpen: !this.state.diffOpen })
  }

  setDiffLines(lines: DiffLine[]) {
    this.setState({ diffLines: lines, diffScrollOffset: 0 })
  }

  scrollDiff(delta: number) {
    const maxOffset = Math.max(0, this.state.diffLines.length - 10)
    const newOffset = Math.max(0, Math.min(maxOffset, this.state.diffScrollOffset + delta))
    this.setState({ diffScrollOffset: newOffset })
  }

  // ── Session Timeline ──────────────────────────────────────────────

  toggleSessionTimeline() {
    this.setState({ sessionTimelineOpen: !this.state.sessionTimelineOpen })
  }

  setSessions(sessions: SessionInfo[]) {
    this.setState({ sessions })
  }

  // ── Onboarding ────────────────────────────────────────────────────

  completeOnboarding() {
    this.setState({ onboardingComplete: true })
  }
}

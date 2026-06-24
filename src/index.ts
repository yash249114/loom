import { EventBus, Events } from './core/events.js'
import { StateManager } from './core/state.js'
import { InputHandler } from './core/input.js'
import { Renderer } from './core/renderer.js'
import { ThemeManager } from './theme/index.js'
import { SecurityService } from './services/security.js'
import { AgentService } from './services/agent.js'
import { gatherDashboardData, DashboardData } from './core/dashboard-data.js'
import { SLASH_COMMANDS } from './core/slash-commands.js'
import { buildFileTree } from './core/file-explorer.js'
import { parseDiff } from './core/diff-viewer.js'
import { loadSessions, saveSession } from './core/session-timeline.js'
import { isOnboardingComplete } from './core/onboarding.js'

export class LoomApp {
  private events: EventBus
  private state: StateManager
  private input: InputHandler
  private renderer: Renderer
  private theme: ThemeManager
  private security: SecurityService
  private agent: AgentService
  private renderLoop: NodeJS.Timeout | null = null
  private dataRefreshTimer: NodeJS.Timeout | null = null
  private dashboardData: DashboardData
  private cwd: string

  constructor(cwd?: string) {
    this.cwd = cwd || process.cwd()
    this.events = new EventBus()
    this.theme = new ThemeManager()
    this.state = new StateManager()
    this.security = new SecurityService()
    this.renderer = new Renderer(this.theme.getColors())
    this.input = new InputHandler(this.events, this.state, this.cwd)
    this.dashboardData = gatherDashboardData(this.cwd)

    // Initialize real agent
    this.agent = new AgentService(this.cwd, {
      onStep: (step) => this.state.addAgentStep(step),
      onStreamDelta: (delta) => this.state.appendStreamChunk(delta),
      onStreamDone: (text) => this.state.finishStreaming(text),
      onToolCall: (name, _args) => this.state.addAgentStep(`Calling ${name}...`),
      onToolResult: (name, ok, _output) => {
        const status = ok ? 'done' : 'failed'
        this.state.addAgentStep(`${name}: ${status}`)
      },
      onDiff: (filePath, diff) => {
        this.state.setDiffLines(diff)
        this.state.setState({ diffOpen: true })
        this.state.addToast({
          message: `Changes in ${filePath}`,
          type: 'info',
          duration: 2000,
        })
      },
      onError: (err) => {
        this.state.finishStreaming(`Error: ${err.message}`)
        this.state.addToast({ message: err.message, type: 'error', duration: 3000 })
      },
      onDone: () => {},
    })

    // Update dashboard with real provider info
    this.dashboardData.currentAgent = this.state.getState().currentAgent
    this.dashboardData.activeProvider = this.agent.getProviderName()
    this.dashboardData.activeModel = this.agent.getModelName()
  }

  async boot() {
    this.setupEventHandlers()
    this.loadInitialData()
    this.input.start()
    this.startRenderLoop()
    this.startDataRefresh()
  }

  private loadInitialData() {
    // Check onboarding
    const onboardingDone = isOnboardingComplete(this.cwd)
    this.state.setState({ onboardingComplete: onboardingDone })

    // Load file tree
    const files = buildFileTree(this.cwd)
    this.state.setFiles(files)

    // Load sessions
    const sessions = loadSessions(this.cwd)
    this.state.setSessions(sessions)
  }

  private setupEventHandlers() {
    this.events.on(Events.COMMAND_PALETTE_TOGGLE, () => {
      this.state.toggleCommandPalette()
    })

    this.events.on(Events.AGENT_CHANGE, (agent) => {
      this.state.setAgent(agent)
      this.dashboardData.currentAgent = agent
      this.state.addToast({
        message: `Switched to ${agent} mode`,
        type: 'info',
        duration: 2000
      })
    })

    this.events.on(Events.THEME_CHANGE, (themeId) => {
      this.theme.setTheme(themeId)
      this.renderer.updateTheme(this.theme.getColors())
      this.dashboardData.activeTheme = this.theme.getTheme().name
      this.state.addToast({
        message: `Theme changed to ${this.theme.getTheme().name}`,
        type: 'success',
        duration: 2000
      })
    })

    this.events.on(Events.MESSAGE_SEND, (content) => {
      this.state.addMessage({ role: 'user', content })
      this.simulateAgentResponse(content)
    })

    this.events.on(Events.SLASH_COMMAND, (command) => {
      this.handleSlashCommand(command)
    })

    this.events.on(Events.FILE_EXPLORER_TOGGLE, () => {
      this.state.toggleFileExplorer()
    })

    this.events.on(Events.DIFF_TOGGLE, () => {
      this.state.toggleDiff()
    })

    this.events.on(Events.DIFF_SET, (diffText: string) => {
      const lines = parseDiff(diffText)
      this.state.setDiffLines(lines)
      this.state.setState({ diffOpen: true })
    })

    this.events.on(Events.SESSION_TIMELINE_TOGGLE, () => {
      this.state.toggleSessionTimeline()
    })

    this.events.on(Events.APP_QUIT, () => {
      this.destroy()
    })
  }

  private simulateAgentResponse(content: string) {
    this.state.setReasoningActive(true)
    this.state.setAgentSteps([])

    if (!this.agent.isReady()) {
      this.state.addAgentStep('No provider available')
      this.state.finishAgentSteps()
      this.state.addToast({
        message: 'No AI provider configured. Set OPENROUTER_API_KEY or start Ollama.',
        type: 'warning',
        duration: 3000,
      })
      return
    }

    this.state.addAgentStep('Connecting to provider...')
    this.state.startStreaming()

    // Wire streaming completion
    const origOnDone = this.agent['events'].onDone
    this.agent['events'].onDone = (text: string) => {
      this.state.finishAgentSteps()
      origOnDone(text)
    }

    this.agent.sendMessage(content)
  }

  private handleSlashCommand(command: string) {
    const id = command.slice(1).split(' ')[0]
    const cmd = SLASH_COMMANDS.find(c => c.id === id)

    if (!cmd) {
      this.state.addToast({
        message: `Unknown command: ${command}`,
        type: 'warning',
        duration: 2000
      })
      return
    }

    // Agent commands
    const agentCmds = ['plan', 'build', 'review', 'debug', 'research', 'test']
    if (agentCmds.includes(id)) {
      this.state.setAgent(id as any)
      this.dashboardData.currentAgent = id
      this.state.addToast({
        message: `Switched to ${cmd.label}`,
        type: 'success',
        duration: 2000
      })
      return
    }

    if (id === 'quit') {
      this.destroy()
      return
    }

    if (id === 'session-clear') {
      this.state.clearChat()
      this.state.addToast({
        message: 'Chat cleared',
        type: 'success',
        duration: 2000
      })
      return
    }

    if (id === 'sessions') {
      this.state.toggleSessionTimeline()
      return
    }

    if (id.startsWith('theme-')) {
      const themeId = id.replace('theme-', '')
      this.events.emit(Events.THEME_CHANGE, themeId)
      return
    }

    this.state.addToast({
      message: `${cmd.label}: ${cmd.description}`,
      type: 'info',
      duration: 2000
    })
  }

  private startRenderLoop() {
    const render = () => {
      this.renderer.render(this.state.getState(), this.dashboardData)
      this.renderLoop = setTimeout(render, 100)
    }
    render()
  }

  private startDataRefresh() {
    this.dataRefreshTimer = setInterval(() => {
      this.refreshData()
    }, 30000)
  }

  private refreshData() {
    this.dashboardData = gatherDashboardData(this.cwd)
  }

  destroy() {
    if (this.renderLoop) clearTimeout(this.renderLoop)
    if (this.dataRefreshTimer) clearInterval(this.dataRefreshTimer)
    this.input.stop()
    this.renderer.destroy()
    process.exit(0)
  }
}

// ── Entry point ──────────────────────────────────────────────────────

export function startDashboard(cwd?: string): LoomApp {
  const app = new LoomApp(cwd)

  process.on('SIGINT', () => app.destroy())
  if (process.platform !== 'win32') {
    process.on('SIGTERM', () => app.destroy())
  }

  app.boot().catch(console.error)
  return app
}

// Auto-run when executed directly
if (process.argv[1]?.includes('index')) {
  startDashboard()
}

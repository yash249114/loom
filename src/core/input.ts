import { EventBus, Events } from './events.js'
import { StateManager } from './state.js'
import { SLASH_COMMANDS } from './slash-commands.js'
import { isOnboardingComplete, markOnboardingComplete, ONBOARDING_STEPS } from './onboarding.js'

interface ParsedKey {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  raw: string
}

interface KeyBinding {
  key: string
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  action: () => void
  description: string
}

export class InputHandler {
  private events: EventBus
  private state: StateManager
  private bindings: KeyBinding[] = []
  private cwd: string

  constructor(events: EventBus, state: StateManager, cwd?: string) {
    this.events = events
    this.state = state
    this.cwd = cwd || process.cwd()
    this.setupDefaultBindings()
  }

  start() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', this.handleInput.bind(this))
  }

  stop() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false)
    }
    process.stdin.pause()
  }

  private handleInput(data: Buffer) {
    const key = this.parseKey(data)
    const state = this.state.getState()

    // Command palette takes priority
    if (state.commandPaletteOpen) {
      this.handleCommandPaletteInput(key)
      return
    }

    // Modal takes priority
    if (state.activeModal) {
      this.handleModalInput(key)
      return
    }

    // Always handle Ctrl+K
    if (key.ctrl && key.key === 'k') {
      this.events.emit(Events.COMMAND_PALETTE_TOGGLE)
      return
    }

    // Onboarding navigation
    if (!state.onboardingComplete) {
      this.handleOnboardingInput(key)
      return
    }

    // Escape handles various closes
    if (key.key === 'escape') {
      if (state.slashCommandMode) {
        this.state.exitSlashCommandMode()
        return
      }
      if (state.inputMode) {
        this.state.setState({ inputMode: false })
        this.state.clearInputBuffer()
        return
      }
      if (state.fileExplorerOpen) {
        this.state.setState({ fileExplorerOpen: false })
        return
      }
      if (state.diffOpen) {
        this.state.setState({ diffOpen: false })
        return
      }
      if (state.sessionTimelineOpen) {
        this.state.setState({ sessionTimelineOpen: false })
        return
      }
      this.destroy()
      return
    }

    // Panel-specific navigation
    if (state.fileExplorerOpen) {
      this.handleFileExplorerInput(key)
      return
    }

    if (state.diffOpen) {
      this.handleDiffInput(key)
      return
    }

    if (state.sessionTimelineOpen) {
      this.state.setState({ sessionTimelineOpen: false })
      return
    }

    // Input mode: typing in the prompt
    if (state.inputMode || state.slashCommandMode) {
      this.handlePromptInput(key)
      return
    }

    // Normal mode
    this.executeBinding(key)
  }

  private handleOnboardingInput(key: ParsedKey) {
    const state = this.state.getState()
    const step = state.chatScrollOffset

    if (key.key === 'enter' || key.key === 'right' || key.key === 'space') {
      if (step < ONBOARDING_STEPS.length - 1) {
        this.state.setState({ chatScrollOffset: step + 1 })
      } else {
        this.state.completeOnboarding()
        markOnboardingComplete(this.cwd)
      }
      return
    }

    if (key.key === 'left' || key.key === 'backspace') {
      if (step > 0) {
        this.state.setState({ chatScrollOffset: step - 1 })
      }
      return
    }

    // Skip onboarding
    if (key.key === 's' || key.key === 'S') {
      this.state.completeOnboarding()
      markOnboardingComplete(this.cwd)
      return
    }
  }

  private handlePromptInput(key: ParsedKey) {
    const state = this.state.getState()
    let buf = state.inputBuffer

    if (key.key === 'enter') {
      const content = buf.trim()
      if (content) {
        if (content.startsWith('/')) {
          this.events.emit(Events.SLASH_COMMAND, content)
        } else {
          this.events.emit(Events.MESSAGE_SEND, content)
        }
      }
      this.state.clearInputBuffer()
      this.state.setState({ inputMode: false })
      return
    }

    if (key.key === 'backspace') {
      buf = buf.slice(0, -1)
      if (buf === '' && state.slashCommandMode) {
        this.state.exitSlashCommandMode()
        return
      }
      this.state.setInputBuffer(buf)
      return
    }

    if (key.key === 'up') {
      this.state.scrollChat(-1)
      return
    }

    if (key.key === 'down') {
      this.state.scrollChat(1)
      return
    }

    if (key.key.length === 1 && !key.ctrl) {
      buf += key.key
      this.state.setInputBuffer(buf)
      return
    }
  }

  private handleFileExplorerInput(key: ParsedKey) {
    if (key.key === 'up' || key.key === 'k') {
      this.state.moveFileCursor(-1)
      return
    }
    if (key.key === 'down' || key.key === 'j') {
      this.state.moveFileCursor(1)
      return
    }
    if (key.key === 'pageup') {
      this.state.moveFileCursor(-10)
      return
    }
    if (key.key === 'pagedown') {
      this.state.moveFileCursor(10)
      return
    }
  }

  private handleDiffInput(key: ParsedKey) {
    if (key.key === 'up' || key.key === 'k') {
      this.state.scrollDiff(-1)
      return
    }
    if (key.key === 'down' || key.key === 'j') {
      this.state.scrollDiff(1)
      return
    }
    if (key.key === 'pageup') {
      this.state.scrollDiff(-10)
      return
    }
    if (key.key === 'pagedown') {
      this.state.scrollDiff(10)
      return
    }
  }

  private handleCommandPaletteInput(key: ParsedKey) {
    const state = this.state.getState()

    if (key.key === 'escape') {
      this.state.setState({ commandPaletteOpen: false })
      return
    }

    if (key.key === 'enter') {
      const filtered = this.getFilteredCommands(state.commandPaletteQuery)
      const cmd = filtered[state.commandPaletteIndex]
      if (cmd) {
        this.events.emit(Events.SLASH_COMMAND, `/${cmd.id}`)
      }
      this.state.setState({ commandPaletteOpen: false })
      return
    }

    if (key.key === 'up') {
      const idx = Math.max(0, state.commandPaletteIndex - 1)
      this.state.setCommandPaletteIndex(idx)
      return
    }

    if (key.key === 'down') {
      const filtered = this.getFilteredCommands(state.commandPaletteQuery)
      const idx = Math.min(filtered.length - 1, state.commandPaletteIndex + 1)
      this.state.setCommandPaletteIndex(idx)
      return
    }

    if (key.key === 'backspace') {
      this.state.setCommandPaletteQuery(state.commandPaletteQuery.slice(0, -1))
      return
    }

    if (key.key.length === 1 && !key.ctrl) {
      this.state.setCommandPaletteQuery(state.commandPaletteQuery + key.key)
      return
    }
  }

  private handleModalInput(key: ParsedKey) {
    if (key.key === 'escape' || key.key === 'n') {
      this.state.closeModal()
      return
    }

    if (key.key === 'y' || key.key === 'enter') {
      this.events.emit('modal:confirm')
      this.state.closeModal()
      return
    }
  }

  private getFilteredCommands(query: string) {
    const q = query.toLowerCase()
    return SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.id.includes(q)
    )
  }

  private executeBinding(key: ParsedKey) {
    if (key.key === '/' && !key.ctrl) {
      this.state.enterSlashCommandMode()
      this.state.setState({ inputMode: true })
      return
    }

    if (key.key.length === 1 && !key.ctrl && !key.alt) {
      this.state.setState({ inputMode: true })
      this.state.setInputBuffer(key.key)
      return
    }

    const binding = this.bindings.find(b =>
      b.key === key.key &&
      (b.ctrl ?? false) === (key.ctrl ?? false) &&
      (b.shift ?? false) === (key.shift ?? false) &&
      (b.alt ?? false) === (key.alt ?? false)
    )

    if (binding) {
      binding.action()
    }
  }

  private destroy() {
    this.events.emit(Events.APP_QUIT)
  }

  private parseKey(data: Buffer): ParsedKey {
    const str = data.toString()

    if (str === '\u001b[A') return { key: 'up', raw: str }
    if (str === '\u001b[B') return { key: 'down', raw: str }
    if (str === '\u001b[C') return { key: 'right', raw: str }
    if (str === '\u001b[D') return { key: 'left', raw: str }
    if (str === '\u001b[H') return { key: 'home', raw: str }
    if (str === '\u001b[F') return { key: 'end', raw: str }
    if (str === '\u001b[5~') return { key: 'pageup', raw: str }
    if (str === '\u001b[6~') return { key: 'pagedown', raw: str }
    if (str === '\u001b[3~') return { key: 'delete', raw: str }
    if (str === '\t') return { key: 'tab', raw: str }
    if (str === '\r' || str === '\n') return { key: 'enter', raw: str }
    if (str === '\u001b') return { key: 'escape', raw: str }
    if (str === '\u007f') return { key: 'backspace', raw: str }
    if (str === ' ') return { key: 'space', raw: str }

    const code = str.charCodeAt(0)
    if (code >= 1 && code <= 26) {
      return {
        key: String.fromCharCode(code + 96),
        ctrl: true,
        raw: str
      }
    }

    return { key: str, raw: str }
  }

  private setupDefaultBindings() {
    this.bindings = [
      { key: 'k', ctrl: true, action: () => this.events.emit(Events.COMMAND_PALETTE_TOGGLE), description: 'Command Palette' },
      { key: 'b', ctrl: true, action: () => this.events.emit(Events.FILE_EXPLORER_TOGGLE), description: 'File Explorer' },
      { key: 'd', ctrl: true, action: () => this.events.emit(Events.DIFF_TOGGLE), description: 'Diff Viewer' },
      { key: 's', ctrl: true, action: () => this.events.emit(Events.SESSION_TIMELINE_TOGGLE), description: 'Sessions' },
    ]
  }

  addBinding(binding: KeyBinding) {
    this.bindings.push(binding)
  }

  getBindings(): KeyBinding[] {
    return [...this.bindings]
  }
}

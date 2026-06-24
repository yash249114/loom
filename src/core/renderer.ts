import { ThemeColors } from '../theme/types.js'
import { AppState, Message, FileNode, DiffLine, SessionInfo } from './types.js'
import { DashboardData } from './dashboard-data.js'
import { SLASH_COMMANDS } from './slash-commands.js'
import { getFileIcon, formatFileSize, flattenFileTree } from './file-explorer.js'
import { formatSessionTime } from './session-timeline.js'
import { ONBOARDING_STEPS } from './onboarding.js'

export class Renderer {
  private theme: ThemeColors
  private lastRender: string = ''

  constructor(theme: ThemeColors) {
    this.theme = theme
    this.setupTerminal()
  }

  private setupTerminal() {
    process.stdout.write('\x1b[?25l')
    process.stdout.write('\x1b[2J')
    process.stdout.write('\x1b[H')
  }

  clear() {
    process.stdout.write('\x1b[2J\x1b[H')
  }

  render(state: AppState, data: DashboardData) {
    const output = this.renderToString(state, data)
    if (output === this.lastRender) return
    this.clear()
    process.stdout.write(output)
    this.lastRender = output
  }

  renderToString(state: AppState, data: DashboardData): string {
    const W = state.terminalWidth
    const H = state.terminalHeight
    const lines: string[] = []

    // ── DECIDE MAIN VIEW ──
    if (!state.onboardingComplete) {
      lines.push(...this.renderOnboarding(state, W, H))
    } else if (state.chatHistory.length === 0 && !state.streamingActive) {
      lines.push(...this.renderWelcomeScreen(data, W, H))
    } else {
      lines.push(...this.renderChatView(state, data, W, H))
    }

    // ── INPUT PROMPT (always visible) ──
    lines.push(this.renderInputPrompt(state, W))

    // ── STATUS LINE (always visible) ──
    lines.push(this.renderStatusLine(state, data, W))

    // ── TOAST NOTIFICATIONS ──
    if (state.toasts.length > 0) {
      this.overlayToasts(lines, state, W)
    }

    // ── OVERLAYS (highest priority) ──
    if (state.commandPaletteOpen) {
      return this.overlayCommandPalette(lines, state, W, H)
    }

    if (state.slashCommandMode) {
      return this.overlaySlashPopup(lines, state, W, H)
    }

    if (state.fileExplorerOpen) {
      return this.overlayFileExplorer(lines, state, W, H)
    }

    if (state.diffOpen && state.diffLines.length > 0) {
      return this.overlayDiffViewer(lines, state, W, H)
    }

    if (state.sessionTimelineOpen) {
      return this.overlaySessionTimeline(lines, state, W, H)
    }

    // Trim to terminal height
    while (lines.length < H) {
      lines.push(this.emptyLine(W))
    }

    return lines.slice(0, H).join('\n')
  }

  // ═══════════════════════════════════════════════════════════════════
  // ONBOARDING SCREEN
  // ═══════════════════════════════════════════════════════════════════

  private renderOnboarding(state: AppState, w: number, h: number): string[] {
    const lines: string[] = []
    const step = ONBOARDING_STEPS[Math.min(state.chatScrollOffset, ONBOARDING_STEPS.length - 1)]

    lines.push(this.emptyLine(w))
    lines.push(this.emptyLine(w))
    lines.push(this.centerLine('⌬ Loom', w, this.theme.accent.primary))
    lines.push(this.emptyLine(w))
    lines.push(this.centerLine('Repository-Aware AI Coding Workspace', w, this.theme.text.secondary))
    lines.push(this.emptyLine(w))
    lines.push(this.emptyLine(w))

    // Step indicator
    const stepNum = state.chatScrollOffset + 1
    const total = ONBOARDING_STEPS.length
    lines.push(this.centerLine(`Step ${stepNum} of ${total}`, w, this.theme.text.tertiary))
    lines.push(this.emptyLine(w))

    // Step title
    lines.push(this.centerLine(step.title, w, this.theme.accent.primary))
    lines.push(this.emptyLine(w))

    // Step content
    for (const line of step.content.split('\n')) {
      lines.push(this.centerLine(line, w, this.theme.text.primary))
    }

    if (step.highlight) {
      lines.push(this.emptyLine(w))
      lines.push(this.centerLine(step.highlight, w, this.theme.status.success))
    }

    lines.push(this.emptyLine(w))
    lines.push(this.emptyLine(w))

    // Navigation hint
    const hint = stepNum < total ? 'Press → or Enter to continue' : 'Press Enter to start'
    lines.push(this.centerLine(hint, w, this.theme.text.tertiary))

    while (lines.length < h - 2) {
      lines.push(this.emptyLine(w))
    }

    return lines.slice(0, h - 2)
  }

  // ═══════════════════════════════════════════════════════════════════
  // WELCOME SCREEN
  // ═══════════════════════════════════════════════════════════════════

  private renderWelcomeScreen(data: DashboardData, w: number, h: number): string[] {
    const lines: string[] = []

    lines.push(this.emptyLine(w))
    lines.push(this.emptyLine(w))
    lines.push(this.centerLine('⌬ Loom', w, this.theme.accent.primary))
    lines.push(this.emptyLine(w))
    lines.push(this.centerLine('Repository-Aware AI Coding Workspace', w, this.theme.text.secondary))
    lines.push(this.emptyLine(w))
    lines.push(this.centerLine(`Workspace: ${data.workspaceName}`, w, this.theme.text.primary))
    lines.push(this.centerLine(`Branch: ${data.gitBranch}`, w, this.theme.text.primary))
    lines.push(this.emptyLine(w))

    // Connected providers
    const connected = data.providers.filter(p => p.status === 'online' || p.status === 'models-available')
    lines.push(this.centerLine('Connected Providers:', w, this.theme.text.secondary))
    if (connected.length === 0) {
      lines.push(this.centerLine('  No providers connected', w, this.theme.text.tertiary))
    } else {
      for (const p of connected.slice(0, 5)) {
        lines.push(this.centerLine(`  ✓ ${p.name}`, w, this.theme.status.success))
      }
    }
    lines.push(this.emptyLine(w))

    // Current agent
    const agentName = data.agents.find(a => a.codename === data.currentAgent)?.name || data.currentAgent
    lines.push(this.centerLine('Current Agent:', w, this.theme.text.secondary))
    lines.push(this.centerLine(agentName, w, this.theme.accent.primary))
    lines.push(this.emptyLine(w))

    // Examples
    lines.push(this.centerLine('Examples:', w, this.theme.text.secondary))
    const examples = [
      'Explain this codebase',
      'Fix authentication bug',
      'Create JWT auth',
      'Generate tests',
      'Refactor repository',
    ]
    for (const ex of examples) {
      lines.push(this.centerLine(`• ${ex}`, w, this.theme.text.tertiary))
    }

    while (lines.length < h - 3) {
      lines.push(this.emptyLine(w))
    }

    return lines.slice(0, h - 3)
  }

  // ═══════════════════════════════════════════════════════════════════
  // CHAT VIEW
  // ═══════════════════════════════════════════════════════════════════

  private renderChatView(state: AppState, data: DashboardData, w: number, h: number): string[] {
    const lines: string[] = []
    const inputLines = 2 // prompt + status
    const reasoningSteps = state.reasoningActive ? Math.min(state.agentSteps.length, 5) : 0
    const reasoningLines = state.reasoningActive ? reasoningSteps + 2 : 0
    const maxChatLines = Math.max(1, h - inputLines - reasoningLines)

    // Render chat messages
    const messages = state.chatHistory
    const chatLines: string[] = []

    for (const msg of messages) {
      chatLines.push(...this.renderMessage(msg, w))
      chatLines.push(this.emptyLine(w))
    }

    // Add streaming content if active
    if (state.streamingActive && state.streamingContent) {
      chatLines.push(...this.renderStreamingMessage(state.streamingContent, w))
      chatLines.push(this.emptyLine(w))
    } else if (state.streamingActive) {
      chatLines.push(...this.renderTypingIndicator(w))
      chatLines.push(this.emptyLine(w))
    }

    // Apply scroll offset
    const visibleLines = chatLines.slice(-maxChatLines)
    lines.push(...visibleLines)

    // Fill remaining space
    while (lines.length < maxChatLines) {
      lines.push(this.emptyLine(w))
    }

    // Agent reasoning stream
    if (state.reasoningActive && state.agentSteps.length > 0) {
      lines.push(this.emptyLine(w))
      for (const step of state.agentSteps) {
        const icon = step.status === 'done' ? '✓' : step.status === 'active' ? '⟳' : '○'
        const color = step.status === 'done'
          ? this.theme.status.success
          : step.status === 'active'
            ? this.theme.status.info
            : this.theme.text.tertiary
        lines.push(this.coloredLine(`  ${icon} ${step.text}`, w, color))
      }
    }

    return lines.slice(0, h - inputLines)
  }

  private renderMessage(msg: Message, w: number): string[] {
    const lines: string[] = []
    const isUser = msg.role === 'user'
    const label = isUser ? 'You' : 'Loom'
    const color = isUser ? this.theme.accent.primary : this.theme.status.success

    // Role label with timestamp
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const header = `${label}  ${time}`
    lines.push(this.coloredLine(header, w, color))

    // Message content with word wrapping
    const contentLines = this.wrapText(msg.content, w - 4)
    for (const line of contentLines) {
      lines.push(this.colorize(
        '  ' + line.padEnd(w - 2).substring(0, w - 2),
        this.theme.background.primary,
        this.theme.text.primary
      ))
    }

    return lines
  }

  private renderStreamingMessage(content: string, w: number): string[] {
    const lines: string[] = []

    lines.push(this.coloredLine('Loom  streaming...', w, this.theme.status.info))

    const contentLines = this.wrapText(content, w - 4)
    for (const line of contentLines) {
      lines.push(this.colorize(
        '  ' + line.padEnd(w - 2).substring(0, w - 2),
        this.theme.background.primary,
        this.theme.text.primary
      ))
    }

    // Show cursor at end
    lines.push(this.colorize('  █', this.theme.background.primary, this.theme.status.info))

    return lines
  }

  private renderTypingIndicator(w: number): string[] {
    return [
      this.coloredLine('Loom  thinking...', w, this.theme.status.info),
      this.colorize('  ⟳', this.theme.background.primary, this.theme.status.info),
    ]
  }

  // ═══════════════════════════════════════════════════════════════════
  // INPUT PROMPT
  // ═══════════════════════════════════════════════════════════════════

  private renderInputPrompt(state: AppState, w: number): string {
    const prefix = 'Ask Loom... '
    const buf = state.inputBuffer
    const display = buf ? `Ask Loom... ${buf}` : prefix
    const cursor = state.inputMode ? '█' : ''
    const text = display + cursor
    return this.bgFg(
      this.theme.background.tertiary,
      state.inputMode ? this.theme.text.primary : this.theme.text.tertiary,
      this.truncate(text, w)
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // STATUS LINE
  // ═══════════════════════════════════════════════════════════════════

  private renderStatusLine(state: AppState, data: DashboardData, w: number): string {
    const agentName = data.agents.find(a => a.codename === state.currentAgent)?.name || state.currentAgent
    const modelName = state.selectedModel?.name || 'Auto'
    const fileCount = data.indexMetrics.filesIndexed
    const providerName = data.providers.find(
      p => p.status === 'online' || p.status === 'models-available'
    )?.name || 'None'

    const left = `${agentName} | ${modelName} | ${fileCount} files | ${providerName}`
    const right = '/ cmds  Ctrl+K  Esc'
    const pad = Math.max(0, w - left.length - right.length)

    return this.bgFg(
      this.theme.background.secondary,
      this.theme.text.secondary,
      left + ' '.repeat(Math.max(0, pad)) + right
    )
  }

  // ═══════════════════════════════════════════════════════════════════
  // SLASH COMMAND POPUP
  // ═══════════════════════════════════════════════════════════════════

  private overlaySlashPopup(lines: string[], state: AppState, w: number, h: number): string {
    const popupW = Math.max(20, Math.min(50, w - 4))
    const popupH = Math.max(5, Math.min(20, h - 6))
    const startX = Math.max(0, Math.floor((w - popupW) / 2))
    const startY = Math.max(0, lines.length - popupH - 2)

    const popup: string[] = []
    popup.push(this.borderLine(popupW, 'top'))
    popup.push(this.panelTitle(popupW, 'Commands'))

    const query = state.inputBuffer.startsWith('/') ? state.inputBuffer.slice(1) : ''
    const filtered = SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase())
    )

    let selectedIdx = state.commandPaletteIndex
    if (selectedIdx >= filtered.length) selectedIdx = Math.max(0, filtered.length - 1)

    for (let i = 0; i < popupH - 3 && i < filtered.length; i++) {
      const cmd = filtered[i]
      const isSelected = i === selectedIdx
      const line = `  ${cmd.icon} ${cmd.label}`
      const padded = line.padEnd(popupW - 2).substring(0, popupW - 2)
      if (isSelected) {
        popup.push(this.bgFg(this.theme.accent.primary, this.theme.background.primary, padded))
      } else {
        popup.push(this.colorize(padded, this.theme.background.primary, this.theme.text.primary))
      }
    }

    while (popup.length < popupH) {
      popup.push(this.emptyLine(popupW))
    }
    popup.push(this.borderLine(popupW, 'bottom'))

    const result = [...lines]
    for (let i = 0; i < popup.length && startY + i < result.length; i++) {
      result[startY + i] = this.overlayAt(result[startY + i], popup[i], startX)
    }

    return result.slice(0, h).join('\n')
  }

  // ═══════════════════════════════════════════════════════════════════
  // COMMAND PALETTE (Ctrl+K)
  // ═══════════════════════════════════════════════════════════════════

  private overlayCommandPalette(lines: string[], state: AppState, w: number, h: number): string {
    const paletteW = Math.max(20, Math.min(60, w - 4))
    const paletteH = Math.max(5, Math.min(22, h - 4))
    const startX = Math.max(0, Math.floor((w - paletteW) / 2))
    const startY = Math.max(0, Math.floor((h - paletteH) / 2))

    const palette: string[] = []
    palette.push(this.borderLine(paletteW, 'top'))
    palette.push(this.panelTitle(paletteW, 'Command Palette'))

    const searchLine = `  🔍 ${state.commandPaletteQuery}_`
    palette.push(this.colorize(
      searchLine.padEnd(paletteW - 2).substring(0, paletteW - 2),
      this.theme.background.primary,
      this.theme.text.primary
    ))
    palette.push(this.colorize('─'.repeat(paletteW - 2), this.theme.border.default))

    const query = state.commandPaletteQuery.toLowerCase()
    const filtered = SLASH_COMMANDS.filter(cmd =>
      cmd.label.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query) ||
      cmd.id.includes(query)
    )

    let selectedIdx = state.commandPaletteIndex
    if (selectedIdx >= filtered.length) selectedIdx = Math.max(0, filtered.length - 1)

    const maxItems = paletteH - 5
    const startItem = Math.max(0, selectedIdx - Math.floor(maxItems / 2))
    const visibleItems = filtered.slice(startItem, startItem + maxItems)

    let lastCategory = ''
    for (let i = 0; i < visibleItems.length; i++) {
      const cmd = visibleItems[i]
      const globalIdx = startItem + i
      const isSelected = globalIdx === selectedIdx

      if (cmd.category !== lastCategory) {
        palette.push(this.colorize(
          (' ' + cmd.category).padEnd(paletteW - 2).substring(0, paletteW - 2),
          this.theme.background.primary,
          this.theme.accent.secondary
        ))
        lastCategory = cmd.category
      }

      const line = `  ${cmd.icon} ${cmd.label}  ${cmd.description}`
      const padded = line.padEnd(paletteW - 2).substring(0, paletteW - 2)
      if (isSelected) {
        palette.push(this.bgFg(this.theme.accent.primary, this.theme.background.primary, padded))
      } else {
        palette.push(this.colorize(padded, this.theme.background.primary, this.theme.text.primary))
      }
    }

    while (palette.length < paletteH - 1) {
      palette.push(this.emptyLine(paletteW))
    }
    palette.push(this.borderLine(paletteW, 'bottom'))

    const result = [...lines]
    for (let i = 0; i < palette.length && startY + i < result.length; i++) {
      result[startY + i] = this.overlayAt(result[startY + i], palette[i], startX)
    }

    return result.slice(0, h).join('\n')
  }

  // ═══════════════════════════════════════════════════════════════════
  // FILE EXPLORER OVERLAY
  // ═══════════════════════════════════════════════════════════════════

  private overlayFileExplorer(lines: string[], state: AppState, w: number, h: number): string {
    const panelW = Math.min(35, Math.floor(w * 0.35))
    const panelH = Math.max(5, h - 2)
    const startX = w - panelW - 1

    const panel: string[] = []
    panel.push(this.borderLine(panelW, 'top'))
    panel.push(this.panelTitle(panelW, 'Files'))

    const flat = flattenFileTree(state.files)
    const maxVisible = panelH - 3
    const cursor = state.fileExplorerCursor
    const scrollStart = Math.max(0, cursor - Math.floor(maxVisible / 2))

    for (let i = 0; i < maxVisible && i < flat.length; i++) {
      const idx = scrollStart + i
      if (idx >= flat.length) break
      const { node, depth } = flat[idx]
      const isSelected = idx === cursor
      const icon = getFileIcon(node)
      const indent = '  '.repeat(depth)
      const sizeStr = node.type === 'file' && node.size ? ` ${formatFileSize(node.size)}` : ''
      const line = `${indent}${icon} ${node.name}${sizeStr}`
      const padded = line.padEnd(panelW - 2).substring(0, panelW - 2)

      if (isSelected) {
        panel.push(this.bgFg(this.theme.accent.primary, this.theme.background.primary, padded))
      } else if (node.type === 'directory') {
        panel.push(this.colorize(padded, this.theme.background.primary, this.theme.accent.secondary))
      } else {
        panel.push(this.colorize(padded, this.theme.background.primary, this.theme.text.primary))
      }
    }

    while (panel.length < panelH) {
      panel.push(this.emptyLine(panelW))
    }
    panel.push(this.borderLine(panelW, 'bottom'))

    const result = [...lines]
    for (let i = 0; i < panel.length && i < result.length; i++) {
      result[i] = this.overlayAt(result[i], panel[i], startX)
    }

    return result.slice(0, h).join('\n')
  }

  // ═══════════════════════════════════════════════════════════════════
  // DIFF VIEWER OVERLAY
  // ═══════════════════════════════════════════════════════════════════

  private overlayDiffViewer(lines: string[], state: AppState, w: number, h: number): string {
    const panelW = Math.min(70, Math.max(20, w - 4))
    const panelH = Math.max(5, Math.min(h - 4, 20))
    const startX = Math.max(0, Math.floor((w - panelW) / 2))
    const startY = Math.max(0, Math.floor((h - panelH) / 2))

    const panel: string[] = []
    panel.push(this.borderLine(panelW, 'top'))
    panel.push(this.panelTitle(panelW, 'Changes'))

    const maxVisible = panelH - 3
    const scrollOffset = state.diffScrollOffset
    const visibleLines = state.diffLines.slice(scrollOffset, scrollOffset + maxVisible)

    for (const line of visibleLines) {
      let color: string
      let prefix: string

      switch (line.type) {
        case 'add':
          color = this.theme.status.success
          prefix = '+ '
          break
        case 'remove':
          color = this.theme.status.error
          prefix = '- '
          break
        case 'header':
          color = this.theme.accent.secondary
          prefix = '  '
          break
        default:
          color = this.theme.text.secondary
          prefix = '  '
      }

      const text = prefix + line.content
      panel.push(this.colorize(
        text.padEnd(panelW - 2).substring(0, panelW - 2),
        this.theme.background.primary,
        color
      ))
    }

    while (panel.length < panelH - 1) {
      panel.push(this.emptyLine(panelW))
    }
    panel.push(this.borderLine(panelW, 'bottom'))

    const result = [...lines]
    for (let i = 0; i < panel.length && startY + i < result.length; i++) {
      result[startY + i] = this.overlayAt(result[startY + i], panel[i], startX)
    }

    return result.slice(0, h).join('\n')
  }

  // ═══════════════════════════════════════════════════════════════════
  // SESSION TIMELINE OVERLAY
  // ═══════════════════════════════════════════════════════════════════

  private overlaySessionTimeline(lines: string[], state: AppState, w: number, h: number): string {
    const panelW = Math.min(40, Math.floor(w * 0.4))
    const panelH = Math.max(5, h - 2)
    const startX = 1

    const panel: string[] = []
    panel.push(this.borderLine(panelW, 'top'))
    panel.push(this.panelTitle(panelW, 'Sessions'))

    const maxVisible = panelH - 3
    const sessions = state.sessions.slice(0, maxVisible)

    if (sessions.length === 0) {
      panel.push(this.colorize(
        '  No sessions yet'.padEnd(panelW - 2).substring(0, panelW - 2),
        this.theme.background.primary,
        this.theme.text.tertiary
      ))
    } else {
      for (const session of sessions) {
        const time = formatSessionTime(session.createdAt)
        const agent = session.agent.padEnd(6).substring(0, 6)
        const summary = session.summary.padEnd(panelW - 16).substring(0, panelW - 16)
        const line = `  ${agent} ${summary} ${time}`
        panel.push(this.colorize(
          line.padEnd(panelW - 2).substring(0, panelW - 2),
          this.theme.background.primary,
          this.theme.text.primary
        ))
      }
    }

    while (panel.length < panelH) {
      panel.push(this.emptyLine(panelW))
    }
    panel.push(this.borderLine(panelW, 'bottom'))

    const result = [...lines]
    for (let i = 0; i < panel.length && i < result.length; i++) {
      result[i] = this.overlayAt(result[i], panel[i], startX)
    }

    return result.slice(0, h).join('\n')
  }

  // ═══════════════════════════════════════════════════════════════════
  // TOAST NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════

  private overlayToasts(lines: string[], state: AppState, w: number) {
    const toastW = Math.min(40, w - 4)
    const startX = w - toastW - 2

    for (let i = 0; i < Math.min(state.toasts.length, 3); i++) {
      const toast = state.toasts[i]
      const color = toast.type === 'success' ? this.theme.status.success
        : toast.type === 'error' ? this.theme.status.error
        : toast.type === 'warning' ? this.theme.status.warning
        : this.theme.status.info

      const icon = toast.type === 'success' ? '✓' : toast.type === 'error' ? '✗' : toast.type === 'warning' ? '⚠' : 'ℹ'
      const text = ` ${icon} ${toast.message}`
      const line = text.padEnd(toastW).substring(0, toastW)
      const lineIdx = i
      if (lineIdx < lines.length) {
        lines[lineIdx] = this.overlayAt(lines[lineIdx], this.bgFg(this.theme.background.secondary, color, line), startX)
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // LINE BUILDERS
  // ═══════════════════════════════════════════════════════════════════

  private wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      if (currentLine.length + word.length + 1 > maxWidth) {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = currentLine ? currentLine + ' ' + word : word
      }
    }
    if (currentLine) lines.push(currentLine)

    return lines.length > 0 ? lines : ['']
  }

  private centerLine(text: string, w: number, color: string): string {
    const pad = Math.max(0, Math.floor((w - text.length) / 2))
    const line = ' '.repeat(pad) + text
    return this.colorize(line.padEnd(w).substring(0, w), this.theme.background.primary, color)
  }

  private coloredLine(text: string, w: number, color: string): string {
    return this.colorize(
      text.padEnd(w).substring(0, w),
      this.theme.background.primary,
      color
    )
  }

  private emptyLine(w: number): string {
    return this.colorize(' '.repeat(w), this.theme.background.primary)
  }

  private borderLine(w: number, pos: 'top' | 'bottom'): string {
    return this.colorize('┌' + '─'.repeat(w - 2) + '┐', this.theme.border.default)
  }

  private panelTitle(w: number, title: string): string {
    const inner = w - 2
    const padded = (' ' + title + ' ').padEnd(inner).substring(0, inner)
    return this.bgFg(this.theme.background.secondary, this.theme.accent.primary, padded)
  }

  private overlayAt(baseLine: string, overlayLine: string, startX: number): string {
    if (startX <= 0) return overlayLine
    const baseVisible = baseLine.substring(0, startX)
    return baseVisible + overlayLine
  }

  // ═══════════════════════════════════════════════════════════════════
  // COLOR HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private truncate(str: string, max: number): string {
    if (str.length <= max) return str
    return str.substring(0, max - 1) + '…'
  }

  private colorize(text: string, bg?: string, fg?: string): string {
    const parts: string[] = []
    if (bg) parts.push(this.bgSeq(bg))
    if (fg) parts.push(this.fgSeq(fg))
    parts.push(text)
    parts.push('\x1b[0m')
    return parts.join('')
  }

  private bgFg(bg: string, fg: string, text: string): string {
    return this.bgSeq(bg) + this.fgSeq(fg) + text + '\x1b[0m'
  }

  private bgSeq(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `\x1b[48;2;${r};${g};${b}m`
  }

  private fgSeq(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    return `\x1b[38;2;${r};${g};${b}m`
  }

  updateTheme(theme: ThemeColors) {
    this.theme = theme
  }

  destroy() {
    process.stdout.write('\x1b[?25h')
    this.clear()
  }
}

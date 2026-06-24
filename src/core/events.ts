import { EventEmitter } from 'events'

type EventHandler = (...args: any[]) => void

export class TypedEmitter extends EventEmitter {
  emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args)
  }

  emitTyped(event: string, ...args: any[]): boolean {
    return this.emit(event, ...args)
  }

  on(event: string, handler: EventHandler): this {
    super.on(event, handler)
    return this
  }

  once(event: string, handler: EventHandler): this {
    super.once(event, handler)
    return this
  }

  off(event: string, handler: EventHandler): this {
    super.off(event, handler)
    return this
  }
}

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map()
  private emitter = new TypedEmitter()

  on(event: string, handler: EventHandler): () => void {
    this.emitter.on(event, handler)
    return () => this.off(event, handler)
  }

  off(event: string, handler: EventHandler) {
    this.emitter.off(event, handler)
  }

  emit(event: string, ...args: any[]) {
    this.emitter.emit(event, ...args)
  }

  once(event: string, handler: EventHandler) {
    this.emitter.once(event, handler)
  }

  removeAllListeners(event?: string) {
    this.emitter.removeAllListeners(event)
  }
}

export const Events = {
  // Navigation
  VIEW_CHANGE: 'view:change',
  SIDEBAR_TOGGLE: 'sidebar:toggle',

  // Providers
  PROVIDER_CONNECT: 'provider:connect',
  PROVIDER_DISCONNECT: 'provider:disconnect',
  MODEL_SELECT: 'model:select',

  // Agents
  AGENT_CHANGE: 'agent:change',

  // Theme
  THEME_CHANGE: 'theme:change',

  // Chat
  MESSAGE_SEND: 'message:send',
  CHAT_SCROLL: 'chat:scroll',

  // Streaming
  STREAM_START: 'stream:start',
  STREAM_CHUNK: 'stream:chunk',
  STREAM_END: 'stream:end',

  // Command palette
  COMMAND_PALETTE_TOGGLE: 'command-palette:toggle',

  // Modal
  MODAL_OPEN: 'modal:open',
  MODAL_CLOSE: 'modal:close',

  // Toast
  TOAST_SHOW: 'toast:show',
  TOAST_DISMISS: 'toast:dismiss',

  // State
  STATE_CHANGE: 'state:change',

  // Intelligence
  INTELLIGENCE_UPDATE: 'intelligence:update',

  // Slash commands
  SLASH_COMMAND: 'slash:command',

  // Indexing
  INDEX_START: 'index:start',
  INDEX_PROGRESS: 'index:progress',
  INDEX_COMPLETE: 'index:complete',

  // File Explorer
  FILE_EXPLORER_TOGGLE: 'file-explorer:toggle',
  FILE_EXPLORER_OPEN: 'file-explorer:open',
  FILE_EXPLORER_CLOSE: 'file-explorer:close',

  // Diff Viewer
  DIFF_TOGGLE: 'diff:toggle',
  DIFF_OPEN: 'diff:open',
  DIFF_CLOSE: 'diff:close',
  DIFF_SET: 'diff:set',

  // Session Timeline
  SESSION_TIMELINE_TOGGLE: 'session-timeline:toggle',

  // Onboarding
  ONBOARDING_COMPLETE: 'onboarding:complete',

  // App lifecycle
  APP_QUIT: 'app:quit',
} as const

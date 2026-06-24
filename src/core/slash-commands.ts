import { SlashCommand } from './types.js'

export const SLASH_COMMANDS: SlashCommand[] = [
  // Agents
  { id: 'plan', category: 'Agents', label: 'Plan Agent', description: 'Switch to planning mode', icon: '📋' },
  { id: 'build', category: 'Agents', label: 'Build Agent', description: 'Switch to build mode', icon: '🔨' },
  { id: 'review', category: 'Agents', label: 'Review Agent', description: 'Switch to review mode', icon: '🔍' },
  { id: 'debug', category: 'Agents', label: 'Debug Agent', description: 'Switch to debug mode', icon: '🐛' },
  { id: 'research', category: 'Agents', label: 'Research Agent', description: 'Switch to research mode', icon: '📚' },
  { id: 'test', category: 'Agents', label: 'Test Agent', description: 'Switch to test mode', icon: '✅' },

  // Models
  { id: 'model', category: 'Models', label: 'Select Model', description: 'Choose a different model', icon: '🤖' },
  { id: 'model-list', category: 'Models', label: 'List Models', description: 'Show available models', icon: '📋' },

  // Providers
  { id: 'providers', category: 'Providers', label: 'Provider Status', description: 'Show provider status', icon: '🔌' },
  { id: 'connect', category: 'Providers', label: 'Connect Provider', description: 'Add a new provider', icon: '➕' },

  // Sessions
  { id: 'sessions', category: 'Sessions', label: 'List Sessions', description: 'Show saved sessions', icon: '💾' },
  { id: 'session-save', category: 'Sessions', label: 'Save Session', description: 'Save current session', icon: '💾' },
  { id: 'session-clear', category: 'Sessions', label: 'Clear Chat', description: 'Clear chat history', icon: '🗑️' },

  // Memory
  { id: 'memory', category: 'Memory', label: 'Memory Status', description: 'Show memory status', icon: '🧠' },
  { id: 'memory-add', category: 'Memory', label: 'Add Memory', description: 'Add a memory entry', icon: '➕' },

  // Themes
  { id: 'theme', category: 'Themes', label: 'Change Theme', description: 'Switch theme', icon: '🎨' },
  { id: 'theme-midnight', category: 'Themes', label: 'Midnight Theme', description: 'Dark blue theme', icon: '🌙' },
  { id: 'theme-light', category: 'Themes', label: 'Light Theme', description: 'Light theme', icon: '☀️' },

  // Settings
  { id: 'settings', category: 'Settings', label: 'Open Settings', description: 'Open settings panel', icon: '⚙️' },
  { id: 'config', category: 'Settings', label: 'Show Config', description: 'Display current config', icon: '📄' },

  // Help
  { id: 'help', category: 'Help', label: 'Help', description: 'Show help information', icon: '❓' },
  { id: 'quit', category: 'Help', label: 'Quit', description: 'Exit Loom', icon: '🚪' },
]

export function getCommandsByCategory(): Map<string, SlashCommand[]> {
  const map = new Map<string, SlashCommand[]>()
  for (const cmd of SLASH_COMMANDS) {
    const list = map.get(cmd.category) || []
    list.push(cmd)
    map.set(cmd.category, list)
  }
  return map
}

import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import http from 'node:http'
import { workspaceLayout } from '../workspace/workspace.js'
import { loadConfig } from '../config/loader.js'
import type { ProviderKey } from './types.js'

export interface IndexMetrics {
  filesIndexed: number
  symbols: number
  dependencies: number
  languages: string[]
}

export interface ProviderStatus {
  key: ProviderKey
  name: string
  status: 'online' | 'offline' | 'api-key-missing' | 'models-available'
  modelsAvailable: number
  configured: boolean
  hasApiKey: boolean
}

export interface AgentInfo {
  name: string
  codename: string
  status: 'idle' | 'running' | 'online'
  description: string
}

export interface SystemComponent {
  name: string
  status: 'online' | 'offline' | 'active' | 'standby'
}

export interface ActivityItem {
  text: string
  time: string
  type: 'success' | 'info' | 'warning'
}

export interface DashboardData {
  workspaceRoot: string
  workspaceName: string
  gitBranch: string
  currentMode: string
  activeTheme: string
  currentAgent: string
  activeProvider: string
  activeModel: string

  indexMetrics: IndexMetrics
  healthStatus: {
    indexer: 'online' | 'offline' | 'standby'
    graph: 'online' | 'offline' | 'standby'
    memory: 'online' | 'offline' | 'standby'
    lastScan: string
  }
  activityFeed: ActivityItem[]
  providers: ProviderStatus[]

  agents: AgentInfo[]

  suggestions: string[]
}

function fileExists(p: string): boolean {
  try { return fs.existsSync(p) } catch { return false }
}

function readJsonSafe(p: string): any {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

function getGitBranch(cwd: string): string {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', {
      cwd,
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
  } catch {
    return 'detached'
  }
}

function countLanguages(files: { language: string }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const f of files) {
    const lang = f.language || 'unknown'
    counts[lang] = (counts[lang] || 0) + 1
  }
  return counts
}

function getEnvKeyStatus(provider: ProviderKey): { hasKey: boolean; keyName: string } {
  const keyMap: Record<ProviderKey, string[]> = {
    openrouter: ['OPENROUTER_API_KEY'],
    gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    groq: ['GROQ_API_KEY'],
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    ollama: [],
  }
  const envNames = keyMap[provider] || []
  for (const name of envNames) {
    if (process.env[name] && process.env[name]!.length > 0) {
      return { hasKey: true, keyName: name }
    }
  }
  return { hasKey: false, keyName: envNames[0] || '' }
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

export function gatherDashboardData(cwd: string): DashboardData {
  const layout = workspaceLayout(cwd)
  const { config } = loadConfig(cwd)

  // ── Git branch ──
  const gitBranch = getGitBranch(cwd)

  // ── Index metrics ──
  const symbolsPath = path.join(layout.loomDir, 'symbols.json')
  const graphPath = path.join(layout.loomDir, 'graph.json')
  const symbolsData = readJsonSafe(symbolsPath)
  const graphData = readJsonSafe(graphPath)

  let indexMetrics: IndexMetrics = { filesIndexed: 0, symbols: 0, dependencies: 0, languages: [] }

  if (symbolsData && Array.isArray(symbolsData.files)) {
    const files = symbolsData.files
    const allSymbols = symbolsData.symbols || []
    indexMetrics.filesIndexed = files.length
    indexMetrics.symbols = allSymbols.length
    const langCounts = countLanguages(files)
    indexMetrics.languages = Object.keys(langCounts).sort((a, b) => langCounts[b] - langCounts[a])
  }

  if (graphData && Array.isArray(graphData.edges)) {
    indexMetrics.dependencies = graphData.edges.length
  } else if (symbolsData) {
    // Count dependencies from file data
    let depCount = 0
    for (const f of (symbolsData.files || [])) {
      depCount += (f.dependencies || []).length
    }
    indexMetrics.dependencies = depCount
  }

  // ── Index age ──
  let lastScanTime = 0
  if (symbolsData?.generatedAt) {
    lastScanTime = new Date(symbolsData.generatedAt).getTime()
  }
  const lastScan = lastScanTime > 0 ? formatTimeAgo(lastScanTime) : 'never'

  // ── Memory status ──
  let memoryActive = false
  if (fileExists(layout.memoryFile)) {
    try {
      const mem = JSON.parse(fs.readFileSync(layout.memoryFile, 'utf8'))
      memoryActive = (mem.notes?.length > 0) || (mem.summaries?.length > 0)
    } catch { /* ignore */ }
  }

  // ── Provider statuses ──
  const providerDefs: { key: ProviderKey; name: string }[] = [
    { key: 'openrouter', name: 'OpenRouter' },
    { key: 'gemini', name: 'Gemini' },
    { key: 'groq', name: 'Groq' },
    { key: 'openai', name: 'OpenAI' },
    { key: 'anthropic', name: 'Anthropic' },
    { key: 'ollama', name: 'Ollama' },
  ]

  const providers: ProviderStatus[] = providerDefs.map(({ key, name }) => {
    const configured = !!(config.providers?.[key] || config.providerEndpoints?.[key])
    const { hasKey } = getEnvKeyStatus(key)

    let status: ProviderStatus['status'] = 'offline'
    if (key === 'ollama') {
      try {
        const script = Buffer.from("require('http').get('http://127.0.0.1:11434/api/tags',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))").toString('base64')
        execSync(`node -e "eval(Buffer.from('${script}','base64').toString())"`, {
          encoding: 'utf8',
          timeout: 3000,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        status = 'online'
      } catch {
        status = 'offline'
      }
      if (configured) status = status === 'online' ? 'online' : 'offline'
    } else if (configured && hasKey) {
      status = 'models-available'
    } else if (configured && !hasKey) {
      status = 'api-key-missing'
    }

    return {
      key,
      name,
      status,
      modelsAvailable: 0,
      configured,
      hasApiKey: hasKey,
    }
  })

  // ── Activity feed ──
  const activityFeed: ActivityItem[] = []
  if (indexMetrics.filesIndexed > 0) {
    activityFeed.push({ text: `Index complete (${indexMetrics.filesIndexed} files)`, time: lastScan, type: 'success' })
  }
  if (indexMetrics.dependencies > 0) {
    activityFeed.push({ text: `Graph complete (${indexMetrics.dependencies} deps)`, time: lastScan, type: 'success' })
  }
  if (memoryActive) {
    activityFeed.push({ text: 'Memory sync', time: 'active', type: 'info' })
  }
  const onlineProviders = providers.filter(p => p.status === 'online' || p.status === 'models-available')
  if (onlineProviders.length > 0) {
    activityFeed.push({ text: `Provider discovery (${onlineProviders.length} online)`, time: 'active', type: 'info' })
  }

  // ── Agents ──
  const agents: AgentInfo[] = [
    { name: 'Gordian', codename: 'gordian', status: 'idle', description: 'Architecture & design' },
    { name: 'Ananke', codename: 'ananke', status: 'idle', description: 'Planning & strategy' },
    { name: 'Clotho', codename: 'clotho', status: 'idle', description: 'Code generation' },
  ]

  // ── Suggestions ──
  const suggestions = [
    'Explain the codebase structure',
    'Find and fix potential bugs',
    'Add comprehensive error handling',
    'Optimize performance bottlenecks',
    'Write unit tests for core modules',
  ]

  return {
    workspaceRoot: cwd,
    workspaceName: path.basename(cwd),
    gitBranch,
    currentMode: 'auto',
    activeTheme: 'midnight',
    currentAgent: 'build',
    activeProvider: 'none',
    activeModel: 'none',

    indexMetrics,
    healthStatus: {
      indexer: indexMetrics.filesIndexed > 0 ? 'online' : 'standby',
      graph: indexMetrics.dependencies > 0 ? 'online' : 'standby',
      memory: memoryActive ? 'online' : 'standby',
      lastScan,
    },
    activityFeed,
    providers,

    agents,
    suggestions,
  }
}

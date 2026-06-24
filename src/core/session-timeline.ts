import fs from 'node:fs'
import path from 'node:path'
import type { SessionInfo } from './types.js'

const SESSION_DIR = '.loom/sessions'

function getSessionDir(cwd: string): string {
  return path.join(cwd, SESSION_DIR)
}

export function loadSessions(cwd: string): SessionInfo[] {
  const sessionDir = getSessionDir(cwd)
  const sessions: SessionInfo[] = []

  try {
    if (!fs.existsSync(sessionDir)) return sessions

    const files = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'))

    for (const file of files) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(sessionDir, file), 'utf8'))
        sessions.push({
          id: data.id || file.replace('.json', ''),
          summary: data.summary || data.messages?.[0]?.content?.slice(0, 60) || 'New session',
          messageCount: data.messages?.length || 0,
          createdAt: data.createdAt || Date.now(),
          agent: data.agent || 'build',
        })
      } catch { /* skip corrupt files */ }
    }
  } catch { /* ignore */ }

  // Sort by creation time, newest first
  sessions.sort((a, b) => b.createdAt - a.createdAt)

  return sessions.slice(0, 20) // Keep last 20 sessions
}

export function saveSession(cwd: string, session: {
  id: string
  messages: any[]
  agent: string
  summary?: string
}): void {
  const sessionDir = getSessionDir(cwd)

  try {
    fs.mkdirSync(sessionDir, { recursive: true })
    const data = {
      ...session,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    fs.writeFileSync(
      path.join(sessionDir, `${session.id}.json`),
      JSON.stringify(data, null, 2),
      'utf8'
    )
  } catch { /* ignore write errors */ }
}

export function formatSessionTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

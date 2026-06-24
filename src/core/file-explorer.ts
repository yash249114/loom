import fs from 'node:fs'
import path from 'node:path'
import type { FileNode } from './types.js'

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.loom', 'dist', 'build',
  '.next', '.nuxt', 'coverage', '__pycache__', '.cache',
])

const IGNORED_FILES = new Set([
  '.DS_Store', 'Thumbs.db', '.env.local', '.env.production',
])

export function buildFileTree(rootDir: string, maxDepth: number = 4): FileNode[] {
  const entries: FileNode[] = []

  try {
    const items = fs.readdirSync(rootDir, { withFileTypes: true })

    // Sort: directories first, then files, alphabetically
    const sorted = items.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

    for (const item of sorted) {
      if (IGNORED_DIRS.has(item.name)) continue
      if (IGNORED_FILES.has(item.name)) continue
      if (item.name.startsWith('.') && item.name !== '.env.example') continue

      const fullPath = path.join(rootDir, item.name)
      const relativePath = path.relative(rootDir, fullPath)

      if (item.isDirectory()) {
        if (maxDepth > 0) {
          const children = buildFileTree(fullPath, maxDepth - 1)
          if (children.length > 0) {
            entries.push({
              name: item.name,
              path: relativePath,
              type: 'directory',
              children,
            })
          }
        } else {
          entries.push({
            name: item.name,
            path: relativePath,
            type: 'directory',
          })
        }
      } else {
        let size = 0
        try {
          const stat = fs.statSync(fullPath)
          size = stat.size
        } catch { /* ignore */ }

        entries.push({
          name: item.name,
          path: relativePath,
          type: 'file',
          size,
        })
      }
    }
  } catch { /* ignore read errors */ }

  return entries
}

export function flattenFileTree(nodes: FileNode[], depth: number = 0): { node: FileNode; depth: number }[] {
  const result: { node: FileNode; depth: number }[] = []
  for (const node of nodes) {
    result.push({ node, depth })
    if (node.children) {
      result.push(...flattenFileTree(node.children, depth + 1))
    }
  }
  return result
}

export function getFileIcon(node: FileNode): string {
  if (node.type === 'directory') {
    return node.children && node.children.length > 0 ? '▶' : '▷'
  }

  const ext = path.extname(node.name).toLowerCase()
  const iconMap: Record<string, string> = {
    '.ts': 'TS', '.tsx': 'TX', '.js': 'JS', '.jsx': 'JX',
    '.py': 'PY', '.go': 'GO', '.rs': 'RS', '.rb': 'RB',
    '.java': 'JV', '.cs': 'CS', '.cpp': 'C+', '.c': 'C ',
    '.h': 'H ', '.hpp': 'H+',
    '.json': '{}', '.yaml': 'YML', '.yml': 'YML', '.toml': 'TML',
    '.md': 'MD', '.txt': 'TX', '.log': 'LG',
    '.css': 'CS', '.scss': 'SC', '.html': 'HT', '.htm': 'HT',
    '.svg': 'SV', '.png': 'IM', '.jpg': 'IM', '.gif': 'IM',
    '.lock': 'LK', '.env': 'EN',
  }

  return iconMap[ext] || '  '
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

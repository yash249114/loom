import type { DiffLine } from './types.js'

export function parseDiff(diffText: string): DiffLine[] {
  const lines = diffText.split('\n')
  const result: DiffLine[] = []

  for (const line of lines) {
    if (line.startsWith('@@')) {
      result.push({ type: 'header', content: line })
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      result.push({ type: 'add', content: line.slice(1) })
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      result.push({ type: 'remove', content: line.slice(1) })
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      result.push({ type: 'header', content: line })
    } else if (line.startsWith(' ')) {
      result.push({ type: 'context', content: line.slice(1) })
    } else {
      result.push({ type: 'context', content: line })
    }
  }

  return result
}

export function generateDiff(
  oldLines: string[],
  newLines: string[],
  oldFile: string,
  newFile: string
): DiffLine[] {
  const result: DiffLine[] = []

  result.push({ type: 'header', content: `--- ${oldFile}` })
  result.push({ type: 'header', content: `+++ ${newFile}` })

  // Simple line-by-line diff (LCS-based would be better but this is sufficient)
  const maxLen = Math.max(oldLines.length, newLines.length)
  let oldLine = 1
  let newLine = 1

  for (let i = 0; i < maxLen; i++) {
    const old = oldLines[i]
    const new_ = newLines[i]

    if (old === undefined) {
      result.push({ type: 'add', content: new_ || '', newLine: newLine++ })
    } else if (new_ === undefined) {
      result.push({ type: 'remove', content: old, oldLine: oldLine++ })
    } else if (old === new_) {
      result.push({ type: 'context', content: old, oldLine: oldLine++, newLine: newLine++ })
    } else {
      result.push({ type: 'remove', content: old, oldLine: oldLine++ })
      result.push({ type: 'add', content: new_, newLine: newLine++ })
    }
  }

  return result
}

export function renderDiffLine(line: DiffLine, w: number, colors: {
  addBg: string
  removeBg: string
  headerFg: string
  contextFg: string
  lineNumFg: string
}): string {
  const prefix = line.type === 'add' ? '+ ' : line.type === 'remove' ? '- ' : '  '
  const lineNum = line.type === 'add'
    ? ` ${String(line.newLine || '').padStart(4)} `
    : line.type === 'remove'
      ? ` ${String(line.oldLine || '').padStart(4)} `
      : '      '

  const content = prefix + line.content
  const display = (lineNum + content).padEnd(w).substring(0, w)

  return display
}

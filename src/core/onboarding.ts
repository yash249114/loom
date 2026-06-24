import fs from 'node:fs'
import path from 'node:path'

const ONBOARDING_FILE = '.loom/.onboarding-complete'

export function isOnboardingComplete(cwd: string): boolean {
  try {
    return fs.existsSync(path.join(cwd, ONBOARDING_FILE))
  } catch {
    return false
  }
}

export function markOnboardingComplete(cwd: string): void {
  try {
    const dir = path.join(cwd, '.loom')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(path.join(cwd, ONBOARDING_FILE), new Date().toISOString(), 'utf8')
  } catch { /* ignore */ }
}

export interface OnboardingStep {
  title: string
  content: string
  highlight?: string
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'Welcome to Loom',
    content: 'A repository-aware AI coding workspace.\nType anything to get started.',
  },
  {
    title: 'Chat with AI',
    content: 'Just type your message and press Enter.\nThe AI will understand your codebase.',
    highlight: 'Try: "Explain this codebase"',
  },
  {
    title: 'Slash Commands',
    content: 'Type / to see available commands.\nSwitch agents, themes, and more.',
    highlight: 'Type: /',
  },
  {
    title: 'Command Palette',
    content: 'Press Ctrl+K to open the command palette.\nSearch for any action.',
    highlight: 'Press: Ctrl+K',
  },
  {
    title: 'Keyboard Shortcuts',
    content: '↑/↓  Scroll chat history\n/    Slash commands\nCtrl+K  Command palette\nEsc  Back / Quit',
  },
]

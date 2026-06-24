import { Theme, ThemeColors } from './types.js'
import { midnightTheme } from './themes/midnight.js'
import { nordTheme } from './themes/nord.js'
import { catppuccinTheme } from './themes/catppuccin.js'
import { tokyoNightTheme } from './themes/tokyo-night.js'
import { cyberpunkTheme } from './themes/cyberpunk.js'
import { matrixTheme } from './themes/matrix.js'

export class ThemeManager {
  private themes: Map<string, Theme> = new Map()
  private currentTheme: Theme
  private listeners: ((theme: Theme) => void)[] = []

  constructor() {
    this.registerThemes()
    this.currentTheme = midnightTheme
  }

  private registerThemes() {
    const themes = [
      midnightTheme,
      nordTheme,
      catppuccinTheme,
      tokyoNightTheme,
      cyberpunkTheme,
      matrixTheme
    ]
    
    for (const theme of themes) {
      this.themes.set(theme.id, theme)
    }
  }

  getTheme(): Theme {
    return this.currentTheme
  }

  getColors(): ThemeColors {
    return this.currentTheme.colors
  }

  setTheme(themeId: string): boolean {
    const theme = this.themes.get(themeId)
    if (!theme) return false
    
    this.currentTheme = theme
    this.notifyListeners()
    return true
  }

  getAvailableThemes(): Theme[] {
    return Array.from(this.themes.values())
  }

  onChange(listener: (theme: Theme) => void) {
    this.listeners.push(listener)
  }

  private notifyListeners() {
    this.listeners.forEach(l => l(this.currentTheme))
  }
}

export * from './types.js'
export { midnightTheme }
export { nordTheme }
export { catppuccinTheme }
export { tokyoNightTheme }
export { cyberpunkTheme }
export { matrixTheme }

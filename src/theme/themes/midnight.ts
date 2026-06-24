import { Theme } from '../types.js'

export const midnightTheme: Theme = {
  id: 'midnight',
  name: 'Midnight',
  colors: {
    background: {
      primary: '#0d1117',
      secondary: '#161b22',
      tertiary: '#21262d'
    },
    text: {
      primary: '#f0f6fc',
      secondary: '#8b949e',
      tertiary: '#6e7681'
    },
    border: {
      default: '#30363d',
      focus: '#58a6ff'
    },
    accent: {
      primary: '#58a6ff',
      secondary: '#bc8cff'
    },
    status: {
      success: '#3fb950',
      warning: '#d29922',
      error: '#f85149',
      info: '#58a6ff'
    }
  }
}

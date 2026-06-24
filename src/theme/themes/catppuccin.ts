import { Theme } from '../types.js'

export const catppuccinTheme: Theme = {
  id: 'catppuccin',
  name: 'Catppuccin',
  colors: {
    background: {
      primary: '#1e1e2e',
      secondary: '#181825',
      tertiary: '#313244'
    },
    text: {
      primary: '#cdd6f4',
      secondary: '#a6adc8',
      tertiary: '#6c7086'
    },
    border: {
      default: '#45475a',
      focus: '#89b4fa'
    },
    accent: {
      primary: '#89b4fa',
      secondary: '#cba6f7'
    },
    status: {
      success: '#a6e3a1',
      warning: '#f9e2af',
      error: '#f38ba8',
      info: '#89dceb'
    }
  }
}

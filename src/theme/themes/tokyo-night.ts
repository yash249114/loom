import { Theme } from '../types.js'

export const tokyoNightTheme: Theme = {
  id: 'tokyo-night',
  name: 'Tokyo Night',
  colors: {
    background: {
      primary: '#1a1b26',
      secondary: '#16161e',
      tertiary: '#24283b'
    },
    text: {
      primary: '#c0caf5',
      secondary: '#a9b1d6',
      tertiary: '#565f89'
    },
    border: {
      default: '#292e42',
      focus: '#7aa2f7'
    },
    accent: {
      primary: '#7aa2f7',
      secondary: '#bb9af7'
    },
    status: {
      success: '#9ece6a',
      warning: '#e0af68',
      error: '#f7768e',
      info: '#7dcfff'
    }
  }
}

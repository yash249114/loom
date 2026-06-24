import { Theme } from '../types.js'

export const cyberpunkTheme: Theme = {
  id: 'cyberpunk',
  name: 'Cyberpunk',
  colors: {
    background: {
      primary: '#0a0a0f',
      secondary: '#12121a',
      tertiary: '#1a1a25'
    },
    text: {
      primary: '#00ff9f',
      secondary: '#00b159',
      tertiary: '#006633'
    },
    border: {
      default: '#00ff9f33',
      focus: '#00ff9f'
    },
    accent: {
      primary: '#00ff9f',
      secondary: '#ff00ff'
    },
    status: {
      success: '#00ff9f',
      warning: '#ffff00',
      error: '#ff0040',
      info: '#00ffff'
    }
  }
}

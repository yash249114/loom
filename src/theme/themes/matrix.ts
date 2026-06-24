import { Theme } from '../types.js'

export const matrixTheme: Theme = {
  id: 'matrix',
  name: 'Matrix',
  colors: {
    background: {
      primary: '#000000',
      secondary: '#0a0a0a',
      tertiary: '#141414'
    },
    text: {
      primary: '#00ff00',
      secondary: '#00cc00',
      tertiary: '#009900'
    },
    border: {
      default: '#00ff0033',
      focus: '#00ff00'
    },
    accent: {
      primary: '#00ff00',
      secondary: '#00ff00'
    },
    status: {
      success: '#00ff00',
      warning: '#ffff00',
      error: '#ff0000',
      info: '#00ff00'
    }
  }
}

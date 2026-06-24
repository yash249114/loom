import { Theme } from '../types.js'

export const nordTheme: Theme = {
  id: 'nord',
  name: 'Nord',
  colors: {
    background: {
      primary: '#2e3440',
      secondary: '#3b4252',
      tertiary: '#434c5e'
    },
    text: {
      primary: '#eceff4',
      secondary: '#d8dee9',
      tertiary: '#a3b1c2'
    },
    border: {
      default: '#4c566a',
      focus: '#88c0d0'
    },
    accent: {
      primary: '#88c0d0',
      secondary: '#b48ead'
    },
    status: {
      success: '#a3be8c',
      warning: '#ebcb8b',
      error: '#bf616a',
      info: '#88c0d0'
    }
  }
}

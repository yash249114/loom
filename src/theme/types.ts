export interface ThemeColors {
  background: {
    primary: string
    secondary: string
    tertiary: string
  }
  text: {
    primary: string
    secondary: string
    tertiary: string
  }
  border: {
    default: string
    focus: string
  }
  accent: {
    primary: string
    secondary: string
  }
  status: {
    success: string
    warning: string
    error: string
    info: string
  }
}

export interface Theme {
  id: string
  name: string
  colors: ThemeColors
}

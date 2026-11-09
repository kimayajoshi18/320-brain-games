/*
 * Light/dark theme. The theme lives on <html data-theme="...">, which the CSS
 * tokens in styles/global.css key off. An inline script in index.html sets it
 * before first paint so there's no flash; this module keeps it in sync after.
 */

export type Theme = 'light' | 'dark'

/** localStorage key. Also used by the inline script in index.html. */
export const THEME_STORAGE_KEY = 'puzzlr-theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'
const listeners = new Set<() => void>()

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return typeof window.matchMedia === 'function' && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  listeners.forEach((listener) => listener())
}

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function setTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage can be unavailable (private mode); the theme still applies for this visit.
  }
  apply(theme)
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Applies the saved or system theme, and follows system changes until the player picks one. */
export function initTheme() {
  apply(storedTheme() ?? systemTheme())
  if (typeof window.matchMedia !== 'function') return
  window.matchMedia(DARK_QUERY).addEventListener('change', (event) => {
    if (!storedTheme()) apply(event.matches ? 'dark' : 'light')
  })
}

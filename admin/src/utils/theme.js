import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'adminTheme'
// Matches --bg in index.css for each resolved theme, so the OS status bar /
// PWA chrome blends with the actual page background.
const THEME_COLORS = { dark: '#090d16', light: '#f8fafc' }

export const THEME_OPTIONS = ['light', 'dark', 'system']

export function getSystemTheme() {
  return (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ? 'dark' : 'light'
}

export function getStoredThemePref() {
  const stored = localStorage.getItem(STORAGE_KEY)
  return THEME_OPTIONS.includes(stored) ? stored : 'dark'
}

export function resolveTheme(pref) {
  return pref === 'system' ? getSystemTheme() : pref
}

function setThemeColorMeta(resolved) {
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', THEME_COLORS[resolved] || THEME_COLORS.dark)
}

// Applies + persists a theme preference ('light' | 'dark' | 'system'),
// updating both the `data-theme` attribute (drives all CSS) and the
// <meta name="theme-color"> tag (drives browser/PWA chrome color).
export function applyThemePref(pref) {
  const resolved = resolveTheme(pref)
  document.documentElement.setAttribute('data-theme', resolved)
  setThemeColorMeta(resolved)
  localStorage.setItem(STORAGE_KEY, pref)
  return resolved
}

// Call once at app startup (before first paint) to avoid a flash of the wrong theme.
export function initTheme() {
  return applyThemePref(getStoredThemePref())
}

// Subscribes to OS-level light/dark changes. Returns an unsubscribe function.
export function watchSystemTheme(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {}
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handler = () => onChange(getSystemTheme())
  if (mq.addEventListener) mq.addEventListener('change', handler)
  else if (mq.addListener) mq.addListener(handler)
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', handler)
    else if (mq.removeListener) mq.removeListener(handler)
  }
}

// React hook giving components the current preference + resolved (actual)
// theme, and a setter that keeps everything (DOM, meta tag, storage) in sync.
export function useThemePref() {
  const [pref, setPrefState] = useState(getStoredThemePref)
  const [resolved, setResolved] = useState(() => resolveTheme(getStoredThemePref()))

  useEffect(() => {
    const unsub = watchSystemTheme(() => {
      setPrefState(current => {
        if (current === 'system') setResolved(applyThemePref('system'))
        return current
      })
    })
    return unsub
  }, [])

  const setPref = useCallback(next => {
    const r = applyThemePref(next)
    setPrefState(next)
    setResolved(r)
  }, [])

  return { pref, resolved, setPref }
}

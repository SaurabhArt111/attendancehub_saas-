import { useState, useCallback, useRef, useEffect } from 'react'
import './Toaster.css'

const ICONS = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>
    </svg>
  ),
  warn: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  ),
}

const DURATION = 3400

let _addToast = null
export const toast = {
  success: (msg) => _addToast?.({ msg, type: 'success' }),
  error:   (msg) => _addToast?.({ msg, type: 'error' }),
  warn:    (msg) => _addToast?.({ msg, type: 'warn' }),
  info:    (msg) => _addToast?.({ msg, type: 'info' }),
}

export default function Toaster() {
  const [toasts, setToasts] = useState([])
  // dedup: track last msg+type to show count badge
  const lastRef = useRef({})

  _addToast = useCallback(({ msg, type }) => {
    const key = `${type}:${msg}`
    // If same toast already showing, bump count instead of adding new
    setToasts(prev => {
      const existing = prev.find(t => t.key === key && !t.exiting)
      if (existing) {
        return prev.map(t => t.key === key ? { ...t, count: (t.count || 1) + 1 } : t)
      }
      const id = Date.now() + Math.random()
      return [...prev, { id, key, msg, type, count: 1, exiting: false }]
    })
    // Auto-remove after duration
    const id = Date.now() + Math.random()
    setTimeout(() => {
      setToasts(prev => {
        // mark the matching key as exiting
        return prev.map(t => t.key === key && !t.exiting ? { ...t, exiting: true } : t)
      })
      setTimeout(() => {
        setToasts(prev => prev.filter(t => !(t.key === key && t.exiting)))
      }, 320)
    }, DURATION)
  }, [])

  function dismiss(key) {
    setToasts(prev => prev.map(t => t.key === key ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.key !== key)), 320)
  }

  // Mobile swipe-to-dismiss
  function handleTouchStart(e, key) {
    const t = e.currentTarget
    t._touchStartY = e.touches[0].clientY
    t._touchStartX = e.touches[0].clientX
  }

  function handleTouchMove(e, key) {
    const t = e.currentTarget
    const dy = e.touches[0].clientY - t._touchStartY
    const dx = e.touches[0].clientX - t._touchStartX
    const isMobile = window.innerWidth <= 768
    if (isMobile) {
      // swipe up to dismiss on mobile
      if (dy < -10) t.style.transform = `translateY(${dy}px)`
    } else {
      // swipe right to dismiss on desktop
      if (dx > 10) t.style.transform = `translateX(${dx}px)`
    }
  }

  function handleTouchEnd(e, key) {
    const t = e.currentTarget
    const dy = e.changedTouches[0].clientY - t._touchStartY
    const dx = e.changedTouches[0].clientX - t._touchStartX
    const isMobile = window.innerWidth <= 768
    if ((isMobile && dy < -50) || (!isMobile && Math.abs(dx) > 60)) {
      dismiss(key)
    } else {
      t.style.transform = ''
    }
  }

  return (
    <div className="toast-wrap" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.type}${t.exiting ? ' toast-exit' : ''}`}
          style={{ '--toast-dur': `${DURATION}ms` }}
          onTouchStart={e => handleTouchStart(e, t.key)}
          onTouchMove={e => handleTouchMove(e, t.key)}
          onTouchEnd={e => handleTouchEnd(e, t.key)}
          role="alert"
        >
          <span className="toast-icon">{ICONS[t.type]}</span>
          <span className="toast-msg">{t.msg}</span>
          {t.count > 1 && <span className="toast-badge">×{t.count}</span>}
          <button className="toast-close" onClick={() => dismiss(t.key)} aria-label="Dismiss">✕</button>
          <div className="toast-progress" />
        </div>
      ))}
    </div>
  )
}

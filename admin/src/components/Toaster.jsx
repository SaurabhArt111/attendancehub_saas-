import { useState, useCallback, useRef } from 'react'
import './Toaster.css'

let _addToast = null

export const toast = {
  success: (msg) => _addToast?.({ msg, type: 'success' }),
  error:   (msg) => _addToast?.({ msg, type: 'error' }),
  info:    (msg) => _addToast?.({ msg, type: 'info' }),
  warning: (msg) => _addToast?.({ msg, type: 'warning' }),
}

export default function Toaster() {
  const [toasts, setToasts] = useState([])
  const touchStart = useRef({})

  _addToast = useCallback(t => {
    const id = Date.now()
    setToasts(p => [...p, { ...t, id }])
    setTimeout(() => removeToast(id), 3500)
  }, [])

  const removeToast = (id) => {
    setToasts(p => p.filter(x => x.id !== id))
  }

  const handleTouchStart = (e, id) => {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      id
    }
  }

  const handleTouchEnd = (e, id) => {
    const { x, y } = touchStart.current
    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    
    const diffX = Math.abs(endX - x)
    const diffY = Math.abs(endY - y)
    
    // Swipe threshold: 80px
    if (diffX > 80 || diffY > 80) {
      removeToast(id)
    }
    
    touchStart.current = {}
  }

  return (
    <div className="toast-wrap">
      {toasts.map((t, idx) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          style={{ '--order': idx }}
          onTouchStart={(e) => handleTouchStart(e, t.id)}
          onTouchEnd={(e) => handleTouchEnd(e, t.id)}
        >
          <div className="toast-icon">
            {t.type === 'success' && <SuccessIcon />}
            {t.type === 'error' && <ErrorIcon />}
            {t.type === 'warning' && <WarningIcon />}
            {t.type === 'info' && <InfoIcon />}
          </div>
          <div className="toast-content">
            <p className="toast-msg">{t.msg}</p>
          </div>
          <button
            className="toast-close"
            onClick={() => removeToast(t.id)}
            aria-label="Close notification"
          >
            <CloseIcon />
          </button>
          <div className="toast-progress"></div>
        </div>
      ))}
    </div>
  )
}

function SuccessIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12"></polyline>
      <circle cx="12" cy="12" r="10"></circle>
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
      <line x1="12" y1="9" x2="12" y2="13"></line>
      <line x1="12" y1="17" x2="12.01" y2="17"></line>
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="16" x2="12" y2="12"></line>
      <line x1="12" y1="8" x2="12.01" y2="8"></line>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  )
}
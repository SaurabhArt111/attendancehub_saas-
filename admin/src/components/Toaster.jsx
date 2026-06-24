import { useState, useCallback } from 'react'
import './Toaster.css'

let toastId = 0
const callbacks = {}

export const toast = {
  success: (message) => {
    const id = toastId++
    callbacks.onToast?.({ id, type: 'success', message })
  },
  error: (message) => {
    const id = toastId++
    callbacks.onToast?.({ id, type: 'error', message })
  },
  info: (message) => {
    const id = toastId++
    callbacks.onToast?.({ id, type: 'info', message })
  },
  warning: (message) => {
    const id = toastId++
    callbacks.onToast?.({ id, type: 'warning', message })
  }
}

export default function Toaster() {
  const [toasts, setToasts] = useState([])

  callbacks.onToast = useCallback((toast) => {
    const id = toast.id
    setToasts(prev => [...prev, toast])
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  return (
    <div className="toaster-container">
      {toasts.map(t => (
        <Toast
          key={t.id}
          type={t.type}
          message={t.message}
          onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
        />
      ))}
    </div>
  )
}

function Toast({ type, message, onClose }) {
  return (
    <div className={`toast toast-${type} slide-in`}>
      <div className="toast-content">
        {getIcon(type)}
        <span>{message}</span>
      </div>
      <button className="toast-close" onClick={onClose} aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function getIcon(type) {
  const icons = {
    success: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" />
        <line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    info: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    warning: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  }
  return icons[type] || null
}
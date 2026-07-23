import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import api from '../utils/api'

const PendingLoginContext = createContext(null)

// Provides the list of pending "new device wants to sign in" requests for the
// current admin, and keeps it fresh by:
//  - checking once on mount (so it can pop up as soon as the app is opened)
//  - polling periodically while the app stays open
//  - re-checking immediately whenever the tab regains focus/visibility
//  - re-checking immediately when the service worker relays a push message
export function PendingLoginProvider({ children }) {
  const [requests, setRequests] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const pollRef = useRef(null)

  const checkNow = useCallback(async ({ openIfFound = true } = {}) => {
    try {
      const { data } = await api.get('/admin/pending-login/check')
      setRequests(data)
      if (openIfFound && data.length > 0) setModalOpen(true)
      return data
    } catch {
      return []
    }
  }, [])

  useEffect(() => {
    checkNow()
    pollRef.current = window.setInterval(() => checkNow(), 20000)

    function onVisible() {
      if (document.visibilityState === 'visible') checkNow()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)

    return () => {
      window.clearInterval(pollRef.current)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [checkNow])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function onMessage(event) {
      if (event.data?.type === 'NEW_SESSION_PUSH') checkNow()
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [checkNow])

  const approve = useCallback(async (id, code) => {
    await api.post(`/admin/pending-login/${id}/approve`, { code })
    return checkNow({ openIfFound: false })
  }, [checkNow])

  const deny = useCallback(async (id) => {
    await api.post(`/admin/pending-login/${id}/deny`)
    return checkNow({ openIfFound: false })
  }, [checkNow])

  // Used by the "Login Code for Another Session" button in Settings — always
  // opens the modal, even if there's currently nothing pending, so the admin
  // gets clear feedback either way.
  const openManual = useCallback(async () => {
    await checkNow({ openIfFound: false })
    setModalOpen(true)
  }, [checkNow])

  return (
    <PendingLoginContext.Provider value={{ requests, modalOpen, setModalOpen, approve, deny, openManual, checkNow }}>
      {children}
    </PendingLoginContext.Provider>
  )
}

export function usePendingLogin() {
  const ctx = useContext(PendingLoginContext)
  if (!ctx) throw new Error('usePendingLogin must be used within a PendingLoginProvider')
  return ctx
}

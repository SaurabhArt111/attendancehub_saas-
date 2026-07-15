import { useEffect, useState, useCallback } from 'react'

/**
 * Hook to handle PWA updates from service worker
 * Shows a notification when a new version is available
 * Automatically reloads the page when user accepts
 */
export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleUpdate = (reg) => {
      const interval = window.setInterval(() => {
        reg.update().catch(() => undefined)
      }, 60000)

      return () => window.clearInterval(interval)
    }

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing

          if (!newWorker) return

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true)
              setRegistration(reg)
            }
          })
        })

        handleUpdate(reg)
      })
    })
  }, [])

  const acceptUpdate = useCallback(() => {
    const finishUpdate = () => {
      setUpdateAvailable(false)
      window.setTimeout(() => {
        window.location.reload()
      }, 250)
    }

    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      finishUpdate()
      return
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) {
          finishUpdate()
          return
        }

        reg.update().then(() => finishUpdate()).catch(() => finishUpdate())
      }).catch(() => finishUpdate())
      return
    }

    finishUpdate()
  }, [registration])

  const dismissUpdate = useCallback(() => {
    setUpdateAvailable(false)
  }, [])

  return {
    updateAvailable,
    acceptUpdate,
    dismissUpdate
  }
}

/**
 * Hook to prompt for installation on supported devices
 */
export function usePWAInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isAndroid, setIsAndroid] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    const ua = window.navigator.userAgent
    setIsIOS(/iPad|iPhone|iPod/.test(ua))
    setIsAndroid(/Android/.test(ua))

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!installPrompt) return

    try {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice

      if (outcome === 'accepted') {
        setInstallPrompt(null)
        setIsInstalled(true)
      } else {
        setInstallPrompt(null)
      }
    } catch (error) {
      console.warn('PWA install prompt failed:', error)
      setInstallPrompt(null)
    }
  }, [installPrompt])

  const dismissInstallPrompt = useCallback(() => {
    setInstallPrompt(null)
  }, [])

  return {
    canInstall: !!installPrompt && !isInstalled,
    isIOS,
    isAndroid,
    isInstalled,
    promptInstall,
    dismissInstallPrompt
  }
}

/**
 * Hook to check online/offline status
 */
export function usePWAOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

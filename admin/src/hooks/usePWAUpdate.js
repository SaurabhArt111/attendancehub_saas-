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
      // Check for updates periodically
      const interval = setInterval(() => {
        reg.update()
      }, 60000) // Check every minute

      return () => clearInterval(interval)
    }

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new service worker is ready
              setUpdateAvailable(true)
              setRegistration(reg)
              console.log('PWA update available')
            }
          })
        })

        handleUpdate(reg)
      })
    })
  }, [])

  const acceptUpdate = useCallback(() => {
    if (!registration?.waiting) return

    registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    setUpdateAvailable(false)

    // Reload after new worker takes control
    let reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloaded) {
        reloaded = true
        window.location.reload()
      }
    })
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
    // Check device type
    const ua = window.navigator.userAgent
    setIsIOS(/iPad|iPhone|iPod/.test(ua))
    setIsAndroid(/Android/.test(ua))

    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }

    // Listen for app installed event
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

    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice

    if (outcome === 'accepted') {
      setInstallPrompt(null)
      setIsInstalled(true)
    }
  }, [installPrompt])

  return {
    canInstall: !!installPrompt && !isInstalled,
    isIOS,
    isAndroid,
    isInstalled,
    promptInstall
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

import React from 'react'
import { usePWAUpdate, usePWAInstallPrompt, usePWAOnlineStatus } from '../hooks/usePWAUpdate'
import './PWAUpdatePrompt.css'

export default function PWAUpdatePrompt() {
  const { updateAvailable, acceptUpdate, dismissUpdate } = usePWAUpdate()
  const { canInstall, isIOS, promptInstall, dismissInstallPrompt } = usePWAInstallPrompt()
  const isOnline = usePWAOnlineStatus()

  const handleInstall = async () => {
    await promptInstall()
  }

  const handleDismissInstall = () => {
    dismissInstallPrompt()
  }

  return (
    <>
      {/* Update Available Notification */}
      {updateAvailable && (
        <div className="pwa-notification pwa-update-notification" role="alert">
          <div className="pwa-notification-content">
            <div className="pwa-notification-title">Update Available</div>
            <p className="pwa-notification-message">A new version of AttendanceHub is ready.</p>
          </div>
          <div className="pwa-notification-actions">
            <button
              onClick={dismissUpdate}
              className="pwa-btn pwa-btn-secondary"
              aria-label="Dismiss update notification"
            >
              Later
            </button>
            <button
              onClick={acceptUpdate}
              className="pwa-btn pwa-btn-primary"
              aria-label="Install update and reload"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {/* Install Prompt for Android and Desktop */}
      {canInstall && !isIOS && (
        <div className="pwa-notification pwa-install-notification" role="alert">
          <div className="pwa-notification-content">
            <div className="pwa-notification-title">Install App</div>
            <p className="pwa-notification-message">Install AttendanceHub on your device for quick access.</p>
          </div>
          <div className="pwa-notification-actions">
            <button
              onClick={handleDismissInstall}
              className="pwa-btn pwa-btn-secondary"
              aria-label="Dismiss install prompt"
            >
              No Thanks
            </button>
            <button
              onClick={handleInstall}
              className="pwa-btn pwa-btn-primary"
              aria-label="Install app"
            >
              Install
            </button>
          </div>
        </div>
      )}

      {/* iOS Install Instructions */}
      {isIOS && !updateAvailable && (
        <div className="pwa-notification pwa-ios-hint" role="complementary">
          <div className="pwa-notification-content">
            <div className="pwa-notification-title">Tip: Install on Home Screen</div>
            <p className="pwa-notification-message">
              Tap <span className="pwa-icon">⬆️</span> Share, then "Add to Home Screen"
            </p>
          </div>
          <div className="pwa-notification-actions">
            <button
              onClick={handleDismissInstall}
              className="pwa-btn pwa-btn-secondary"
              aria-label="Dismiss install tip"
            >
              No Thanks
            </button>
            <button
              onClick={handleInstall}
              className="pwa-btn pwa-btn-primary"
              aria-label="Install on iOS"
            >
              Install
            </button>
          </div>
        </div>
      )}

      {/* Offline Indicator */}
      {!isOnline && (
        <div className="pwa-notification pwa-offline-notification" role="alert">
          <div className="pwa-notification-content">
            <div className="pwa-notification-title">You're Offline</div>
            <p className="pwa-notification-message">Some features may be limited. Cached data is available.</p>
          </div>
        </div>
      )}
    </>
  )
}

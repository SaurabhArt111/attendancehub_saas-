import api from './api'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

// Registers this browser for push notifications (used for the "New session"
// alert when another device tries to sign in) and lets the backend know
// about the subscription. Safe to call repeatedly — it's a no-op once
// already subscribed. Requires the browser to support Push + a granted (or
// grantable) Notification permission; silently does nothing otherwise.
export async function ensurePushSubscription() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false
  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapidKey) return false
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'denied') return false

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission()
      if (permission !== 'granted') return false

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      })
    }

    await api.post('/admin/push/subscribe', { subscription: subscription.toJSON() })
    return true
  } catch (err) {
    console.warn('Push subscription failed:', err)
    return false
  }
}

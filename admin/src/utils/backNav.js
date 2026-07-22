import { useNavigate } from 'react-router-dom'

// useSmartBack(fallback) — returns a function that takes the user back to
// whichever page they actually came from (real app history), instead of a
// hard-coded destination. React Router's BrowserRouter stores a monotonically
// increasing `idx` on `window.history.state` for every entry it pushes, so an
// `idx > 0` means there really is a previous in-app page to return to. Falls
// back to `fallback` only when there's nowhere real to go back to — e.g. the
// page was opened directly, via a deep link, or from a push notification.
export function useSmartBack(fallback = '/employees') {
  const navigate = useNavigate()
  return () => {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1)
    } else {
      navigate(fallback)
    }
  }
}

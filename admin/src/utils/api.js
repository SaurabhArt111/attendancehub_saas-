import axios from 'axios'

const isProd = import.meta.env.VITE_NODE_ENV === 'production'
const baseURL = isProd
  ? (import.meta.env.VITE_API_URL || 'http://localhost:5900/api')
  : 'http://localhost:5900/api'

const api = axios.create({ baseURL })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('adminToken')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Sliding session: every authenticated response carries a freshly-signed JWT
// (fresh 30-day expiry) in the `x-new-token` header. Swap it into storage so
// the next request uses it — this is what keeps an active admin logged in
// indefinitely, while a genuinely idle session still expires naturally.
function captureRefreshedToken(response) {
  const fresh = response?.headers?.['x-new-token']
  if (fresh) localStorage.setItem('adminToken', fresh)
}

api.interceptors.response.use(
  r => { captureRefreshedToken(r); return r },
  err => {
    if (err.response) captureRefreshedToken(err.response)

    // These endpoints act on a *different* device's pending login. A failure
    // there (wrong/expired security key, already-handled request, etc.) is a
    // business-logic error about that other device, never a sign that this
    // device's own session/token is invalid — so it must never force this
    // device to log out.
    const isPendingLoginAction = /\/admin\/pending-login\/[^/]+\/(approve|deny)$/.test(err.config?.url || '')

    if (err.response?.status === 401 && !isPendingLoginAction && localStorage.getItem('adminToken')) {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
      if (window.location.pathname !== '/login') window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

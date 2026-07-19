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
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

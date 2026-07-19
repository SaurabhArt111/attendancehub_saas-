import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5900/api'

const api = axios.create({ baseURL })

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('employeeToken')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Sliding session: every authenticated response carries a freshly-signed JWT
// (fresh 30-day expiry) in the `x-new-token` header — swap it into storage so
// the next request uses it. Keeps an active employee logged in indefinitely;
// a genuinely idle session still expires naturally after 30 days.
function captureRefreshedToken(response) {
  const fresh = response?.headers?.['x-new-token']
  if (fresh) localStorage.setItem('employeeToken', fresh)
}

api.interceptors.response.use(
  res => { captureRefreshedToken(res); return res },
  err => {
    if (err.response) captureRefreshedToken(err.response)
    if (err.response?.status === 401) {
      localStorage.removeItem('employeeToken')
      localStorage.removeItem('employeeUser')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

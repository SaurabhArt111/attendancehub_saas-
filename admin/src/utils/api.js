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

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminUser')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

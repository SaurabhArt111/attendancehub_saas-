import axios from 'axios'

const baseURL =
  import.meta.env.VITE_API_URL ||
  'http://localhost:5900/api'

const api = axios.create({
  baseURL
})

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('employeeToken')

  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`
  }

  return cfg
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('employeeToken')
      localStorage.removeItem('employeeUser')
      window.location.href = '/login'
    }

    return Promise.reject(err)
  }
)

export default api
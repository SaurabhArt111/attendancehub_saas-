import axios from 'axios';

// Use environment variables for API base URL, fallback to localhost
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const instance = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to every request
instance.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Handle response errors
instance.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('admin');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default instance;

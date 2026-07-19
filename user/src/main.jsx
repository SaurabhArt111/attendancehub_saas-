import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initTheme } from './utils/theme'

// Apply the saved theme preference (light/dark/system) before first render
// so there's no flash of the wrong theme, and so the meta theme-color tag
// is correct from the very first paint.
initTheme()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

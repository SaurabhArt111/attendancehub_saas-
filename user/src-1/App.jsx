import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Toaster from './components/Toaster'
import LoginPage     from './pages/LoginPage'
import AppShell      from './pages/AppShell'
import HomePage      from './pages/HomePage'
import AttendancePage from './pages/AttendancePage'
import ProfilePage   from './pages/ProfilePage'

function RequireAuth({ children }) {
  return localStorage.getItem('employeeToken') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route index element={<HomePage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="profile"    element={<ProfilePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

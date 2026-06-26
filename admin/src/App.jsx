import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Toaster from './components/Toaster'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import ForgotCodePage from './pages/ForgotCodePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import DashboardLayout from './pages/DashboardLayout'
import EmployeesPage from './pages/EmployeesPage'
import AttendancePage from './pages/AttendancePage'
import ReportsPage from './pages/ReportsPage'
import HolidaysPage from './pages/HolidaysPage'
import DesignationsPage from './pages/DesignationsPage'
import SettingsPage from './pages/SettingsPage'

function RequireAuth({ children }) {
  return localStorage.getItem('adminToken') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster />
      <Routes>
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/setup"           element={<SetupPage />} />
        <Route path="/forgot-code"     element={<ForgotCodePage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/employees" replace />} />
          <Route path="employees"    element={<EmployeesPage />} />
          <Route path="attendance"   element={<AttendancePage />} />
          <Route path="reports"      element={<ReportsPage />} />
          <Route path="holidays"     element={<HolidaysPage />} />
          <Route path="designations" element={<DesignationsPage />} />
          <Route path="settings"     element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

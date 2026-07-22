import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Toaster from './components/Toaster'
import PWAUpdatePrompt from './components/PWAUpdatePrompt'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import SetupPage from './pages/SetupPage'
import DashboardLayout from './pages/DashboardLayout'
import EmployeesPage from './pages/EmployeesPage'
import AttendancePage from './pages/AttendancePage'
import ReportsPage from './pages/ReportsPage'
import HolidaysPage from './pages/HolidaysPage'
import DesignationsPage from './pages/DesignationsPage'
import SettingsPage from './pages/SettingsPage'
import SecuritySessionsPage from './pages/SecuritySessionsPage'
import AboutPage from './pages/AboutPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import EmployeeDetailsPage from './pages/EmployeeDetails'
import MyEmployeesPage from './pages/MyEmployeesPage'

function RequireAuth({ children }) {
  return localStorage.getItem('adminToken') ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Toaster />
      <PWAUpdatePrompt />
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route index element={<Navigate to="/employees" replace />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="employees/:id" element={<EmployeeDetailsPage />} />
          <Route path="my-employees" element={<MyEmployeesPage />} />
          <Route path="attendance" element={<AttendancePage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="holidays" element={<HolidaysPage />} />
          <Route path="designations" element={<DesignationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/security-sessions" element={<SecuritySessionsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

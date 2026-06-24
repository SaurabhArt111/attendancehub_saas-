import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import AttendanceCalendar from '../components/AttendanceCalendar'
import './AttendancePage.css'

export default function AttendancePage() {
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [month, setMonth] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await api.get('/employees')
      setEmployees(res.data)
      if (res.data.length > 0 && !selectedEmployee) {
        setSelectedEmployee(res.data[0]._id)
      }
    } catch {
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [selectedEmployee])

  useEffect(() => { load() }, [load])

  return (
    <div className="attendance-page">
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p className="header-subtitle">Track and manage employee attendance</p>
        </div>
      </div>

      <div className="attendance-controls">
        <div className="control-group">
          <label htmlFor="employee-select">Select Employee</label>
          <select 
            id="employee-select"
            className="form-input"
            value={selectedEmployee || ''}
            onChange={e => setSelectedEmployee(e.target.value)}
          >
            <option value="">Choose an employee...</option>
            {employees.map(emp => (
              <option key={emp._id} value={emp._id}>
                {emp.username} ({emp.employeeId})
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Month</label>
          <div className="month-picker">
            <button 
              className="btn-month-nav"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1))}
            >
              ←
            </button>
            <span className="month-display">
              {month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button 
              className="btn-month-nav"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1))}
            >
              →
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading attendance data...</p>
        </div>
      ) : !selectedEmployee ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <h3>No Employee Selected</h3>
          <p>Select an employee to view their attendance</p>
        </div>
      ) : (
        <div className="calendar-container">
          <AttendanceCalendar employeeId={selectedEmployee} month={month} />
        </div>
      )}
    </div>
  )
}

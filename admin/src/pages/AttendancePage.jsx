import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import AttendanceCalendar from '../components/AttendanceCalendar'

export default function AttendancePage() {
  const [employees, setEmployees] = useState([])
  const [selected, setSelected]   = useState('')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    api.get('/employees')
      .then(r => { setEmployees(r.data); if (r.data.length) setSelected(r.data[0]._id) })
      .catch(() => toast.error('Failed to load employees'))
      .finally(() => setLoading(false))
  }, [])

  const emp = employees.find(e => e._id === selected)

  return (
    <div>
      <h1 className="font-700 mb-2" style={{ fontSize: '1.25rem' }}>Attendance</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : employees.length === 0 ? (
        <div className="empty card">No employees found. Add employees first.</div>
      ) : (
        <>
          <div className="form-group">
            <label className="label">Select Employee</label>
            <select className="input" value={selected} onChange={e => setSelected(e.target.value)}
              style={{ cursor: 'pointer' }}>
              {employees.map(e => (
                <option key={e._id} value={e._id}>{e.username} ({e.employeeId})</option>
              ))}
            </select>
          </div>

          {emp && (
            <div className="card fade-in">
              <div className="flex items-center gap-2 mb-2">
                <div className="emp-avatar">{emp.username.slice(0,2).toUpperCase()}</div>
                <div>
                  <div className="font-600">{emp.username}</div>
                  <div className="text-xs text-2">{emp.employeeId} · Rs {emp.salary?.toLocaleString()}</div>
                </div>
              </div>
              <div className="divider" />
              <AttendanceCalendar employeeId={emp._id} adminMode />
            </div>
          )}
        </>
      )}
    </div>
  )
}

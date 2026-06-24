import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './Page.css'
 
export default function ReportsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
 
  const load = useCallback(async () => {
    try {
      const res = await api.get('/reports')
      setData(res.data)
    } catch {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])
 
  useEffect(() => { load() }, [load])
 
  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="header-subtitle">View attendance and employee reports</p>
        </div>
      </div>
 
      <div className="reports-filters">
        <select className="form-input" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All Reports</option>
          <option value="attendance">Attendance</option>
          <option value="performance">Performance</option>
        </select>
      </div>
 
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading reports...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
            <line x1="2" y1="20" x2="22" y2="20" />
          </svg>
          <h3>No Reports Available</h3>
          <p>Check back later for reports</p>
        </div>
      ) : (
        <div className="reports-grid">
          {/* Reports content */}
        </div>
      )}
    </div>
  )
}

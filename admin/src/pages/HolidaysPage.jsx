import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './Page.css'
 
export default function HolidaysPage() {
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
 
  const load = useCallback(async () => {
    try {
      const res = await api.get('/holidays')
      setHolidays(res.data)
    } catch {
      toast.error('Failed to load holidays')
    } finally {
      setLoading(false)
    }
  }, [])
 
  useEffect(() => { load() }, [load])
 
  return (
    <div className="holidays-page">
      <div className="page-header">
        <div>
          <h1>Holidays</h1>
          <p className="header-subtitle">Manage company holidays</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Holiday</span>
        </button>
      </div>
 
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading holidays...</p>
        </div>
      ) : holidays.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M12 8v4l3 2" />
          </svg>
          <h3>No Holidays Yet</h3>
          <p>Add your first holiday</p>
        </div>
      ) : (
        <div className="holidays-list">
          {holidays.map(h => (
            <div key={h._id} className="holiday-item">
              <span>{h.name}</span>
              <span className="date">{new Date(h.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

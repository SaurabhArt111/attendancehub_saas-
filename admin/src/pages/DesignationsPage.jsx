import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './Page.css'
 
export default function DesignationsPage() {
  const [designations, setDesignations] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
 
  const load = useCallback(async () => {
    try {
      const res = await api.get('/designations')
      setDesignations(res.data)
    } catch {
      toast.error('Failed to load designations')
    } finally {
      setLoading(false)
    }
  }, [])
 
  useEffect(() => { load() }, [load])
 
  return (
    <div className="designations-page">
      <div className="page-header">
        <div>
          <h1>Designations</h1>
          <p className="header-subtitle">Manage job titles and roles</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Designation</span>
        </button>
      </div>
 
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading designations...</p>
        </div>
      ) : designations.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
          </svg>
          <h3>No Designations Yet</h3>
          <p>Add your first designation</p>
        </div>
      ) : (
        <div className="designations-grid">
          {designations.map(d => (
            <div key={d._id} className="designation-card">
              <h3>{d.name}</h3>
              {d.description && <p>{d.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

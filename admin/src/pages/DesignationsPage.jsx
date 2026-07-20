import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './DesignationsPage.css'

function initials(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name || '').slice(0, 2).toUpperCase()
}

export default function DesignationsPage() {
  const navigate = useNavigate()
  const [list,    setList]    = useState([])
  const [employees, setEmployees] = useState([])
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [renameId, setRenameId] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [openDesig, setOpenDesig] = useState(null)

  const load = () => Promise.all([
    api.get('/designations').then(r => setList(r.data)),
    api.get('/employees').then(r => setEmployees(r.data)),
  ]).catch(() => toast.error('Load failed'))
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    try {
      await api.post('/designations', { name })
      toast.success('Designation added')
      setName('')
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }

  async function del(id, dname) {
    if (!confirm(`Remove designation "${dname}"?`)) return
    try {
      await api.delete(`/designations/${id}`)
      toast.success('Removed')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    }
  }

  function startRename(d) {
    setRenameId(d._id)
    setRenameName(d.name)
  }

  async function submitRename(e) {
    e.preventDefault()
    if (!renameName.trim()) return
    setRenaming(true)
    try {
      await api.put(`/designations/${renameId}`, { name: renameName })
      toast.success('Designation renamed — all employees updated')
      setRenameId(null)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Rename failed') }
    finally { setRenaming(false) }
  }

  return (
    <div>
      <h1 className="font-700 mb-1" style={{ fontSize: '1.2rem' }}>Designations</h1>
      <p className="text-sm text-2 mb-2">
        Create job titles/roles for your employees.
      </p>

      <div className="card mb-2">
        <div className="font-600 mb-2">Add Designation</div>
        <form onSubmit={add} className="flex gap-1">
          <input className="input" placeholder="e.g. Manager, Sales Executive, Driver..." value={name}
            onChange={e => setName(e.target.value)} required />
          <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={loading}>
            {loading ? <span className="spinner" /> : '+ Add'}
          </button>
        </form>
      </div>

      {list.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
              <line x1="7" y1="7" x2="7.01" y2="7"/>
            </svg>
          </div>
          No designations yet. Add your first one above.
        </div>
      ) : (
        <div className="desig-grid">
          {list.map(d => {
            const emps = employees.filter(e => e.designation === d.name)
            const totalSalary = emps.reduce((s, e) => s + (e.salary || 0), 0)
            return (
              <div key={d._id} className="desig-card" onClick={() => setOpenDesig(d)}>
                <div className="desig-card-top">
                  <div className="desig-card-name">{d.name}</div>
                  <span className="desig-card-count">{emps.length} employee{emps.length === 1 ? '' : 's'}</span>
                </div>
                <div className="desig-card-sub text-xs text-2">
                  {emps.length > 0 ? `₹${totalSalary.toLocaleString()}/mo payroll` : 'No employees assigned yet'}
                </div>
                <div className="desig-card-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn btn-secondary btn-sm" onClick={() => startRename(d)}>Rename</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(d._id, d.name)}>Remove</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Employees within a designation */}
      {openDesig && (() => {
        const emps = employees.filter(e => e.designation === openDesig.name)
        const totalSalary = emps.reduce((s, e) => s + (e.salary || 0), 0)
        const avgSalary = emps.length ? Math.round(totalSalary / emps.length) : 0
        return (
          <div className="overlay" onClick={() => setOpenDesig(null)}>
            <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
              <h2 className="modal-title">{openDesig.name}</h2>
              <div className="desig-modal-stats mb-2">
                <div className="desig-modal-stat">
                  <div className="font-700" style={{ fontSize: '1.15rem' }}>{emps.length}</div>
                  <div className="text-xs text-2">Employees</div>
                </div>
                <div className="desig-modal-stat">
                  <div className="font-700" style={{ fontSize: '1.15rem' }}>₹{totalSalary.toLocaleString()}</div>
                  <div className="text-xs text-2">Total payroll/mo</div>
                </div>
                <div className="desig-modal-stat">
                  <div className="font-700" style={{ fontSize: '1.15rem' }}>₹{avgSalary.toLocaleString()}</div>
                  <div className="text-xs text-2">Avg salary/mo</div>
                </div>
              </div>
              {emps.length === 0 ? (
                <div className="text-sm text-2">No employees have this designation yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                  {emps.map(emp => (
                    <div key={emp._id} className="card desig-emp-row"
                      onClick={() => navigate(`/employees/${emp._id}`)}>
                      <div className="emp-avatar emp-avatar-sm">{initials(emp.username)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-600 text-sm">{emp.username} <span className="emp-id-badge">{emp.employeeId}</span></div>
                        <div className="text-xs text-2 mt-1">{emp.contact}{emp.salary ? ` · ₹${emp.salary.toLocaleString()}/mo` : ''}</div>
                      </div>
                      <ChevronRightIcon />
                    </div>
                  ))}
                </div>
              )}
              <button className="btn btn-secondary btn-block mt-2" onClick={() => setOpenDesig(null)}>Close</button>
            </div>
          </div>
        )
      })()}

      {/* Rename Modal */}
      {renameId && (
        <div className="overlay" onClick={() => setRenameId(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Rename Designation</h2>
            <p className="text-sm text-2 mb-2">All employees with this designation will be updated automatically.</p>
            <form onSubmit={submitRename}>
              <div className="form-group">
                <label className="label">New Name</label>
                <input className="input" value={renameName} onChange={e => setRenameName(e.target.value)} autoFocus required />
              </div>
              <div className="flex gap-1">
                <button type="button" className="btn btn-secondary btn-block" onClick={() => setRenameId(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-block" disabled={renaming}>
                  {renaming ? <span className="spinner" /> : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ChevronRightIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}><path d="m9 18 6-6-6-6" /></svg>
}

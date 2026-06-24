import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './EmployeesPage.css'

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([])
  const [designations, setDesignations] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [editEmp, setEditEmp] = useState(null)

  const load = useCallback(async () => {
    try {
      const [eRes, dRes] = await Promise.all([api.get('/employees'), api.get('/designations')])
      setEmployees(eRes.data)
      setDesignations(dRes.data)
    } catch {
      toast.error('Failed to load employees')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = employees.filter(e =>
    e.username.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
    (e.designation || '').toLowerCase().includes(search.toLowerCase())
  )

  async function deleteEmployee(id, name) {
    if (!confirm(`Delete ${name}? All records will be removed.`)) return
    try {
      await api.delete(`/employees/${id}`)
      toast.success('Employee deleted')
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Delete failed')
    }
  }

  return (
    <div className="employees-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Employees</h1>
          <p className="header-subtitle">{employees.length} total employees</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add Employee</span>
        </button>
      </div>

      <div className="search-container">
        <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input 
          className="search-input"
          placeholder="Search by name, ID, or designation..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading employees...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
          </svg>
          <h3>{search ? 'No matches found' : 'No employees yet'}</h3>
          <p>{search ? 'Try adjusting your search' : 'Add your first employee to get started'}</p>
          {!search && (
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              Add Employee
            </button>
          )}
        </div>
      ) : (
        <div className="employees-grid">
          {filtered.map(emp => (
            <EmployeeCard key={emp._id}
              emp={emp}
              expanded={expanded === emp._id}
              onToggle={() => setExpanded(expanded === emp._id ? null : emp._id)}
              onEdit={() => setEditEmp(emp)}
              onDelete={() => deleteEmployee(emp._id, emp.username)}
            />
          ))}
        </div>
      )}

      {showAdd && <AddModal designations={designations} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load() }} />}
      {editEmp && <EditModal emp={editEmp} designations={designations} onClose={() => setEditEmp(null)} onDone={() => { setEditEmp(null); load() }} />}
    </div>
  )
}

function EmployeeCard({ emp, expanded, onToggle, onEdit, onDelete }) {
  const initials = emp.username.slice(0, 2).toUpperCase()
  
  return (
    <div className="employee-card slide-in">
      <div className="card-header" onClick={onToggle}>
        <div className="card-info">
          <div className="employee-avatar">{initials}</div>
          <div className="employee-details">
            <h3 className="employee-name">{emp.username}</h3>
            <p className="employee-id">{emp.employeeId}</p>
            {emp.designation && (
              <span className="badge">{emp.designation}</span>
            )}
          </div>
        </div>
        <div className="card-toggle">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={expanded ? 'expanded' : ''}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {expanded && (
        <div className="card-content">
          <div className="content-grid">
            {emp.email && (
              <div className="content-item">
                <span className="label">Email</span>
                <span className="value">{emp.email}</span>
              </div>
            )}
            {emp.phone && (
              <div className="content-item">
                <span className="label">Phone</span>
                <span className="value">{emp.phone}</span>
              </div>
            )}
            {emp.department && (
              <div className="content-item">
                <span className="label">Department</span>
                <span className="value">{emp.department}</span>
              </div>
            )}
            {emp.joiningDate && (
              <div className="content-item">
                <span className="label">Joined</span>
                <span className="value">{new Date(emp.joiningDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          <div className="card-actions">
            <button className="btn btn-sm btn-secondary" onClick={onEdit}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              <span>Edit</span>
            </button>
            <button className="btn btn-sm btn-danger" onClick={onDelete}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddModal({ designations, onClose, onDone }) {
  const [form, setForm] = useState({
    username: '',
    employeeId: '',
    email: '',
    phone: '',
    designation: '',
    department: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/employees', form)
      toast.success('Employee added successfully')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add employee')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Employee</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name *</label>
              <input className="form-input" placeholder="John Doe" value={form.username} onChange={set('username')} required />
            </div>
            <div className="form-group">
              <label>Employee ID *</label>
              <input className="form-input" placeholder="EMP001" value={form.employeeId} onChange={set('employeeId')} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" placeholder="john@example.com" value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-input" placeholder="+1 (555) 123-4567" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="form-group">
              <label>Designation</label>
              <select className="form-input" value={form.designation} onChange={set('designation')}>
                <option value="">Select...</option>
                {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Department</label>
              <input className="form-input" placeholder="Engineering" value={form.department} onChange={set('department')} />
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input className="form-input" type="password" placeholder="••••••••" value={form.password} onChange={set('password')} required />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditModal({ emp, designations, onClose, onDone }) {
  const [form, setForm] = useState(emp)
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.put(`/employees/${emp._id}`, form)
      toast.success('Employee updated')
      onDone()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Update failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Employee</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="modal-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name</label>
              <input className="form-input" value={form.username} onChange={set('username')} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" type="email" value={form.email} onChange={set('email')} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-input" value={form.phone} onChange={set('phone')} />
            </div>
            <div className="form-group">
              <label>Designation</label>
              <select className="form-input" value={form.designation} onChange={set('designation')}>
                <option value="">Select...</option>
                {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Department</label>
              <input className="form-input" value={form.department} onChange={set('department')} />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

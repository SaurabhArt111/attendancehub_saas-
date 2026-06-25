import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import AttendanceCalendar from '../components/AttendanceCalendar'
import './EmployeesPage.css'

export default function EmployeesPage() {
  const [employees,    setEmployees]    = useState([])
  const [designations, setDesignations] = useState([])
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(true)
  const [showAdd,      setShowAdd]      = useState(false)
  const [showBulk,     setShowBulk]     = useState(false)
  const [expanded,     setExpanded]     = useState(null)
  const [editEmp,      setEditEmp]      = useState(null)
  const [attendanceStats, setAttendanceStats] = useState({})

  const load = useCallback(async () => {
    try {
      const [eRes, dRes, aRes] = await Promise.all([
        api.get('/employees'),
        api.get('/designations'),
        api.get('/attendance/stats').catch(() => ({ data: {} }))
      ])
      setEmployees(eRes.data)
      setDesignations(dRes.data)
      setAttendanceStats(aRes.data || {})
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = employees.filter(e =>
    e.username.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
    (e.designation || '').toLowerCase().includes(search.toLowerCase())
  )

  async function deleteEmployee(id, name) {
    if (!confirm(`Delete ${name}? All attendance records will be removed.`)) return
    try {
      await api.delete(`/employees/${id}`)
      toast.success('Employee deleted')
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Delete failed') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '.65rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="font-700" style={{ fontSize: '1.2rem' }}>Employees</h1>
          <div className="text-sm text-2">{employees.length} total</div>
        </div>
        <div className="flex gap-1" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowBulk(true)}>Bulk Add</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>Add</button>
        </div>
      </div>

      <div className="search-wrap mb-2">
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input className="input" placeholder="Search by name, ID, or designation..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty card">
          <div className="empty-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          {search ? 'No employees match your search' : 'No employees yet.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
          {filtered.map(emp => (
            <EmployeeCard key={emp._id} emp={emp}
              stats={attendanceStats[emp._id] || { P: 0, A: 0, PP: 0 }}
              expanded={expanded === emp._id}
              onToggle={() => setExpanded(expanded === emp._id ? null : emp._id)}
              onEdit={() => setEditEmp(emp)}
              onDelete={() => deleteEmployee(emp._id, emp.username)} />
          ))}
        </div>
      )}

      {showAdd  && <AddModal  designations={designations} onClose={() => setShowAdd(false)}  onDone={() => { setShowAdd(false);  load() }} />}
      {showBulk && <BulkModal designations={designations} onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); load() }} />}
      {editEmp  && <EditModal emp={editEmp} designations={designations} onClose={() => setEditEmp(null)} onDone={() => { setEditEmp(null); load() }} />}
    </div>
  )
}

function EmployeeCard({ emp, stats, expanded, onToggle, onEdit, onDelete }) {
  const initials = emp.username.slice(0,2).toUpperCase()
  return (
    <div className="emp-card slide-in">
      <div className="emp-card-header" onClick={onToggle}>
        {/* Left Section: Avatar + Name + Details */}
        <div className="emp-card-left">
          <div className="emp-avatar">{initials}</div>
          <div className="emp-card-info">
            <div className="emp-card-name">
              {emp.username}
              <span className="emp-card-id">{emp.employeeId}</span>
            </div>
            {(emp.designation || emp.contact) && (
              <div className="emp-card-meta">
                {emp.designation && <span className="emp-designation">{emp.designation}</span>}
                {emp.contact && <span className="emp-contact">{emp.contact}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Middle Section: Attendance Stats */}
        <div className="emp-card-stats">
          <div className="stat-badge stat-present">
            <span className="stat-label">P</span>
            <span className="stat-value">{stats.P || 0}</span>
          </div>
          <div className="stat-badge stat-absent">
            <span className="stat-label">A</span>
            <span className="stat-value">{stats.A || 0}</span>
          </div>
          <div className="stat-badge stat-presentplus">
            <span className="stat-label">PP</span>
            <span className="stat-value">{stats.PP || 0}</span>
          </div>
        </div>

        {/* Right Section: Salary + Actions */}
        <div className="emp-card-right">
          <div className="emp-salary-badge">
            {emp.salaryType === 'daily' ? `Rs ${emp.salary}/day` : `Rs ${emp.salary?.toLocaleString()}/mo`}
          </div>
          <div className="emp-card-actions">
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={e => { e.stopPropagation(); onEdit() }} 
              title="Edit employee"
            >Edit</button>
            <button 
              className="btn btn-danger btn-sm" 
              onClick={e => { e.stopPropagation(); onDelete() }}
              title="Delete employee"
            >Delete</button>
            <svg 
              className={`chevron ${expanded ? 'open' : ''}`} 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </div>
        </div>
      </div>
      {expanded && (
        <div className="emp-card-body fade-in">
          <AttendanceCalendar employeeId={emp._id} adminMode />
        </div>
      )}
    </div>
  )
}

function AddModal({ designations, onClose, onDone }) {
  const [form, setForm] = useState({ username: '', contact: '', password: '', salaryType: 'monthly', salary: '', designation: '' })
  const [suggestedId, setSuggestedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [idLoading, setIdLoading] = useState(true)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    api.get('/employees/suggest-id')
      .then(r => setSuggestedId(r.data.employeeId))
      .catch(() => {})
      .finally(() => setIdLoading(false))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/employees', { ...form, employeeId: suggestedId })
      toast.success(`Employee added — ID: ${suggestedId}`)
      onDone()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add') }
    finally { setLoading(false) }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Add Employee</h2>

        {/* Auto-generated ID */}
        <div className="form-group">
          <label className="label">Auto-Generated Employee ID</label>
          {idLoading ? (
            <div className="flex items-center gap-2"><span className="spinner" /><span className="text-sm text-2">Generating...</span></div>
          ) : (
            <div className="id-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></svg>
              {suggestedId}
            </div>
          )}
          <div className="text-xs text-2 mt-1">Employee uses this mixed ID to log in - no company code needed</div>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Full Name / Username</label>
            <input className="input" placeholder="John Doe" value={form.username} onChange={set('username')} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Contact</label>
              <input className="input" placeholder="9876543210" value={form.contact} onChange={set('contact')} />
            </div>
            <div className="form-group">
              <label className="label">Designation</label>
              <select className="input" value={form.designation} onChange={set('designation')}>
                <option value="">None</option>
                {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Salary Type</label>
              <select className="input" value={form.salaryType} onChange={set('salaryType')}>
                <option value="monthly">Monthly (fixed)</option>
                <option value="daily">Daily rate</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">{form.salaryType === 'daily' ? 'Daily Rate (Rs)' : 'Monthly Salary (Rs)'}</label>
              <input className="input" type="number" placeholder="0" value={form.salary} onChange={set('salary')} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Login Password</label>
            <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required />
          </div>
          <div className="flex gap-1 mt-2">
            <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || idLoading}>
              {loading ? <span className="spinner" /> : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EditModal({ emp, designations, onClose, onDone }) {
  const [form, setForm] = useState({ contact: emp.contact || '', salaryType: emp.salaryType || 'monthly', salary: emp.salary || '', designation: emp.designation || '', password: '' })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { contact: form.contact, salaryType: form.salaryType, salary: form.salary, designation: form.designation }
    if (form.password) payload.password = form.password
    try {
      await api.put(`/employees/${emp._id}`, payload)
      toast.success('Employee updated')
      onDone()
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Edit — {emp.username}</h2>
        <div className="id-badge mb-2">{emp.employeeId}</div>
        <form onSubmit={submit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Contact</label>
              <input className="input" value={form.contact} onChange={set('contact')} />
            </div>
            <div className="form-group">
              <label className="label">Designation</label>
              <select className="input" value={form.designation} onChange={set('designation')}>
                <option value="">None</option>
                {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Salary Type</label>
              <select className="input" value={form.salaryType} onChange={set('salaryType')}>
                <option value="monthly">Monthly (fixed)</option>
                <option value="daily">Daily rate</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">{form.salaryType === 'daily' ? 'Daily Rate (Rs)' : 'Monthly Salary (Rs)'}</label>
              <input className="input" type="number" value={form.salary} onChange={set('salary')} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">New Password (blank = keep)</label>
            <input className="input" type="password" placeholder="New password" value={form.password} onChange={set('password')} />
          </div>
          <div className="flex gap-1 mt-2">
            <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BulkModal({ designations, onClose, onDone }) {
  const [rows, setRows] = useState([{ username:'', contact:'', password:'', salaryType:'monthly', salary:'', designation:'' }])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  function setRow(i, k, v) { setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row)) }
  function addRow() { setRows(r => [...r, { username:'', contact:'', password:'', salaryType:'monthly', salary:'', designation:'' }]) }
  function remRow(i) { setRows(r => r.filter((_, idx) => idx !== i)) }

  async function submit() {
    const valid = rows.filter(r => r.username && r.password)
    if (!valid.length) { toast.error('At least one complete row required'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/employees/bulk', { employees: valid })
      setResults(data)
      if (data.created.length) toast.success(`${data.created.length} added`)
      if (data.failed.length)  toast.error(`${data.failed.length} failed`)
    } catch (err) { toast.error(err.response?.data?.error || 'Bulk add failed') }
    finally { setLoading(false) }
  }

  if (results) return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Bulk Add Results</h2>
        <div className="mb-2">
          <div className="text-success font-600 mb-1">{results.created.length} created</div>
          {results.created.map((c,i) => <div key={i} className="text-sm">{c.username} — <span style={{fontFamily:'monospace',color:'var(--accent)'}}>{c.employeeId}</span></div>)}
          {results.failed.map((f,i) => <div key={i} className="text-danger text-sm mt-1">{f.username}: {f.reason}</div>)}
        </div>
        <button className="btn btn-primary btn-block" onClick={onDone}>Done</button>
      </div>
    </div>
  )

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Bulk Add Employees</h2>
        <div className="text-xs text-2 mb-2">Employee IDs are auto-generated as mixed letter-number codes.</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 600 }}>
            <thead>
              <tr><th>Name *</th><th>Contact</th><th>Password *</th><th>Designation</th><th>Type</th><th>Salary</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input className="input" style={{ minWidth: 100 }} value={r.username} onChange={e => setRow(i,'username',e.target.value)} /></td>
                  <td><input className="input" style={{ minWidth: 90 }} value={r.contact}  onChange={e => setRow(i,'contact', e.target.value)} /></td>
                  <td><input className="input" type="password" style={{ minWidth: 90 }} value={r.password} onChange={e => setRow(i,'password',e.target.value)} /></td>
                  <td>
                    <select className="input" style={{ minWidth: 100 }} value={r.designation} onChange={e => setRow(i,'designation',e.target.value)}>
                      <option value="">None</option>
                      {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="input" style={{ minWidth: 90 }} value={r.salaryType} onChange={e => setRow(i,'salaryType',e.target.value)}>
                      <option value="monthly">Monthly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </td>
                  <td><input className="input" type="number" style={{ minWidth: 70 }} value={r.salary} onChange={e => setRow(i,'salary',e.target.value)} /></td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remRow(i)} disabled={rows.length===1}>X</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-1 mt-2">
          <button className="btn btn-secondary btn-sm" onClick={addRow}>+ Row</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Add All'}
          </button>
        </div>
      </div>
    </div>
  )
}

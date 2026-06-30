import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import AttendanceCalendar from '../components/AttendanceCalendar'
import './EmployeesPage.css'

const TODAY_STATUS = {
  P:  { label: 'Present', bg: 'rgba(16,185,129,0.15)', color: 'var(--success)', dot: '#10b981' },
  A:  { label: 'Absent',  bg: 'rgba(239,68,68,0.12)',  color: 'var(--danger)',  dot: '#ef4444' },
  PP: { label: 'Double',  bg: 'rgba(167,139,250,0.15)',color: '#a78bfa',        dot: '#a78bfa' },
  H:  { label: 'Holiday', bg: 'rgba(245,158,11,0.12)', color: 'var(--warn)',    dot: '#f59e0b' },
}

const DESG_COLORS = [
  { bg: '#dbeafe', color: '#1e40af' },
  { bg: '#dcfce7', color: '#166534' },
  { bg: '#fef3c7', color: '#854d0e' },
  { bg: '#fce7f3', color: '#be185d' },
  { bg: '#ede9fe', color: '#6b21a8' },
  { bg: '#ccfbf1', color: '#134e4a' },
]

function getDesignationColor(name) {
  if (!name) return null
  let h = 0
  for (let i = 0; i < name.length; i++) { h = ((h << 5) - h) + name.charCodeAt(i); h |= 0 }
  return DESG_COLORS[Math.abs(h) % DESG_COLORS.length]
}

function initials(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export default function EmployeesPage() {
  const [employees,     setEmployees]     = useState([])
  const [archived,      setArchived]      = useState([])
  const [designations,  setDesignations]  = useState([])
  const [search,        setSearch]        = useState('')
  const [filterDesig,   setFilterDesig]   = useState('')
  const [loading,       setLoading]       = useState(true)
  const [showAdd,       setShowAdd]       = useState(false)
  const [showBulk,      setShowBulk]      = useState(false)
  const [showArchived,  setShowArchived]  = useState(false)
  const [expanded,      setExpanded]      = useState(null)
  const [editEmp,       setEditEmp]       = useState(null)
  const [archiveModal,  setArchiveModal]  = useState(null)
  const [todayStatuses, setTodayStatuses] = useState({})

  useEffect(() => {
    const saved = localStorage.getItem('employee-today-statuses')
    if (saved) { try { setTodayStatuses(JSON.parse(saved)) } catch {} }
  }, [])

  useEffect(() => {
    localStorage.setItem('employee-today-statuses', JSON.stringify(todayStatuses))
  }, [todayStatuses])

  const load = useCallback(async () => {
    try {
      const [eRes, dRes, aRes] = await Promise.all([
        api.get('/employees'),
        api.get('/designations'),
        api.get('/employees/archived'),
      ])
      setEmployees(eRes.data)
      setDesignations(dRes.data)
      setArchived(aRes.data)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.username.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) || (e.designation || '').toLowerCase().includes(q)
    const matchDesig = !filterDesig || e.designation === filterDesig
    return matchSearch && matchDesig
  })

  function exportEmployee(emp) {
    api.get(`/employees/${emp._id}/export`, { responseType: 'blob' })
      .then(res => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' }))
        const a = document.createElement('a'); a.href = url
        a.download = `employee_${emp.employeeId}_${emp.username}.json`; a.click()
        URL.revokeObjectURL(url)
        toast.success(`${emp.username} data exported`)
      })
      .catch(() => toast.error('Export failed'))
  }

  async function archiveEmployee(id, name) {
    try {
      await api.delete(`/employees/${id}`)
      toast.success(`${name} archived`)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Archive failed') }
  }

  async function restoreEmployee(id, name) {
    try {
      await api.post(`/employees/${id}/restore`)
      toast.success(`${name} restored`)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Restore failed') }
  }

  async function permanentDelete(id, name) {
    if (!confirm(`Permanently delete ${name}? This cannot be undone and ALL attendance records will be removed.`)) return
    try {
      await api.delete(`/employees/${id}/permanent`)
      toast.success(`${name} permanently deleted`)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Delete failed') }
  }

  const uniqueDesignations = [...new Set(employees.map(e => e.designation).filter(Boolean))].sort()

  return (
    <div className="emp-page">
      {/* Header */}
      <div className="emp-page-header">
        <div>
          <h1 className="emp-page-title">Employees</h1>
          <div className="emp-page-meta">
            {employees.length} active
            {archived.length > 0 && <span className="emp-archived-chip" onClick={() => setShowArchived(true)}>
              {archived.length} archived
            </span>}
          </div>
        </div>
        <div className="emp-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowBulk(true)}>
            <BulkIcon /> Bulk Add
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
            <PlusIcon /> Add Employee
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="emp-filters">
        <div className="search-wrap">
          <SearchIcon />
          <input className="input" placeholder="Search by name, ID, or designation..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        {uniqueDesignations.length > 0 && (
          <select className="input emp-filter-select" value={filterDesig} onChange={e => setFilterDesig(e.target.value)}>
            <option value="">All Designations</option>
            {uniqueDesignations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {/* Stats Bar */}
      {employees.length > 0 && (
        <div className="emp-stats">
          <div className="emp-stat">
            <span className="emp-stat-value">{employees.length}</span>
            <span className="emp-stat-label">Active</span>
          </div>
          {uniqueDesignations.length > 0 && (
            <div className="emp-stat">
              <span className="emp-stat-value">{uniqueDesignations.length}</span>
              <span className="emp-stat-label">Roles</span>
            </div>
          )}
          {filterDesig && (
            <div className="emp-stat">
              <span className="emp-stat-value">{filtered.length}</span>
              <span className="emp-stat-label">Filtered</span>
            </div>
          )}
        </div>
      )}

      {/* Employee List */}
      {loading ? (
        <div className="emp-loading"><span className="spinner" /><span>Loading employees...</span></div>
      ) : filtered.length === 0 ? (
        <div className="emp-empty">
          <div className="emp-empty-icon">
            <PeopleIcon />
          </div>
          <div className="emp-empty-title">
            {search || filterDesig ? 'No employees match your filters' : 'No employees yet'}
          </div>
          <div className="emp-empty-sub">
            {!search && !filterDesig && 'Add your first employee to get started'}
          </div>
          {(search || filterDesig) && (
            <button className="btn btn-secondary btn-sm mt-2" onClick={() => { setSearch(''); setFilterDesig('') }}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="emp-grid">
          {filtered.map(emp => (
            <EmployeeCard key={emp._id} emp={emp}
              expanded={expanded === emp._id}
              todayStatus={todayStatuses[emp._id]}
              onToggle={() => setExpanded(expanded === emp._id ? null : emp._id)}
              onEdit={() => setEditEmp(emp)}
              onExport={() => exportEmployee(emp)}
              onArchive={() => setArchiveModal(emp)}
              onTodayStatus={s => setTodayStatuses(p => ({ ...p, [emp._id]: s }))} />
          ))}
        </div>
      )}

      {showAdd  && <AddModal  designations={designations} onClose={() => setShowAdd(false)}  onDone={() => { setShowAdd(false);  load() }} />}
      {showBulk && <BulkModal designations={designations} onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); load() }} />}
      {editEmp  && <EditModal emp={editEmp} designations={designations} onClose={() => setEditEmp(null)} onDone={() => { setEditEmp(null); load() }} />}

      {archiveModal && (
        <div className="overlay" onClick={() => setArchiveModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Archive Employee</h2>
            <p className="text-sm text-2 mb-2">
              <strong style={{ color: 'var(--text)' }}>{archiveModal.username}</strong> will be archived.
              Attendance records are preserved and can be restored at any time.
            </p>
            <div className="card mb-2" style={{ background: 'var(--bg-hover)', padding: '.75rem 1rem' }}>
              <div className="text-xs text-2 mb-1 font-600" style={{ textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Optional: Backup data first
              </div>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'flex-start', gap: '.5rem' }}
                onClick={() => exportEmployee(archiveModal)}>
                <ExportIcon /> Download employee data
              </button>
            </div>
            <div className="flex gap-1">
              <button className="btn btn-secondary" onClick={() => setArchiveModal(null)}>Cancel</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-danger" onClick={() => {
                const e = archiveModal; setArchiveModal(null); archiveEmployee(e._id, e.username)
              }}>Archive</button>
            </div>
          </div>
        </div>
      )}

      {showArchived && (
        <div className="overlay" onClick={() => setShowArchived(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Archived Employees</h2>
            {archived.length === 0 ? (
              <div className="text-sm text-2">No archived employees.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                {archived.map(emp => (
                  <div key={emp._id} className="card" style={{ padding: '.75rem 1rem' }}>
                    <div className="flex items-center gap-2">
                      <div className="emp-avatar emp-avatar-sm" style={{ opacity: 0.5 }}>{initials(emp.username)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-600 text-sm">{emp.username}
                          <span className="tag" style={{ marginLeft: '.4rem', fontFamily: 'monospace', fontSize: '.68rem' }}>{emp.employeeId}</span>
                        </div>
                        {emp.archivedAt && <div className="text-xs text-2">Archived {new Date(emp.archivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                      </div>
                      <div className="flex gap-1" style={{ flexShrink: 0 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => restoreEmployee(emp._id, emp.username)}>Restore</button>
                        <button className="btn btn-danger btn-sm" onClick={() => permanentDelete(emp._id, emp.username)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn btn-secondary btn-block mt-2" onClick={() => setShowArchived(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}

function EmployeeCard({ emp, expanded, todayStatus, onToggle, onEdit, onExport, onArchive, onTodayStatus }) {
  const dColor = getDesignationColor(emp.designation)
  const todayCfg = todayStatus ? TODAY_STATUS[todayStatus] : null

  return (
    <div className={`emp-card ${expanded ? 'expanded' : ''}`}>
      <div className="emp-card-main" onClick={onToggle}>
        <div className="emp-card-left">
          <div className="emp-avatar">
            {initials(emp.username)}
            {todayCfg && <span className="emp-status-dot" style={{ background: todayCfg.dot }} />}
          </div>
          <div className="emp-card-info">
            <div className="emp-name">
              {emp.username}
              <span className="emp-id-badge">{emp.employeeId}</span>
            </div>
            <div className="emp-meta">
              {emp.designation && (
                <span className="emp-desg-tag" style={{ background: dColor?.bg, color: dColor?.color }}>
                  {emp.designation}
                </span>
              )}
              {emp.contact && <span className="emp-contact">{emp.contact}</span>}
              {todayCfg && (
                <span className="emp-today-badge" style={{ background: todayCfg.bg, color: todayCfg.color }}>
                  <span className="emp-today-dot" style={{ background: todayCfg.dot }} />
                  {todayCfg.label}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="emp-card-right">
          <div className="emp-salary">
            <span className="emp-salary-amount">₹{emp.salary?.toLocaleString()}</span>
            <span className="emp-salary-type">/{emp.salaryType === 'daily' ? 'day' : 'mo'}</span>
          </div>
          <div className="emp-actions" onClick={e => e.stopPropagation()}>
            <button className="emp-action-btn" title="Edit" onClick={onEdit}><EditIcon /></button>
            <button className="emp-action-btn" title="Export" onClick={onExport}><ExportIcon /></button>
            <button className="emp-action-btn emp-action-danger" title="Archive" onClick={onArchive}><ArchiveIcon /></button>
          </div>
          <ChevronIcon className={`emp-chevron ${expanded ? 'open' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="emp-card-body fade-in">
          <AttendanceCalendar employeeId={emp._id} adminMode onTodayStatus={onTodayStatus} />
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
    api.get('/employees/suggest-id').then(r => setSuggestedId(r.data.employeeId)).catch(() => {}).finally(() => setIdLoading(false))
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
        <div className="form-group">
          <label className="label">Auto-Generated Employee ID</label>
          {idLoading
            ? <div className="flex items-center gap-2"><span className="spinner" /><span className="text-sm text-2">Generating...</span></div>
            : <div className="id-badge"><IdIcon />{suggestedId}</div>}
          <div className="text-xs text-2 mt-1">Employee uses this ID to log in</div>
        </div>
        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Full Name *</label>
            <input className="input" placeholder="John Doe" value={form.username} onChange={set('username')} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Contact</label>
              <input className="input" placeholder="9876543210" value={form.contact} onChange={set('contact')} />
            </div>
            <div className="form-group">
              <label className="label">Designation</label>
              {designations.length === 0 ? (
                <div className="text-xs text-2" style={{ padding: '.5rem 0', color: 'var(--warn)' }}>
                  No designations — create them in Designations first
                </div>
              ) : (
                <select className="input" value={form.designation} onChange={set('designation')}>
                  <option value="">None</option>
                  {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Salary Type</label>
              <select className="input" value={form.salaryType} onChange={set('salaryType')}>
                <option value="monthly">Monthly Fixed</option>
                <option value="daily">Daily Rate</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">{form.salaryType === 'daily' ? 'Daily Rate (₹)' : 'Monthly Salary (₹)'}</label>
              <input className="input" type="number" min="0" placeholder="0" value={form.salary} onChange={set('salary')} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Login Password *</label>
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
  const [form, setForm] = useState({
    contact: emp.contact || '', salaryType: emp.salaryType || 'monthly',
    salary: emp.salary || '', designation: emp.designation || '', password: ''
  })
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
        <div className="id-badge mb-2"><IdIcon />{emp.employeeId}</div>
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
                <option value="monthly">Monthly Fixed</option>
                <option value="daily">Daily Rate</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">{form.salaryType === 'daily' ? 'Daily Rate (₹)' : 'Monthly Salary (₹)'}</label>
              <input className="input" type="number" min="0" value={form.salary} onChange={set('salary')} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">New Password (blank = keep current)</label>
            <input className="input" type="password" placeholder="Leave blank to keep" value={form.password} onChange={set('password')} />
          </div>
          <div className="flex gap-1 mt-2">
            <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function BulkModal({ designations, onClose, onDone }) {
  const [rows, setRows] = useState([{ username: '', contact: '', password: '', salaryType: 'monthly', salary: '', designation: '' }])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  function setRow(i, k, v) { setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row)) }
  function addRow() { setRows(r => [...r, { username: '', contact: '', password: '', salaryType: 'monthly', salary: '', designation: '' }]) }
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
          {results.created.map((c, i) => <div key={i} className="text-sm">{c.username} — <span style={{ fontFamily: 'monospace', color: 'var(--accent)' }}>{c.employeeId}</span></div>)}
          {results.failed.map((f, i) => <div key={i} className="text-danger text-sm mt-1">{f.username}: {f.reason}</div>)}
        </div>
        <button className="btn btn-primary btn-block" onClick={onDone}>Done</button>
      </div>
    </div>
  )

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 720 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Bulk Add Employees</h2>
        <div className="text-xs text-2 mb-2">Employee IDs are auto-generated. Fill Name and Password for each row.</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 600 }}>
            <thead>
              <tr><th>Name *</th><th>Contact</th><th>Password *</th><th>Designation</th><th>Type</th><th>Salary</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input className="input" style={{ minWidth: 100 }} value={r.username} onChange={e => setRow(i, 'username', e.target.value)} /></td>
                  <td><input className="input" style={{ minWidth: 90 }} value={r.contact}  onChange={e => setRow(i, 'contact', e.target.value)} /></td>
                  <td><input className="input" type="password" style={{ minWidth: 90 }} value={r.password} onChange={e => setRow(i, 'password', e.target.value)} /></td>
                  <td>
                    <select className="input" style={{ minWidth: 110 }} value={r.designation} onChange={e => setRow(i, 'designation', e.target.value)}>
                      <option value="">None</option>
                      {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="input" style={{ minWidth: 90 }} value={r.salaryType} onChange={e => setRow(i, 'salaryType', e.target.value)}>
                      <option value="monthly">Monthly</option>
                      <option value="daily">Daily</option>
                    </select>
                  </td>
                  <td><input className="input" type="number" style={{ minWidth: 70 }} value={r.salary} onChange={e => setRow(i, 'salary', e.target.value)} /></td>
                  <td><button className="btn btn-danger btn-sm" onClick={() => remRow(i)} disabled={rows.length === 1}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-1 mt-2">
          <button className="btn btn-secondary btn-sm" onClick={addRow}>+ Row</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? <span className="spinner" /> : 'Add All'}</button>
        </div>
      </div>
    </div>
  )
}

// Icons
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> }
function BulkIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function PeopleIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> }
function ExportIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }
function ArchiveIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="5" rx="2"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><line x1="10" y1="13" x2="14" y2="13"/></svg> }
function ChevronIcon({ className }) { return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg> }
function IdIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></svg> }

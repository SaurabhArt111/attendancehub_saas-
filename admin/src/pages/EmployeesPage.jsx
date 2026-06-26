import { useState, useEffect, useCallback } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import AttendanceCalendar from '../components/AttendanceCalendar'
import './EmployeesPage.css'

const TODAY_STATUS = {
  P:  { label: 'Present',  bg: 'rgba(16,185,129,0.15)',  color: 'var(--success)', dot: '#10b981' },
  A:  { label: 'Absent',   bg: 'rgba(239,68,68,0.12)',   color: 'var(--danger)',  dot: '#ef4444' },
  PP: { label: 'Double',   bg: 'rgba(167,139,250,0.15)', color: '#a78bfa',        dot: '#a78bfa' },
  H:  { label: 'Holiday',  bg: 'rgba(245,158,11,0.12)',  color: 'var(--warn)',    dot: '#f59e0b' },
}

// Color palette for designations
const DESIGNATION_COLORS = [
  { bg: '#dbeafe', color: '#1e40af' }, // blue
  { bg: '#dcfce7', color: '#166534' }, // green
  { bg: '#fef08a', color: '#854d0e' }, // amber
  { bg: '#fce7f3', color: '#be185d' }, // pink
  { bg: '#e9d5ff', color: '#6b21a8' }, // purple
  { bg: '#f0fdfa', color: '#134e4a' }, // teal
]

// Hash function to consistently assign color to designation
function getDesignationColor(designation) {
  if (!designation) return null
  let hash = 0
  for (let i = 0; i < designation.length; i++) {
    hash = ((hash << 5) - hash) + designation.charCodeAt(i)
    hash = hash & hash // Convert to 32-bit integer
  }
  const colorIndex = Math.abs(hash) % DESIGNATION_COLORS.length
  return DESIGNATION_COLORS[colorIndex]
}

export default function EmployeesPage() {
  const [employees,    setEmployees]    = useState([])
  const [archived,     setArchived]     = useState([])
  const [designations, setDesignations] = useState([])
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(true)
  const [showAdd,      setShowAdd]      = useState(false)
  const [showBulk,     setShowBulk]     = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [expanded,     setExpanded]     = useState(null)
  const [editEmp,      setEditEmp]      = useState(null)
  const [archiveModal, setArchiveModal] = useState(null) // emp to archive
  const [todayStatuses, setTodayStatuses] = useState({})

  // Load today statuses from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('employee-today-statuses')
    if (saved) {
      try {
        setTodayStatuses(JSON.parse(saved))
      } catch (e) {
        console.error('Failed to load statuses from localStorage', e)
      }
    }
  }, [])

  // Save today statuses to localStorage whenever they change
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

  const filtered = employees.filter(e =>
    e.username.toLowerCase().includes(search.toLowerCase()) ||
    e.employeeId.toLowerCase().includes(search.toLowerCase()) ||
    (e.designation || '').toLowerCase().includes(search.toLowerCase())
  )

  // Export data as JSON file
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
      toast.success(`${name} archived — restore anytime from Archived`)
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

  function handleTodayStatus(empId, status) {
    setTodayStatuses(prev => ({ ...prev, [empId]: status }))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '.65rem' }}>
        <div style={{ minWidth: 0 }}>
          <h1 className="font-700" style={{ fontSize: '1.2rem' }}>Employees</h1>
          <div className="text-sm text-2">{employees.length} active{archived.length > 0 && ` · ${archived.length} archived`}</div>
        </div>
        <div className="flex gap-1" style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {archived.length > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowArchived(true)}>
              <ArchiveIcon /> Archived ({archived.length})
            </button>
          )}
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
              expanded={expanded === emp._id}
              todayStatus={todayStatuses[emp._id]}
              onToggle={() => setExpanded(expanded === emp._id ? null : emp._id)}
              onEdit={() => setEditEmp(emp)}
              onExport={() => exportEmployee(emp)}
              onArchive={() => setArchiveModal(emp)}
              onTodayStatus={(s) => handleTodayStatus(emp._id, s)} />
          ))}
        </div>
      )}

      {showAdd  && <AddModal  designations={designations} onClose={() => setShowAdd(false)}  onDone={() => { setShowAdd(false);  load() }} />}
      {showBulk && <BulkModal designations={designations} onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); load() }} />}
      {editEmp  && <EditModal emp={editEmp} designations={designations} onClose={() => setEditEmp(null)} onDone={() => { setEditEmp(null); load() }} />}

      {/* Archive confirmation */}
      {archiveModal && (
        <div className="overlay" onClick={() => setArchiveModal(null)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Archive Employee</h2>
            <p className="text-sm text-2 mb-2">
              <strong style={{ color: 'var(--text)' }}>{archiveModal.username}</strong> will be archived. Their attendance records are kept safe and the employee can be restored anytime.
            </p>
            <div className="card" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', padding: '.75rem 1rem', marginBottom: '1rem' }}>
              <div className="text-xs text-2 mb-1" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' }}>Before archiving, you can also:</div>
              <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'flex-start', gap: '.5rem' }}
                onClick={() => { exportEmployee(archiveModal); }}>
                <ExportIcon /> Download employee data as backup
              </button>
            </div>
            <div className="flex gap-1">
              <button className="btn btn-secondary" onClick={() => setArchiveModal(null)}>Cancel</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-danger" onClick={() => { const e = archiveModal; setArchiveModal(null); archiveEmployee(e._id, e.username) }}>
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archived employees panel */}
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
                      <div className="emp-avatar" style={{ opacity: 0.6 }}>{emp.username.slice(0,2).toUpperCase()}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="font-600 text-sm">{emp.username}
                          <span className="tag" style={{ marginLeft: '.4rem', fontFamily: 'monospace', fontSize: '.68rem' }}>{emp.employeeId}</span>
                        </div>
                        {emp.archivedAt && <div className="text-xs text-2">Archived {new Date(emp.archivedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                      </div>
                      <div className="flex gap-1" style={{ flexShrink: 0 }}>
                        <button className="btn btn-secondary btn-sm" title="Export data"
                          onClick={() => exportEmployee(emp)} style={{ padding: '.3rem .55rem' }}>
                          <ExportIcon />
                        </button>
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

function TodayBadge({ status }) {
  if (!status) return null
  const cfg = TODAY_STATUS[status]
  if (!cfg) return null
  return (
    <span className="emp-today-badge" style={{ background: cfg.bg, color: cfg.color }}>
      <span className="emp-today-dot" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  )
}

function EmployeeCard({ emp, expanded, todayStatus, onToggle, onEdit, onExport, onArchive, onTodayStatus }) {
  const initials = emp.username.slice(0,2).toUpperCase()
  const designationColor = getDesignationColor(emp.designation)
  
  return (
    <div className="emp-card slide-in">
      <div className="emp-card-header" onClick={onToggle}>
        <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1 }}>
          <div className="emp-avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="font-600" style={{ display:'flex', alignItems:'center', gap:'.4rem', flexWrap:'wrap' }}>
              {emp.username}
              <span className="tag" style={{ fontSize: '.7rem', fontFamily: 'monospace', letterSpacing:'.04em' }}>{emp.employeeId}</span>
            </div>
            <div className="text-xs text-2" style={{ marginTop:'.1rem', display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap' }}>
              {emp.designation && (
                <span style={{
                  background: designationColor?.bg || '#f0f0f0',
                  color: designationColor?.color || '#666',
                  padding: '.2rem .55rem',
                  borderRadius: '.25rem',
                  fontWeight: 500,
                  fontSize: '.75rem',
                  whiteSpace: 'nowrap'
                }}>
                  {emp.designation}
                </span>
              )}
              {emp.contact && <span>{emp.contact}</span>}
              <TodayBadge status={todayStatus} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1" style={{ flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span className="tag" style={{ whiteSpace:'nowrap' }}>
            {emp.salaryType === 'daily' ? `Rs ${emp.salary}/day` : `Rs ${emp.salary?.toLocaleString()}/mo`}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); onEdit() }}>Edit</button>
          <button className="btn btn-secondary btn-sm" title="Export data" onClick={e => { e.stopPropagation(); onExport() }} style={{ padding: '.35rem .55rem' }}>
            <ExportIcon />
          </button>
          <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); onArchive() }}>Archive</button>
          <svg className={`chevron ${expanded ? 'open' : ''}`} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
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

function ArchiveIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="4" width="20" height="5" rx="2"/><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9"/><line x1="10" y1="13" x2="14" y2="13"/></svg> }
function ExportIcon()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> }

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
          {idLoading ? <div className="flex items-center gap-2"><span className="spinner" /><span className="text-sm text-2">Generating...</span></div>
            : <div className="id-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9h8M8 13h5"/></svg>{suggestedId}</div>}
          <div className="text-xs text-2 mt-1">Employee uses this mixed ID to log in</div>
        </div>
        <form onSubmit={submit}>
          <div className="form-group"><label className="label">Full Name</label><input className="input" placeholder="John Doe" value={form.username} onChange={set('username')} required /></div>
          <div className="grid-2">
            <div className="form-group"><label className="label">Contact</label><input className="input" placeholder="9876543210" value={form.contact} onChange={set('contact')} /></div>
            <div className="form-group"><label className="label">Designation</label><select className="input" value={form.designation} onChange={set('designation')}><option value="">None</option>{designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}</select></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="label">Salary Type</label><select className="input" value={form.salaryType} onChange={set('salaryType')}><option value="monthly">Monthly</option><option value="daily">Daily rate</option></select></div>
            <div className="form-group"><label className="label">{form.salaryType === 'daily' ? 'Daily Rate (Rs)' : 'Monthly Salary (Rs)'}</label><input className="input" type="number" placeholder="0" value={form.salary} onChange={set('salary')} /></div>
          </div>
          <div className="form-group"><label className="label">Login Password</label><input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={set('password')} required /></div>
          <div className="flex gap-1 mt-2">
            <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading || idLoading}>{loading ? <span className="spinner" /> : 'Add Employee'}</button>
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
            <div className="form-group"><label className="label">Contact</label><input className="input" value={form.contact} onChange={set('contact')} /></div>
            <div className="form-group"><label className="label">Designation</label><select className="input" value={form.designation} onChange={set('designation')}><option value="">None</option>{designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}</select></div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="label">Salary Type</label><select className="input" value={form.salaryType} onChange={set('salaryType')}><option value="monthly">Monthly</option><option value="daily">Daily rate</option></select></div>
            <div className="form-group"><label className="label">{form.salaryType === 'daily' ? 'Daily Rate (Rs)' : 'Monthly Salary (Rs)'}</label><input className="input" type="number" value={form.salary} onChange={set('salary')} /></div>
          </div>
          <div className="form-group"><label className="label">New Password (blank = keep)</label><input className="input" type="password" placeholder="New password" value={form.password} onChange={set('password')} /></div>
          <div className="flex gap-1 mt-2">
            <button type="button" className="btn btn-secondary btn-block" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? <span className="spinner" /> : 'Save'}</button>
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
        <div className="text-xs text-2 mb-2">Employee IDs are auto-generated.</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 600 }}>
            <thead><tr><th>Name *</th><th>Contact</th><th>Password *</th><th>Designation</th><th>Type</th><th>Salary</th><th></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input className="input" style={{ minWidth: 100 }} value={r.username} onChange={e => setRow(i,'username',e.target.value)} /></td>
                  <td><input className="input" style={{ minWidth: 90 }} value={r.contact}  onChange={e => setRow(i,'contact', e.target.value)} /></td>
                  <td><input className="input" type="password" style={{ minWidth: 90 }} value={r.password} onChange={e => setRow(i,'password',e.target.value)} /></td>
                  <td><select className="input" style={{ minWidth: 100 }} value={r.designation} onChange={e => setRow(i,'designation',e.target.value)}><option value="">None</option>{designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}</select></td>
                  <td><select className="input" style={{ minWidth: 90 }} value={r.salaryType} onChange={e => setRow(i,'salaryType',e.target.value)}><option value="monthly">Monthly</option><option value="daily">Daily</option></select></td>
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
          <button className="btn btn-primary" onClick={submit} disabled={loading}>{loading ? <span className="spinner" /> : 'Add All'}</button>
        </div>
      </div>
    </div>
  )
}

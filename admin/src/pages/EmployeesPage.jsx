import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import AttendanceCalendar from '../components/AttendanceCalendar'
import './EmployeesPage.css'

const TODAY_STATUS = {
  P: { label: 'Present', bg: 'rgba(16,185,129,0.15)', color: 'var(--success)', dot: '#10b981' },
  A: { label: 'Absent', bg: 'rgba(239,68,68,0.12)', color: 'var(--danger)', dot: '#ef4444' },
  PP: { label: 'Double', bg: 'rgba(167,139,250,0.15)', color: '#a78bfa', dot: '#a78bfa' },
  H: { label: 'Holiday', bg: 'rgba(245,158,11,0.12)', color: 'var(--warn)', dot: '#f59e0b' },
}

const BULK_ACTIONS = [
  { status: 'P', label: 'Present', className: 'bulk-btn-p' },
  { status: 'A', label: 'Absent', className: 'bulk-btn-a' },
  { status: 'PP', label: 'Double', className: 'bulk-btn-pp' },
]

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
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function EmployeesPage() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [archived, setArchived] = useState([])
  const [designations, setDesignations] = useState([])
  const [search, setSearch] = useState('')
  const [filterDesig, setFilterDesig] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [editEmp, setEditEmp] = useState(null)
  const [archiveModal, setArchiveModal] = useState(null)
  const [todayStatuses, setTodayStatuses] = useState({})

  // ── Multi-select attendance workflow ──
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDate, setBulkDate] = useState(todayISO())
  const [bulkRemark, setBulkRemark] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('employee-today-statuses')
    if (saved) { try { setTodayStatuses(JSON.parse(saved)) } catch { } }
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

  function toggleSelectMode() {
    setSelectMode(v => !v)
    setSelectedIds([])
    setExpanded(null)
  }

  function toggleSelected(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function selectAllFiltered() {
    setSelectedIds(filtered.map(e => e._id))
  }

  async function markBulk(status) {
    if (!selectedIds.length) { toast.error('Select at least one employee'); return }
    setBulkBusy(true)
    try {
      const { data } = await api.post('/attendance/bulk', {
        employeeIds: selectedIds, date: bulkDate, status, remark: bulkRemark
      })
      toast.success(`Marked ${data.updatedCount} employee${data.updatedCount === 1 ? '' : 's'} as ${TODAY_STATUS[status]?.label || status}`)
      if (bulkDate === todayISO()) {
        setTodayStatuses(prev => {
          const next = { ...prev }
          data.updated.forEach(u => { next[u.id] = status })
          return next
        })
      }
      setSelectedIds([])
    } catch (err) { toast.error(err.response?.data?.error || 'Bulk marking failed') }
    finally { setBulkBusy(false) }
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
          <button className={`btn btn-sm ${selectMode ? 'btn-primary' : 'btn-secondary'}`} onClick={toggleSelectMode}>
            <CheckSquareIcon /> {selectMode ? 'Cancel Select' : 'Mark Attendance'}
          </button>
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
            <option value="">--Select--</option>
            {uniqueDesignations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {/* Bulk attendance toolbar */}
      {selectMode && (
        <div className="bulk-toolbar fade-in">
          <div className="bulk-toolbar-row">
            <div className="bulk-count">
              <strong>{selectedIds.length}</strong> selected
              <button className="bulk-link" onClick={selectAllFiltered}>Select all ({filtered.length})</button>
              {selectedIds.length > 0 && <button className="bulk-link" onClick={() => setSelectedIds([])}>Clear</button>}
            </div>
            <div className="bulk-date-field">
              <CalendarIcon />
              <input type="date" className="input bulk-date-input" value={bulkDate} max={todayISO()}
                onChange={e => setBulkDate(e.target.value)} />
            </div>
          </div>
          <div className="bulk-toolbar-row">
            <input className="input bulk-remark-input" placeholder="Remark (optional)"
              value={bulkRemark} onChange={e => setBulkRemark(e.target.value)} />
            <div className="bulk-actions">
              {BULK_ACTIONS.map(a => (
                <button key={a.status} className={`bulk-btn ${a.className}`} disabled={bulkBusy || !selectedIds.length}
                  onClick={() => markBulk(a.status)}>
                  {bulkBusy ? <span className="spinner" /> : `Mark ${a.label}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {employees.length > 0 && !selectMode && (
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
              selectMode={selectMode}
              selected={selectedIds.includes(emp._id)}
              onToggleSelected={() => toggleSelected(emp._id)}
              onToggle={() => setExpanded(expanded === emp._id ? null : emp._id)}
              onEdit={() => setEditEmp(emp)}
              onView={() => navigate(`/employees/${emp._id}`)}
              onExport={() => exportEmployee(emp)}
              onArchive={() => setArchiveModal(emp)}
              onTodayStatus={s => setTodayStatuses(p => ({ ...p, [emp._id]: s }))} />
          ))}
        </div>
      )}

      {showAdd && <AddModal designations={designations} onClose={() => setShowAdd(false)} onDone={() => { setShowAdd(false); load() }} />}
      {showBulk && <BulkModal designations={designations} onClose={() => setShowBulk(false)} onDone={() => { setShowBulk(false); load() }} />}
      {editEmp && <EditModal emp={editEmp} designations={designations} onClose={() => setEditEmp(null)} onDone={() => { setEditEmp(null); load() }} />}

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

function EmployeeCard({ emp, expanded, todayStatus, selectMode, selected, onToggleSelected, onToggle, onEdit, onView, onExport, onArchive, onTodayStatus }) {
  const dColor = getDesignationColor(emp.designation)
  const todayCfg = todayStatus ? TODAY_STATUS[todayStatus] : null

  function handleMainClick() {
    if (selectMode) onToggleSelected()
    else onToggle()
  }

  // Collapsed: just name + designation + a "next" (expand) button.
  // Expanded: full identity block (name, ID, designation, mobile) plus salary/actions.
  return (
    <div className={`emp-card ${expanded ? 'expanded' : ''} ${selectMode ? 'selectable' : ''} ${selected ? 'selected' : ''}`}>
      <div className="emp-card-main" onClick={handleMainClick}>
        <div className="emp-card-left">
          {selectMode && (
            <span className={`emp-checkbox ${selected ? 'checked' : ''}`} onClick={e => { e.stopPropagation(); onToggleSelected() }}>
              {selected && <CheckIcon />}
            </span>
          )}
          <div className="emp-avatar">
            {initials(emp.username)}
            {todayCfg && <span className="emp-status-dot" style={{ background: todayCfg.dot }} />}
          </div>

          {!expanded ? (
            /* ── Collapsed: name & designation only ── */
            <div className="emp-card-info">
              <div className="emp-name">{emp.username}</div>
              <div className="emp-meta">
                {emp.designation ? (
                  <span className="emp-desg-tag" style={{ background: dColor?.bg, color: dColor?.color }}>
                    {emp.designation}
                  </span>
                ) : <span className="text-xs text-2">No designation</span>}
              </div>
            </div>
          ) : (
            /* ── Expanded: full info — name, ID, designation, mobile ── */
            <div className="emp-card-info">
              <div className="emp-name">
                {emp.username}
                <span className="emp-id-badge">{emp.employeeId}</span>
                {emp.hasIdProof && <span className="emp-idproof-chip" title="Identification proof on file"><IdIcon /></span>}
              </div>
              <div className="emp-meta">
                {emp.designation && (
                  <span className="emp-desg-tag" style={{ background: dColor?.bg, color: dColor?.color }}>
                    {emp.designation}
                  </span>
                )}
                {emp.contact && <span className="emp-contact">{emp.contact}</span>}
                {!emp.hasPassword && <span className="emp-nopass-tag" title="Employee cannot log in yet">No password set</span>}
                {todayCfg && (
                  <span className="emp-today-badge" style={{ background: todayCfg.bg, color: todayCfg.color }}>
                    <span className="emp-today-dot" style={{ background: todayCfg.dot }} />
                    {todayCfg.label}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {!selectMode && (
          <div className="emp-card-right">
            {expanded && (
              <>
                <div className="emp-salary">
                  <span className="emp-salary-amount">₹{emp.salary?.toLocaleString()}</span>
                  <span className="emp-salary-type">/mo</span>
                </div>
                <div className="emp-actions" onClick={e => e.stopPropagation()}>
                  <button className="emp-action-btn" title="View profile" onClick={onView}><EyeIcon /></button>
                  <button className="emp-action-btn" title="Edit" onClick={onEdit}><EditIcon /></button>
                  <button className="emp-action-btn emp-action-danger" title="Archive" onClick={onArchive}><ArchiveIcon /></button>
                </div>
              </>
            )}
            <button className="emp-next-btn" title={expanded ? 'Collapse' : 'View details'} onClick={e => { e.stopPropagation(); onToggle() }}>
              <ChevronIcon className={`emp-chevron ${expanded ? 'open' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {expanded && !selectMode && (
        <div className="emp-card-body fade-in">
          <AttendanceCalendar employeeId={emp._id} adminMode onTodayStatus={onTodayStatus} summaryFooter />
        </div>
      )}
    </div>
  )
}

function IdProofPicker({ file, setFile, existingUrl, hasExisting, onRemoveExisting, removing }) {
  const inputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const displayUrl = previewUrl || existingUrl

  return (
    <div className="form-group">
      <label className="label">Identification Proof</label>
      <div className="idproof-picker">
        <div className="idproof-preview" onClick={() => inputRef.current?.click()}>
          {displayUrl ? <img src={displayUrl} alt="ID proof preview" /> : <IdIcon />}
        </div>
        <div style={{ flex: 1 }}>
          <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={e => setFile(e.target.files?.[0] || null)} />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
            {displayUrl ? 'Replace Image' : 'Upload Image'}
          </button>
          {file && <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: '.4rem' }} onClick={() => setFile(null)}>Undo</button>}
          {!file && hasExisting && (
            <button type="button" className="btn btn-danger btn-sm" style={{ marginLeft: '.4rem' }} disabled={removing} onClick={onRemoveExisting}>
              {removing ? <span className="spinner" /> : 'Remove'}
            </button>
          )}
          <div className="text-xs text-2 mt-1">Any image works — it's auto-converted to a compressed JPEG (~100–200KB)</div>
        </div>
      </div>
    </div>
  )
}

function AddModal({ designations, onClose, onDone }) {
  const [form, setForm] = useState({ username: '', contact: '', email: '', password: '', salary: '', designation: '' })
  const [idProofFile, setIdProofFile] = useState(null)
  const [suggestedId, setSuggestedId] = useState('')
  const [loading, setLoading] = useState(false)
  const [idLoading, setIdLoading] = useState(true)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    api.get('/employees/suggest-id').then(r => setSuggestedId(r.data.employeeId)).catch(() => { }).finally(() => setIdLoading(false))
  }, [])

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/employees', { ...form, employeeId: suggestedId })
      if (idProofFile) {
        try {
          const fd = new FormData(); fd.append('idProof', idProofFile)
          await api.post(`/employees/${data.id}/id-proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        } catch { toast.error('Employee added, but the ID proof image failed to upload') }
      }
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
            <label className="label">Employee Name *</label>
            <input className="input" placeholder="John Doe" value={form.username} onChange={set('username')} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Mobile Number *</label>
              <input className="input" placeholder="9876543210" value={form.contact} onChange={set('contact')} required />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="optional" value={form.email} onChange={set('email')} />
            </div>
          </div>
          <div className="grid-2">
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
            <div className="form-group">
              <label className="label">Monthly Salary (₹)</label>
              <input className="input" type="number" min="0" placeholder="0" value={form.salary} onChange={set('salary')} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Login Password (optional)</label>
            <input className="input" type="password" placeholder="Can be added later" value={form.password} onChange={set('password')} />
            <div className="text-xs text-2 mt-1">Leave blank — the employee just won't be able to log in until a password is set</div>
          </div>
          <IdProofPicker file={idProofFile} setFile={setIdProofFile} existingUrl={null} hasExisting={false} />
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
    username: emp.username || '', contact: emp.contact || '', email: emp.email || '',
    salary: emp.salary || '', designation: emp.designation || '', password: ''
  })
  const [loading, setLoading] = useState(false)
  const [idProofFile, setIdProofFile] = useState(null)
  const [existingUrl, setExistingUrl] = useState(null)
  const [hasExisting, setHasExisting] = useState(!!emp.hasIdProof)
  const [removingProof, setRemovingProof] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  useEffect(() => {
    if (!emp.hasIdProof) return
    let url
    api.get(`/employees/${emp._id}/id-proof`, { responseType: 'blob' })
      .then(res => { url = URL.createObjectURL(res.data); setExistingUrl(url) })
      .catch(() => { })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [emp._id, emp.hasIdProof])

  async function removeExisting() {
    if (!confirm('Remove the identification proof image for this employee?')) return
    setRemovingProof(true)
    try {
      await api.delete(`/employees/${emp._id}/id-proof`)
      setExistingUrl(null); setHasExisting(false)
      toast.success('Identification proof removed')
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to remove') }
    finally { setRemovingProof(false) }
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { username: form.username, contact: form.contact, email: form.email, salary: form.salary, designation: form.designation }
    if (form.password) payload.password = form.password
    try {
      await api.put(`/employees/${emp._id}`, payload)
      if (idProofFile) {
        try {
          const fd = new FormData(); fd.append('idProof', idProofFile)
          await api.post(`/employees/${emp._id}/id-proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        } catch { toast.error('Details saved, but the ID proof image failed to upload') }
      }
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
          <div className="form-group">
            <label className="label">Employee Name *</label>
            <input className="input" value={form.username} onChange={set('username')} required />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Mobile Number *</label>
              <input className="input" value={form.contact} onChange={set('contact')} required />
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email} onChange={set('email')} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Designation</label>
              <select className="input" value={form.designation} onChange={set('designation')}>
                <option value="">None</option>
                {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Monthly Salary (₹)</label>
              <input className="input" type="number" min="0" value={form.salary} onChange={set('salary')} />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Password {emp.hasPassword ? '(blank = keep current)' : '(not yet set)'}</label>
            <input className="input" type="password" placeholder={emp.hasPassword ? 'Leave blank to keep' : 'Set a login password'} value={form.password} onChange={set('password')} />
          </div>
          <IdProofPicker file={idProofFile} setFile={setIdProofFile} existingUrl={existingUrl}
            hasExisting={hasExisting} onRemoveExisting={removeExisting} removing={removingProof} />
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
  const [rows, setRows] = useState([{ username: '', contact: '', password: '', salary: '', designation: '' }])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)

  function setRow(i, k, v) { setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row)) }
  function addRow() { setRows(r => [...r, { username: '', contact: '', password: '', salary: '', designation: '' }]) }
  function remRow(i) { setRows(r => r.filter((_, idx) => idx !== i)) }

  async function submit() {
    const valid = rows.filter(r => r.username && r.contact)
    if (!valid.length) { toast.error('At least one row needs a Name and Mobile Number'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/employees/bulk', { employees: valid })
      setResults(data)
      if (data.created.length) toast.success(`${data.created.length} added`)
      if (data.failed.length) toast.error(`${data.failed.length} failed`)
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
        <div className="text-xs text-2 mb-2">Employee IDs are auto-generated. Name and Mobile Number are required per row — passwords can be added later.</div>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl" style={{ minWidth: 600 }}>
            <thead>
              <tr><th>Name *</th><th>Mobile *</th><th>Designation</th><th>Monthly Salary</th><th>Password</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><input className="input" style={{ minWidth: 100 }} placeholder='Name' value={r.username} onChange={e => setRow(i, 'username', e.target.value)} /></td>
                  <td><input className="input" type='text' style={{ minWidth: 90 }} placeholder='Mobile number' value={r.contact} onChange={e => setRow(i, 'contact', e.target.value)} /></td>
                  <td>
                    <select className="input" style={{ minWidth: 110 }} value={r.designation} onChange={e => setRow(i, 'designation', e.target.value)}>
                      <option value="">None</option>
                      {designations.map(d => <option key={d._id} value={d.name}>{d.name}</option>)}
                    </select>
                  </td>
                  <td><input className="input" type="number" placeholder='salary' style={{ minWidth: 70 }} value={r.salary} onChange={e => setRow(i, 'salary', e.target.value)} /></td>
                  <td><input className="input" type="password" placeholder='optional' style={{ minWidth: 90 }} value={r.password} onChange={e => setRow(i, 'password', e.target.value)} /></td>
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
function PlusIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg> }
function BulkIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg> }
function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg> }
function PeopleIcon() { return <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
function EditIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> }
function EyeIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg> }
function ExportIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg> }
function ArchiveIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="5" rx="2" /><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" /><line x1="10" y1="13" x2="14" y2="13" /></svg> }
function ChevronIcon({ className }) { return <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg> }
function IdIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h5" /></svg> }
function CheckSquareIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg> }
function CheckIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> }
function CalendarIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> }

import { useState, useEffect, useMemo } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import AttendanceCalendar from '../components/AttendanceCalendar'
import './EmployeesPage.css'
import './AttendancePage.css'

const BULK_ACTIONS = [
  { status: 'P',  label: 'Present', className: 'bulk-btn-p' },
  { status: 'A',  label: 'Absent',  className: 'bulk-btn-a' },
  { status: 'PP', label: 'Double',  className: 'bulk-btn-pp' },
]

function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function initials(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
  return (name || '').slice(0, 2).toUpperCase()
}

export default function AttendancePage() {
  const [employees, setEmployees] = useState([])
  const [selected, setSelected]   = useState('')
  const [loading, setLoading]     = useState(true)
  const [mode, setMode]           = useState('single') // 'single' | 'bulk'

  // Bulk-mark state
  const [search, setSearch]         = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDate, setBulkDate]     = useState(todayISO())
  const [bulkRemark, setBulkRemark] = useState('')
  const [bulkBusy, setBulkBusy]     = useState(false)
  const [lastResult, setLastResult] = useState(null)

  useEffect(() => {
    api.get('/employees')
      .then(r => { setEmployees(r.data); if (r.data.length) setSelected(r.data[0]._id) })
      .catch(() => toast.error('Failed to load employees'))
      .finally(() => setLoading(false))
  }, [])

  const emp = employees.find(e => e._id === selected)

  const filteredForBulk = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return employees
    return employees.filter(e =>
      e.username.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) ||
      (e.designation || '').toLowerCase().includes(q)
    )
  }, [employees, search])

  function toggleSelected(id) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function selectAllFiltered() {
    setSelectedIds(filteredForBulk.map(e => e._id))
  }

  async function markBulk(status) {
    if (!selectedIds.length) { toast.error('Select at least one employee'); return }
    setBulkBusy(true)
    setLastResult(null)
    try {
      const { data } = await api.post('/attendance/bulk', {
        employeeIds: selectedIds, date: bulkDate, status, remark: bulkRemark
      })
      toast.success(`Marked ${data.updatedCount} employee${data.updatedCount === 1 ? '' : 's'} as ${status === 'P' ? 'Present' : status === 'A' ? 'Absent' : 'Double'}`)
      setLastResult({ status, date: bulkDate, employees: data.updated })
      setSelectedIds([])
    } catch (err) { toast.error(err.response?.data?.error || 'Bulk marking failed') }
    finally { setBulkBusy(false) }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '.75rem' }}>
        <h1 className="font-700" style={{ fontSize: '1.25rem' }}>Attendance</h1>
        <div className="att-tabs">
          <button className={`att-tab ${mode === 'single' ? 'active' : ''}`} onClick={() => setMode('single')}>
            Single Employee
          </button>
          <button className={`att-tab ${mode === 'bulk' ? 'active' : ''}`} onClick={() => setMode('bulk')}>
            Mark Multiple
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}><span className="spinner" /></div>
      ) : employees.length === 0 ? (
        <div className="empty card">No employees found. Add employees first.</div>
      ) : mode === 'single' ? (
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
                <div className="emp-avatar">{initials(emp.username)}</div>
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
      ) : (
        <div className="att-bulk fade-in">
          <div className="bulk-toolbar">
            <div className="bulk-toolbar-row">
              <div className="bulk-count">
                <strong>{selectedIds.length}</strong> of {employees.length} selected
                <button className="bulk-link" onClick={selectAllFiltered}>Select all{search ? ` (${filteredForBulk.length})` : ''}</button>
                {selectedIds.length > 0 && <button className="bulk-link" onClick={() => setSelectedIds([])}>Clear</button>}
              </div>
              <div className="bulk-date-field">
                <CalendarIcon />
                <input type="date" className="input bulk-date-input" value={bulkDate} max={todayISO()}
                  onChange={e => setBulkDate(e.target.value)} />
              </div>
            </div>
            <div className="bulk-toolbar-row">
              <input className="input bulk-remark-input" placeholder="Remark (optional, applied to all selected)"
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

          <div className="search-wrap mt-2">
            <SearchIcon />
            <input className="input" placeholder="Search by name, ID, or designation..."
              value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button className="search-clear" onClick={() => setSearch('')}>×</button>}
          </div>

          <div className="att-bulk-list mt-2">
            {filteredForBulk.map(e => {
              const isSelected = selectedIds.includes(e._id)
              return (
                <div key={e._id} className={`att-bulk-row ${isSelected ? 'selected' : ''}`} onClick={() => toggleSelected(e._id)}>
                  <span className={`emp-checkbox ${isSelected ? 'checked' : ''}`}>
                    {isSelected && <CheckIcon />}
                  </span>
                  <div className="emp-avatar emp-avatar-sm">{initials(e.username)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="font-600 text-sm">{e.username} <span className="emp-id-badge">{e.employeeId}</span></div>
                    {e.designation && <div className="text-xs text-2 mt-1">{e.designation}</div>}
                  </div>
                </div>
              )
            })}
            {filteredForBulk.length === 0 && <div className="text-sm text-2" style={{ padding: '1rem' }}>No employees match your search.</div>}
          </div>

          {lastResult && (
            <div className="card mt-2">
              <div className="font-600 text-sm mb-1">
                Last action: marked {lastResult.employees.length} employee{lastResult.employees.length === 1 ? '' : 's'} as{' '}
                {lastResult.status === 'P' ? 'Present' : lastResult.status === 'A' ? 'Absent' : 'Double'} on{' '}
                {new Date(lastResult.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
              <div className="text-xs text-2">{lastResult.employees.map(e => e.username).join(', ')}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg> }
function CalendarIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function CheckIcon() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> }

import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './EmployeesPage.css'
import './MyEmployeesPage.css'

function initials(name) {
  const parts = (name || '').trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  return (name || '').slice(0, 2).toUpperCase()
}

export default function MyEmployeesPage() {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDesig, setFilterDesig] = useState('')
  const [proofModal, setProofModal] = useState(null) // employee for which the quick-upload modal is open

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/employees')
      setEmployees(data)
    } catch { toast.error('Failed to load employees') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const uniqueDesignations = [...new Set(employees.map(e => e.designation).filter(Boolean))].sort()

  const filtered = employees.filter(e => {
    const q = search.toLowerCase()
    const matchSearch = !q || e.username.toLowerCase().includes(q) ||
      e.employeeId.toLowerCase().includes(q) || (e.contact || '').includes(q) ||
      (e.designation || '').toLowerCase().includes(q)
    const matchDesig = !filterDesig || e.designation === filterDesig
    return matchSearch && matchDesig
  })

  return (
    <div className="emp-page">
      <div className="emp-page-header">
        <div>
          <h1 className="emp-page-title">My Employees</h1>
          <div className="emp-page-meta">
            {employees.length} employee{employees.length === 1 ? '' : 's'} · full roster & documents
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="emp-filters">
        <div className="search-wrap">
          <SearchIcon />
          <input className="input" placeholder="Search by name, ID, mobile, or designation..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}>×</button>}
        </div>
        {uniqueDesignations.length > 0 && (
          <select className="input emp-filter-select" value={filterDesig} onChange={e => setFilterDesig(e.target.value)}>
            <option value="">All designations</option>
            {uniqueDesignations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="emp-loading"><span className="spinner" /><span>Loading employees...</span></div>
      ) : filtered.length === 0 ? (
        <div className="emp-empty">
          <div className="emp-empty-title">{search || filterDesig ? 'No employees match your filters' : 'No employees yet'}</div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card myemp-table-wrapper" style={{ padding: 0 }}>
            <div className="myemp-table-desktop">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Designation</th>
                    <th>Mobile</th>
                    <th>Email</th>
                    <th>Salary</th>
                    <th>ID Proof</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(emp => (
                    <tr key={emp._id}>
                      <td>
                        <div className="flex items-center gap-1">
                          <div className="emp-avatar emp-avatar-sm">{initials(emp.username)}</div>
                          <div>
                            <div className="font-600 text-sm">{emp.username}</div>
                            <div className="emp-id-badge">{emp.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm text-2">{emp.designation || '—'}</td>
                      <td className="text-sm">{emp.contact || '—'}</td>
                      <td className="text-sm text-2">{emp.email || '—'}</td>
                      <td className="text-sm">{emp.salary ? `₹${emp.salary.toLocaleString()}/mo` : '—'}</td>
                      <td>
                        {emp.hasIdProof
                          ? <span className="myemp-proof-chip myemp-proof-yes"><IdIcon /> On file</span>
                          : <span className="myemp-proof-chip myemp-proof-no">Missing</span>}
                      </td>
                      <td>
                        <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => setProofModal(emp)}>
                            <UploadIcon /> ID Proof
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => navigate(`/employees/${emp._id}?tab=edit`)}>
                            <EditIcon /> Edit Profile
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="myemp-table-mobile">
              {filtered.map(emp => (
                <div key={emp._id} className="myemp-mobile-card">
                  <div className="flex items-center gap-1">
                    <div className="emp-avatar emp-avatar-sm">{initials(emp.username)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-600 text-sm">{emp.username} <span className="emp-id-badge">{emp.employeeId}</span></div>
                      <div className="text-xs text-2 mt-1">{emp.designation || 'No designation'}</div>
                    </div>
                    {emp.hasIdProof
                      ? <span className="myemp-proof-chip myemp-proof-yes"><IdIcon /></span>
                      : <span className="myemp-proof-chip myemp-proof-no">!</span>}
                  </div>
                  <div className="myemp-mobile-details">
                    <div><span className="text-2">Mobile</span><span>{emp.contact || '—'}</span></div>
                    <div><span className="text-2">Email</span><span>{emp.email || '—'}</span></div>
                    <div><span className="text-2">Salary</span><span>{emp.salary ? `₹${emp.salary.toLocaleString()}/mo` : '—'}</span></div>
                  </div>
                  <div className="flex gap-1 mt-1">
                    <button className="btn btn-secondary btn-sm btn-block" onClick={() => setProofModal(emp)}>
                      <UploadIcon /> ID Proof
                    </button>
                    <button className="btn btn-primary btn-sm btn-block" onClick={() => navigate(`/employees/${emp._id}?tab=edit`)}>
                      <EditIcon /> Edit Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {proofModal && (
        <IdProofModal emp={proofModal} onClose={() => setProofModal(null)}
          onDone={() => { setProofModal(null); load() }} />
      )}
    </div>
  )
}

function IdProofModal({ emp, onClose, onDone }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [existingUrl, setExistingUrl] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    if (!emp.hasIdProof) return
    let url
    api.get(`/employees/${emp._id}/id-proof`, { responseType: 'blob' })
      .then(res => { url = URL.createObjectURL(res.data); setExistingUrl(url) })
      .catch(() => { })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [emp._id, emp.hasIdProof])

  useEffect(() => {
    if (!file) { setPreviewUrl(null); return }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function upload() {
    if (!file) { toast.error('Choose an image first'); return }
    setUploading(true)
    try {
      const fd = new FormData(); fd.append('idProof', file)
      await api.post(`/employees/${emp._id}/id-proof`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Identification proof uploaded')
      onDone()
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed') }
    finally { setUploading(false) }
  }

  async function removeExisting() {
    if (!confirm(`Remove the identification proof for ${emp.username}?`)) return
    setRemoving(true)
    try {
      await api.delete(`/employees/${emp._id}/id-proof`)
      toast.success('Identification proof removed')
      onDone()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to remove') }
    finally { setRemoving(false) }
  }

  const displayUrl = previewUrl || existingUrl

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Identification Proof — {emp.username}</h2>
        <div className="idproof-picker">
          <div className="idproof-preview" style={{ width: 90, height: 90 }} onClick={() => inputRef.current?.click()}>
            {displayUrl ? <img src={displayUrl} alt="ID proof preview" /> : <IdIcon />}
          </div>
          <div style={{ flex: 1 }}>
            <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => setFile(e.target.files?.[0] || null)} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
              {displayUrl ? 'Choose different image' : 'Choose image'}
            </button>
            <div className="text-xs text-2 mt-1">Any image works — it's auto-compressed before saving.</div>
          </div>
        </div>
        <div className="flex gap-1 mt-2">
          {emp.hasIdProof && !file && (
            <button className="btn btn-danger btn-sm" disabled={removing} onClick={removeExisting}>
              {removing ? <span className="spinner" /> : 'Remove Current'}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!file || uploading} onClick={upload}>
            {uploading ? <span className="spinner" /> : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SearchIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg> }
function IdIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M8 9h8M8 13h5" /></svg> }
function EditIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg> }
function UploadIcon() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg> }

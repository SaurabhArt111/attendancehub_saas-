import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './DesignationsPage.css'

export default function DesignationsPage() {
  const [list,    setList]    = useState([])
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [renameId, setRenameId] = useState(null)
  const [renameName, setRenameName] = useState('')
  const [renaming, setRenaming] = useState(false)

  const load = () => api.get('/designations').then(r => setList(r.data)).catch(() => toast.error('Load failed'))
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
        <div className="card" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>Designation</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {list.map((d, i) => (
                <tr key={d._id}>
                  <td className="text-2 text-sm">{i + 1}</td>
                  <td className="font-600">{d.name}</td>
                  <td>
                    <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => startRename(d)}>Rename</button>
                      <button className="btn btn-danger btn-sm" onClick={() => del(d._id, d.name)}>Remove</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import './DesignationsPage.css'

export default function DesignationsPage() {
  const [list, setList]   = useState([])
  const [name, setName]   = useState('')
  const [loading, setLoading] = useState(false)

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
    try { await api.delete(`/designations/${id}`); toast.success('Removed'); load() }
    catch { toast.error('Delete failed') }
  }

  return (
    <div>
      <h1 className="font-700 mb-2" style={{ fontSize: '1.2rem' }}>Designations</h1>
      <p className="text-sm text-2 mb-2">Create designations (job titles) for your employees. These appear in reports and employee profiles.</p>

      <div className="card mb-2">
        <div className="font-600 mb-2">Add Designation</div>
        <form onSubmit={add} className="flex gap-1">
          <input className="input" placeholder="e.g. Manager, Sales Executive, Driver..." value={name} onChange={e => setName(e.target.value)} required />
          <button type="submit" className="btn btn-primary" style={{ whiteSpace:'nowrap' }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Add'}
          </button>
        </form>
      </div>

      {list.length === 0 ? (
        <div className="empty card">No designations yet. Add your first one above.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr><th>#</th><th>Designation</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((d, i) => (
                <tr key={d._id}>
                  <td className="text-2 text-sm">{i+1}</td>
                  <td className="font-600">{d.name}</td>
                  <td className="text-right">
                    <button className="btn btn-danger btn-sm" onClick={() => del(d._id, d.name)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

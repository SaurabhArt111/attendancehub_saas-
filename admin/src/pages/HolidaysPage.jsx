import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState([])
  const [form, setForm] = useState({ date: '', name: '' })
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }))

  const load = () => api.get('/holidays').then(r => setHolidays(r.data)).catch(() => toast.error('Failed to load'))
  useEffect(() => { load() }, [])

  async function add(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/holidays', form)
      toast.success('Holiday added')
      setForm({ date: '', name: '' })
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add') }
    finally { setLoading(false) }
  }

  async function del(id) {
    try {
      await api.delete(`/holidays/${id}`)
      toast.success('Holiday removed')
      load()
    } catch { toast.error('Failed to delete') }
  }

  const upcoming = holidays.filter(h => new Date(h.date) >= new Date(new Date().toDateString()))
  const past     = holidays.filter(h => new Date(h.date) <  new Date(new Date().toDateString()))

  return (
    <div>
      <h1 className="font-700 mb-2" style={{ fontSize: '1.25rem' }}>Holidays</h1>

      <div className="card mb-2">
        <div className="font-600 mb-2">Add Holiday</div>
        <form onSubmit={add}>
          <div className="grid-2">
            <div className="form-group">
              <label className="label">Date</label>
              <input className="input" type="date" value={form.date} onChange={set('date')} required />
            </div>
            <div className="form-group">
              <label className="label">Holiday Name</label>
              <input className="input" placeholder="Diwali" value={form.name} onChange={set('name')} required />
            </div>
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Add Holiday'}
          </button>
        </form>
      </div>

      {upcoming.length > 0 && (
        <div className="card mb-2">
          <div className="font-600 mb-1 text-success">Upcoming Holidays</div>
          <HolidayList holidays={upcoming} onDelete={del} />
        </div>
      )}

      {past.length > 0 && (
        <div className="card">
          <div className="font-600 mb-1 text-2">Past Holidays</div>
          <HolidayList holidays={past} onDelete={del} />
        </div>
      )}

      {holidays.length === 0 && (
        <div className="empty card">No holidays added yet.</div>
      )}
    </div>
  )
}

function HolidayList({ holidays, onDelete }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      {holidays.map(h => (
        <div key={h._id} className="flex items-center justify-between"
          style={{ padding: '.6rem .75rem', background: 'var(--bg3)', borderRadius: 8 }}>
          <div>
            <div className="font-600">{h.name}</div>
            <div className="text-xs text-2">{new Date(h.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(h._id)}>Remove</button>
        </div>
      ))}
    </div>
  )
}

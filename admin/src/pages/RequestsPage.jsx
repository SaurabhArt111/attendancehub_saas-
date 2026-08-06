import { useState, useEffect, useMemo } from 'react'
import api from '../utils/api'
import { toast } from '../components/Toaster'
import { RowListSkeleton } from '../components/Skeleton'
import './RequestsPage.css'

const FILTERS = [
  { v: 'pending', l: 'Pending' },
  { v: 'approved', l: 'Approved' },
  { v: 'rejected', l: 'Rejected' },
  { v: 'all', l: 'All' },
]

function fmtDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function leaveDayCount(r) {
  if (r.leaveKind === 'half') return 0.5
  const s = new Date(r.startDate + 'T00:00:00')
  const e = new Date(r.endDate + 'T00:00:00')
  return Math.round((e - s) / 86400000) + 1
}

export default function RequestsPage() {
  const [filter, setFilter] = useState('pending')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [reviewModal, setReviewModal] = useState(null) // { request, action }

  function load() {
    setLoading(true)
    const params = filter === 'all' ? {} : { status: filter }
    api.get('/requests', { params })
      .then(r => setRequests(r.data))
      .catch(() => toast.error('Failed to load requests'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [filter])

  async function submitReview(id, action) {
    try {
      await api.put(`/requests/${id}/${action}`)
      toast.success(action === 'approve' ? 'Request approved' : 'Request rejected')
      setReviewModal(null)
      load()
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update request') }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <div>
      <div className="flex items-center justify-between mb-2" style={{ flexWrap: 'wrap', gap: '.75rem' }}>
        <h1 className="font-700" style={{ fontSize: '1.25rem' }}>Attendance Requests</h1>
        <div className="att-tabs">
          {FILTERS.map(f => (
            <button key={f.v} className={`att-tab ${filter === f.v ? 'active' : ''}`} onClick={() => setFilter(f.v)}>
              {f.l}{f.v === 'pending' && filter !== 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <RowListSkeleton count={5} />
      ) : requests.length === 0 ? (
        <div className="empty card">No {filter === 'all' ? '' : filter} requests.</div>
      ) : (
        <div className="request-list">
          {requests.map(r => (
            <RequestCard key={r.id} r={r} onApprove={() => setReviewModal({ request: r, action: 'approve' })}
              onReject={() => setReviewModal({ request: r, action: 'reject' })} />
          ))}
        </div>
      )}

      {reviewModal && (
        <ReviewModal modal={reviewModal} onClose={() => setReviewModal(null)} onSubmit={submitReview} />
      )}
    </div>
  )
}

function RequestCard({ r, onApprove, onReject }) {
  return (
    <div className="request-card">
      <div className="request-card-top">
        <div className="flex items-center gap-2">
          <span className={`req-type-badge ${r.type}`}>{r.type === 'leave' ? 'Leave' : 'Correction'}</span>
          <div>
            <div className="font-600 text-sm">{r.employee?.username || 'Employee'}</div>
            <div className="text-xs text-2">{r.employee?.employeeId}</div>
          </div>
        </div>
        <span className={`req-status-badge ${r.status}`}>{r.status}</span>
      </div>

      <div className="request-card-body">
        {r.type === 'correction' ? (
          <>
            <div className="text-sm"><strong>Date:</strong> {fmtDate(r.date)}</div>
            {r.requestedStatus && <div className="text-sm"><strong>Requested status:</strong> {r.requestedStatus}</div>}
            {(r.requestedClockIn || r.requestedClockOut) && (
              <div className="text-sm">
                <strong>Times:</strong> {r.requestedClockIn || '—'} → {r.requestedClockOut || '—'}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="text-sm">
              <strong>{r.leaveKind === 'half' ? 'Half-Day Leave' : 'Leave'}:</strong> {fmtDate(r.startDate)}
              {r.leaveKind !== 'half' && r.endDate !== r.startDate ? ` → ${fmtDate(r.endDate)}` : ''}
              {r.leaveKind === 'half' && ` (${r.halfDaySession === 'first' ? 'First Half' : 'Second Half'})`}
            </div>
            <div className="text-xs text-2">{leaveDayCount(r)} day{leaveDayCount(r) === 1 ? '' : 's'}</div>
          </>
        )}
        <div className="text-sm text-2 mt-1" style={{ fontStyle: 'italic' }}>"{r.reason}"</div>

      </div>

      {r.status === 'pending' && (
        <div className="flex gap-1 mt-2">
          <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={onReject}>Reject</button>
          <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={onApprove}>Approve</button>
        </div>
      )}
    </div>
  )
}

function ReviewModal({ modal, onClose, onSubmit }) {
  const [busy, setBusy] = useState(false)
  const { request, action } = modal

  async function submit() {
    setBusy(true)
    await onSubmit(request.id, action)
    setBusy(false)
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{action === 'approve' ? 'Approve' : 'Reject'} Request</h2>
        <p className="text-sm text-2 mb-2">
          {action === 'approve'
            ? 'This will update the employee\'s attendance record automatically.'
            : 'The employee will see this request as rejected.'}
        </p>
        <div className="flex gap-1 mt-2">
          <button className="btn btn-secondary btn-block" onClick={onClose}>Cancel</button>
          <button className={`btn btn-block ${action === 'approve' ? 'btn-success' : 'btn-danger'}`} onClick={submit} disabled={busy}>
            {busy ? <span className="spinner" /> : action === 'approve' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  )
}

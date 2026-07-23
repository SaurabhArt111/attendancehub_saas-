import { useState } from 'react'
import { usePendingLogin } from '../context/PendingLoginContext'
import { toast } from './Toaster'

export default function PendingLoginModal() {
  const { requests, modalOpen, setModalOpen, approve, deny } = usePendingLogin()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  if (!modalOpen) return null

  const current = requests[0]

  function close() {
    setModalOpen(false)
    setCode('')
  }

  async function handleApprove() {
    if (!current) return
    if (code.trim().length !== 6) { toast.error('Enter the 6-digit security key shown on the other device'); return }
    setBusy(true)
    try {
      const remaining = await approve(current.id, code.trim())
      toast.success('Sign-in approved')
      setCode('')
      if (!remaining?.length) close()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Approval failed')
    } finally { setBusy(false) }
  }

  async function handleDeny() {
    if (!current) return
    setBusy(true)
    try {
      const remaining = await deny(current.id)
      toast.success('Sign-in denied')
      if (!remaining?.length) close()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to deny')
    } finally { setBusy(false) }
  }

  return (
    <div className="overlay" onClick={close}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">New sign-in request</h2>

        {!current ? (
          <div className="text-sm text-2">No pending sign-in requests right now.</div>
        ) : (
          <>
            <div className="text-sm mb-2">
              A device is trying to sign in to your account: <strong>{current.deviceLabel}</strong>
              {current.ip ? ` · ${current.ip}` : ''}
            </div>
            <div className="text-xs text-2 mb-3">
              If this is you, enter the security key shown on that device to approve it. If you don't recognize this, deny it.
            </div>
            <div className="form-group">
              <label className="label">Security key</label>
              <input
                className="input"
                style={{ fontFamily: 'monospace', letterSpacing: '.3em', fontSize: '1.15rem', textAlign: 'center' }}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
            </div>
            <div className="flex gap-1 mt-2">
              <button className="btn btn-danger btn-block" disabled={busy} onClick={handleDeny}>
                {busy ? <span className="spinner" /> : 'Deny'}
              </button>
              <button className="btn btn-primary btn-block" disabled={busy} onClick={handleApprove}>
                {busy ? <span className="spinner" /> : 'Approve'}
              </button>
            </div>
            {requests.length > 1 && (
              <div className="text-xs text-2 mt-2" style={{ textAlign: 'center' }}>
                +{requests.length - 1} more pending request{requests.length - 1 === 1 ? '' : 's'}
              </div>
            )}
          </>
        )}

        <button className="btn btn-secondary btn-block mt-2" onClick={close}>Close</button>
      </div>
    </div>
  )
}

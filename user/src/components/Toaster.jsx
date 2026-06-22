import { useState, useCallback } from 'react'

let _add = null
export const toast = {
  success: msg => _add?.({ msg, type: 'success' }),
  error:   msg => _add?.({ msg, type: 'error' }),
}

export default function Toaster() {
  const [items, setItems] = useState([])
  _add = useCallback(t => {
    const id = Date.now()
    setItems(p => [...p, { ...t, id }])
    setTimeout(() => setItems(p => p.filter(x => x.id !== id)), 3000)
  }, [])
  return (
    <div className="toast-wrap">
      {items.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  )
}

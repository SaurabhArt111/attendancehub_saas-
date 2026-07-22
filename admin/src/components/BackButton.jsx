import { useSmartBack } from '../utils/backNav'

// Reusable "Back" button — always returns to whichever page the user actually
// came from (real navigation history), falling back to `fallback` only when
// there's no previous in-app page to return to.
export default function BackButton({ fallback = '/employees', label = 'Back', className = 'btn btn-secondary btn-sm' }) {
  const goBack = useSmartBack(fallback)
  return (
    <button type="button" className={className} onClick={goBack}>
      <BackIcon /> {label}
    </button>
  )
}

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

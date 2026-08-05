// Reusable loading-skeleton primitives. `Skeleton` is the raw shimmering
// block; the rest are small compositions shaped like the real content they
// stand in for, so a page's layout is recognizable the instant it opens
// instead of jumping from a bare spinner straight to fully-populated data.

export function Skeleton({ width = '100%', height = 14, radius, circle = false, style = {}, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{
        width, height,
        borderRadius: circle ? '50%' : radius,
        flexShrink: 0,
        ...style
      }}
    />
  )
}

// A row of skeleton employee/report cards, matching the .emp-grid layout.
export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="emp-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-card" key={i}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Skeleton circle width={44} height={44} />
            <div style={{ flex: 1 }}>
              <Skeleton width="70%" height={15} style={{ marginBottom: 8 }} />
              <Skeleton width="45%" height={12} />
            </div>
          </div>
          <Skeleton width="90%" height={12} />
          <Skeleton width="60%" height={12} />
        </div>
      ))}
    </div>
  )
}

// A stack of table-like rows (Reports, Attendance grid, Sessions list).
export function RowListSkeleton({ count = 5 }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: count }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          <Skeleton circle width={38} height={38} />
          <div style={{ flex: 1 }}>
            <Skeleton width="40%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton width="65%" height={11} />
          </div>
          <Skeleton width={64} height={26} radius={8} />
        </div>
      ))}
    </div>
  )
}

// A single profile-header skeleton (EmployeeDetails).
export function ProfileSkeleton() {
  return (
    <div className="skeleton-stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Skeleton circle width={72} height={72} />
        <div style={{ flex: 1 }}>
          <Skeleton width="50%" height={20} style={{ marginBottom: 10 }} />
          <Skeleton width="30%" height={13} />
        </div>
      </div>
      <div className="skeleton-card">
        <Skeleton width="35%" height={13} />
        <Skeleton width="55%" height={13} />
        <Skeleton width="45%" height={13} />
      </div>
    </div>
  )
}

export default Skeleton

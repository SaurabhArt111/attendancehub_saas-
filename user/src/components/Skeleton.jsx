// Reusable loading-skeleton primitives, matching the shape of the cards
// they stand in for so each page's layout is recognizable the instant it
// opens, rather than jumping from a bare spinner to fully-populated content.

export function Skeleton({ width = '100%', height = 14, radius = 8, circle = false, style = {} }) {
  return (
    <span
      className="skeleton"
      style={{ width, height, borderRadius: circle ? '50%' : radius, flexShrink: 0, ...style }}
    />
  )
}

// Mirrors HomePage's profile-card + stats-grid + today-card layout.
export function HomeSkeleton() {
  return (
    <div className="skeleton-stack">
      <div className="card" style={{ textAlign: 'center' }}>
        <Skeleton circle width={64} height={64} style={{ margin: '0 auto .8rem' }} />
        <Skeleton width="50%" height={17} style={{ margin: '0 auto .5rem' }} />
        <Skeleton width="35%" height={13} style={{ margin: '0 auto' }} />
      </div>
      <div className="stats-grid">
        {[0, 1, 2].map(i => (
          <div className="card" key={i} style={{ textAlign: 'center' }}>
            <Skeleton width="40%" height={22} style={{ margin: '0 auto .4rem' }} />
            <Skeleton width="60%" height={11} style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
      <div className="card">
        <Skeleton width="30%" height={13} style={{ marginBottom: '.7rem' }} />
        <Skeleton width="100%" height={13} style={{ marginBottom: '.5rem' }} />
        <Skeleton width="80%" height={13} />
      </div>
    </div>
  )
}

// A 6x7 grid of skeleton calendar cells, matching .cal-grid.
export function CalendarSkeleton() {
  return (
    <div className="card">
      <Skeleton width="45%" height={15} style={{ marginBottom: '1rem' }} />
      <div className="cal-grid">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} height={34} radius={8} />
        ))}
      </div>
    </div>
  )
}

// Salary breakdown card skeleton, for the Payroll page.
export function PayrollSkeleton() {
  return (
    <div className="skeleton-stack">
      <div className="stats-grid">
        {[0, 1, 2].map(i => (
          <div className="card" key={i} style={{ textAlign: 'center' }}>
            <Skeleton width="40%" height={22} style={{ margin: '0 auto .4rem' }} />
            <Skeleton width="60%" height={11} style={{ margin: '0 auto' }} />
          </div>
        ))}
      </div>
      <div className="card">
        <Skeleton width="40%" height={15} style={{ marginBottom: '.9rem' }} />
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex justify-between items-center" style={{ padding: '.5rem 0' }}>
            <Skeleton width="35%" height={13} />
            <Skeleton width="20%" height={13} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default Skeleton

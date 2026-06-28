/* Skeleton shimmer building-blocks */

function SkeletonBox({ width = '100%', height = '1rem', radius = 6, style = {} }) {
  return (
    <div className="skeleton-box" style={{ width, height, borderRadius: radius, ...style }} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="skeleton-dashboard">
      {/* Stat cards */}
      <div className="dash-stats-grid" style={{ marginBottom: '2rem' }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <SkeletonBox width="40%" height="0.75rem" />
            <SkeletonBox width="55%" height="1.75rem" />
            <SkeletonBox width="35%" height="0.65rem" />
          </div>
        ))}
      </div>
      {/* Business cards */}
      <div className="biz-grid">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="biz-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1.25rem' }}>
            <SkeletonBox width="45%" height="0.75rem" />
            <SkeletonBox width="80%" height="1.1rem" />
            <SkeletonBox width="100%" height="0.75rem" />
            <SkeletonBox width="60%" height="0.75rem" />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <SkeletonBox width="44%" height="2rem" radius={8} />
              <SkeletonBox width="44%" height="2rem" radius={8} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="skeleton-table">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="skeleton-row">
          <SkeletonBox width="18%" height="0.75rem" />
          <SkeletonBox width="22%" height="0.75rem" />
          <SkeletonBox width="16%" height="0.75rem" />
          <SkeletonBox width="28%" height="0.75rem" />
        </div>
      ))}
    </div>
  );
}

export function BookingsSkeleton({ rows = 8 }) {
  return (
    <div className="skeleton-table" style={{ marginTop: '1rem' }}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="skeleton-row">
          <SkeletonBox width="12%" height="0.7rem" />
          <SkeletonBox width="20%" height="0.7rem" />
          <SkeletonBox width="14%" height="0.7rem" />
          <SkeletonBox width="20%" height="0.7rem" />
          <SkeletonBox width="25%" height="0.7rem" />
        </div>
      ))}
    </div>
  );
}

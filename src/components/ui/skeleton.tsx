export function PageSkeleton({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading content">
      <div className="page-head">
        <div>
          <div className="skeleton skeleton-title" style={{ marginBottom: 12 }} />
          <div className="skeleton skeleton-line" style={{ width: 240, maxWidth: "70%" }} />
        </div>
      </div>
      {stats > 0 ? (
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {Array.from({ length: stats }).map((_, index) => (
            <div key={index} className="skeleton skeleton-stat" />
          ))}
        </div>
      ) : null}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "grid", gap: 14 }}>
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="skeleton skeleton-line" style={{ width: `${88 - (index % 4) * 12}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

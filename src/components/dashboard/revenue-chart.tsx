import { formatMoney } from "@/lib/utils";

export function RevenueChart({
  data,
  currency,
  locale,
  label = "Collected this month",
}: {
  data: Array<{ day: string; value: number }>;
  currency: string;
  locale: string;
  label?: string;
}) {
  const width = 720;
  const height = 230;
  const padX = 10;
  const padY = 16;
  const values = data.map((item) => item.value);
  const max = Math.max(...values, 1);
  const points = data.map((item, index) => {
    const x = padX + (index / Math.max(1, data.length - 1)) * (width - padX * 2);
    const y = height - padY - (item.value / max) * (height - padY * 2);
    return { x, y, ...item };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = points.length
    ? `M${points[0].x},${height - padY} L${points.map((point) => `${point.x},${point.y}`).join(" L")} L${points.at(-1)!.x},${height - padY} Z`
    : "";
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const labels = data.length > 1 ? [data[0], data[Math.floor((data.length - 1) / 2)], data.at(-1)!] : data;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ color: "var(--muted)", fontSize: 11 }}>{label}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 26, letterSpacing: "-.02em" }}>{formatMoney(total, currency, locale)}</div>
        </div>
        <span className="badge badge-accent">{data.length} days</span>
      </div>
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Daily collected revenue">
        <defs>
          <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#8c6a52" stopOpacity=".22" />
            <stop offset="100%" stopColor="#8c6a52" stopOpacity=".01" />
          </linearGradient>
        </defs>
        <g className="chart-grid">
          {[0.25, 0.5, 0.75, 1].map((ratio) => (
            <line key={ratio} x1={padX} x2={width - padX} y1={padY + (height - padY * 2) * ratio} y2={padY + (height - padY * 2) * ratio} />
          ))}
        </g>
        {area ? <path d={area} fill="url(#revenue-fill)" /> : null}
        {points.length > 1 ? <polyline points={line} fill="none" stroke="#8c6a52" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {points.map((point) => (
          <circle key={point.day} cx={point.x} cy={point.y} r="2.4" fill="#8c6a52">
            <title>{`${point.day}: ${formatMoney(point.value, currency, locale)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-labels">
        {labels.map((item, index) => (
          <span key={`${item.day}-${index}`}>
            {new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${item.day}T00:00:00Z`))}
          </span>
        ))}
      </div>
    </div>
  );
}

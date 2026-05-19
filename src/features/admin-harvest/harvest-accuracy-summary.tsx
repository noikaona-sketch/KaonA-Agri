'use client';

// ─────────────────────────────────────────────────────────────────────────────
// HarvestAccuracySummary — P2 PR7
// Read-only aggregate stats for completed harvest forecast accuracy.
// No migration. No AI. No prediction engine. No economics.
// ─────────────────────────────────────────────────────────────────────────────

export type AccuracyRow = {
  id:                     string;
  member_name:            string;
  member_phone:           string | null;
  plot_name:              string;
  crop_name:              string;
  // Farmer estimates
  actual_yield_kg:        number | null;  // used as farmer estimated kg (PR1 pre-fill)
  estimated_moisture_pct: number | null;
  // Factory actuals
  actual_received_kg:     number | null;
  actual_moisture_pct:    number | null;
  actual_completed_at:    string | null;
};

type Stats = {
  count:            number;
  avgKgVariancePct: number | null;
  avgMoistureVar:   number | null;
  overEstimateCount: number;
  underEstimateCount: number;
};

export function computeStats(rows: AccuracyRow[]): Stats {
  const paired = rows.filter(
    (r) => r.actual_yield_kg != null && r.actual_received_kg != null,
  );

  let kgVarSum  = 0;
  let kgVarN    = 0;
  let moistVarSum = 0;
  let moistVarN   = 0;
  let over = 0, under = 0;

  for (const r of paired) {
    const est = r.actual_yield_kg!;
    const act = r.actual_received_kg!;
    const varPct = est !== 0 ? ((act - est) / est) * 100 : 0;
    kgVarSum += varPct; kgVarN++;
    if (varPct > 0) under++;   // actual > estimate = under-estimated
    else if (varPct < 0) over++; // actual < estimate = over-estimated

    if (r.estimated_moisture_pct != null && r.actual_moisture_pct != null) {
      moistVarSum += r.actual_moisture_pct - r.estimated_moisture_pct;
      moistVarN++;
    }
  }

  return {
    count:             rows.length,
    avgKgVariancePct:  kgVarN   ? Math.round((kgVarSum / kgVarN) * 10) / 10 : null,
    avgMoistureVar:    moistVarN ? Math.round((moistVarSum / moistVarN) * 10) / 10 : null,
    overEstimateCount:  over,
    underEstimateCount: under,
  };
}

type Props = { stats: Stats };

export function HarvestAccuracySummary({ stats }: Props) {
  if (stats.count === 0) return null;

  const tiles = [
    { label: 'เสร็จสิ้น',     value: String(stats.count),           color: '#1b5e20', icon: '🏁' },
    {
      label: 'ความแม่นน้ำหนัก เฉลี่ย',
      value: stats.avgKgVariancePct != null
        ? `${stats.avgKgVariancePct >= 0 ? '+' : ''}${stats.avgKgVariancePct}%`
        : '—',
      color: stats.avgKgVariancePct == null ? '#9ca3af'
        : stats.avgKgVariancePct >= 0 ? '#2e7d32' : '#c62828',
      icon: '⚖️',
    },
    {
      label: 'ความชื้นต่างเฉลี่ย',
      value: stats.avgMoistureVar != null
        ? `${stats.avgMoistureVar >= 0 ? '+' : ''}${stats.avgMoistureVar}%`
        : '—',
      color: stats.avgMoistureVar == null ? '#9ca3af'
        : Math.abs(stats.avgMoistureVar) <= 2 ? '#2e7d32' : '#e65100',
      icon: '💧',
    },
    { label: 'ประมาณน้อยกว่าจริง', value: String(stats.underEstimateCount), color: '#2e7d32', icon: '📈' },
    { label: 'ประมาณมากกว่าจริง',  value: String(stats.overEstimateCount),  color: '#c62828', icon: '📉' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
      {tiles.map((t) => (
        <div key={t.label} style={{
          background: '#f9fafb', borderRadius: 10,
          padding: '10px 12px', border: `1px solid ${t.color}33`,
        }}>
          <p style={{ margin: '0 0 2px', fontSize: 18 }}>{t.icon}</p>
          <p style={{ margin: '0 0 2px', fontWeight: 800, fontSize: 18, color: t.color }}>{t.value}</p>
          <p style={{ margin: 0, fontSize: 10, color: '#6b7280', lineHeight: 1.3 }}>{t.label}</p>
        </div>
      ))}
    </div>
  );
}

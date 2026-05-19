'use client';

import type { DayStat } from './harvest-dashboard';

// ── Bar chart (pure CSS) ──────────────────────────────────────────────────────
export function TonnageBar({ day, maxTonnage }: { day: DayStat; maxTonnage: number }) {
  const pct = maxTonnage > 0 ? Math.round((day.tonnage / maxTonnage) * 100) : 0;
  const label = new Date(day.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11, color: '#6b7280', minWidth: 52, textAlign: 'right' }}>{label}</span>
      <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 18, position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#2e7d32', borderRadius: 4, transition: 'width 0.3s' }} />
        {day.pending > 0 && (
          <div style={{ position: 'absolute', left: `${pct}%`, top: 0, height: '100%',
            width: `${maxTonnage > 0 ? Math.round((day.pending * (day.tonnage / (day.pending + day.confirmed || 1)) / maxTonnage) * 100) : 0}%`,
            background: '#e65100', opacity: 0.5, borderRadius: 4 }} />
        )}
      </div>
      <span style={{ fontSize: 11, color: '#374151', minWidth: 60, textAlign: 'right' }}>
        {(day.tonnage / 1000).toFixed(1)} ต
      </span>
    </div>
  );
}

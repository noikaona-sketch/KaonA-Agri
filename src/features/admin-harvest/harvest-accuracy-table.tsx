'use client';

import type { AccuracyRow }                        from './harvest-accuracy-summary';
import { HarvestDataQualityBadge, HarvestEmptyState } from './harvest-data-quality';

function varPct(est: number | null, act: number | null): number | null {
  if (est == null || act == null || est === 0) return null;
  return Math.round(((act - est) / est) * 100 * 10) / 10;
}

// Forecast accuracy color: |variance| <= 10% = green, <= 20% = orange, > 20% = red
// For moisture (invert=true): low diff = good, high diff = concern
function VarBadge({ value, unit, invert }: { value: number | null; unit: string; invert?: boolean }) {
  if (value == null) return <span style={{ color: '#9ca3af' }}>—</span>;
  const abs = Math.abs(value);
  let color: string;
  if (invert) {
    // moisture: lower diff is better
    color = abs <= 2 ? '#2e7d32' : abs <= 5 ? '#e65100' : '#c62828';
  } else {
    // kg variance: closeness matters, not direction
    color = abs <= 10 ? '#2e7d32' : abs <= 20 ? '#e65100' : '#c62828';
  }
  return (
    <span style={{ fontWeight: 700, color }}>
      {value >= 0 ? '+' : ''}{value}{unit}
    </span>
  );
}

export function HarvestAccuracyTable({ rows }: { rows: AccuracyRow[] }) {
  if (rows.length === 0) {
    return <HarvestEmptyState message="ยังไม่มีข้อมูลเก็บเกี่ยวที่เสร็จสิ้น" />;
  }

  return (
    <div className="admin-table-wrap" style={{ overflowX: 'auto' }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>สมาชิก / แปลง</th>
            <th>พืช</th>
            <th>น้ำหนักประมาณ</th>
            <th>น้ำหนักจริง</th>
            <th>ต่าง %</th>
            <th>ความชื้นประมาณ</th>
            <th>ความชื้นจริง</th>
            <th>ต่าง</th>
            <th>วันที่เสร็จ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const kgVar   = varPct(r.actual_yield_kg, r.actual_received_kg);
            const moistVar = r.estimated_moisture_pct != null && r.actual_moisture_pct != null
              ? Math.round((r.actual_moisture_pct - r.estimated_moisture_pct) * 10) / 10
              : null;

            return (
              <tr key={r.id}>
                <td>
                  <p style={{ margin: 0, fontWeight: 600 }}>{r.member_name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{r.plot_name}</p>
                </td>
                <td style={{ fontSize: 13 }}>{r.crop_name}</td>
                <td style={{ fontSize: 13 }}>
                  {r.actual_yield_kg != null ? `${r.actual_yield_kg.toLocaleString()} กก.` : '—'}
                </td>
                <td style={{ fontSize: 13, fontWeight: 700 }}>
                  {r.actual_received_kg != null ? `${r.actual_received_kg.toLocaleString()} กก.` : '—'}
                </td>
                <td><VarBadge value={kgVar} unit="%" /></td>
                <td style={{ fontSize: 13 }}>
                  {r.estimated_moisture_pct != null ? `${r.estimated_moisture_pct}%` : '—'}
                </td>
                <td style={{ fontSize: 13, fontWeight: 700 }}>
                  {r.actual_moisture_pct != null ? `${r.actual_moisture_pct}%` : '—'}
                </td>
                <td><VarBadge value={moistVar} unit="%" invert /></td>
                <td style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {r.actual_completed_at
                    ? new Date(r.actual_completed_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })
                    : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

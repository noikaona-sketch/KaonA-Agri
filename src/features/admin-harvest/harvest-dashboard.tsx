'use client';

// ─────────────────────────────────────────────────────────────────────────────
// HarvestDashboard — P2 PR4
//
// Read-only summary panels for admin harvest planning.
// Queries harvest_bookings_full view (no new tables/migrations).
//
// Panels:
//   1. Status summary       — pending / confirmed / completed counts
//   2. Tonnage by day/week  — grouped scheduled_date bar
//   3. Dryer required       — drying_preference = required count + tonnage
//   4. Moisture range       — min/avg/max estimated_moisture_pct
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState }     from '@/shared/components/loading-state';
import { TonnageBar }            from './harvest-tonnage-bar';
import { HarvestWorkloadSummary } from './harvest-workload-summary';
import { ErrorState }   from '@/shared/components/error-state';

type BookingRow = {
  id:                     string;
  status:                 string;
  scheduled_date:         string;
  actual_yield_kg:        number | null;
  drying_preference:      string | null;
  estimated_moisture_pct: number | null;
};

export type DayStat = {
  date:      string;
  pending:   number;
  confirmed: number;
  tonnage:   number;
};

type DashboardData = {
  pendingCount:     number;
  confirmedCount:   number;
  completedCount:   number;
  dryerRequired:    number;
  dryerTonnage:     number;
  moistureMin:      number | null;
  moistureAvg:      number | null;
  moistureMax:      number | null;
  byDay:            DayStat[];
};

function compute(rows: BookingRow[]): DashboardData {
  const active = rows.filter((r) => r.status === 'pending' || r.status === 'confirmed');

  // Moisture stats (active rows with estimates)
  const moistures = active
    .map((r) => r.estimated_moisture_pct)
    .filter((v): v is number => v !== null);
  const moistureMin = moistures.length ? Math.min(...moistures) : null;
  const moistureMax = moistures.length ? Math.max(...moistures) : null;
  const moistureAvg = moistures.length
    ? Math.round((moistures.reduce((s, v) => s + v, 0) / moistures.length) * 10) / 10
    : null;

  // Dryer load
  const dryerRows  = active.filter((r) => r.drying_preference === 'required');
  const dryerTonnage = dryerRows.reduce((s, r) => s + (r.actual_yield_kg ?? 0), 0);

  // Group by day
  const dayMap: Record<string, DayStat> = {};
  for (const r of active) {
    const d = r.scheduled_date.slice(0, 10);
    if (!dayMap[d]) dayMap[d] = { date: d, pending: 0, confirmed: 0, tonnage: 0 };
    if (r.status === 'pending')   dayMap[d].pending++;
    if (r.status === 'confirmed') dayMap[d].confirmed++;
    dayMap[d].tonnage += r.actual_yield_kg ?? 0;
  }
  const byDay = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 14);

  return {
    pendingCount:   rows.filter((r) => r.status === 'pending').length,
    confirmedCount: rows.filter((r) => r.status === 'confirmed').length,
    completedCount: rows.filter((r) => r.status === 'completed').length,
    dryerRequired:  dryerRows.length,
    dryerTonnage,
    moistureMin, moistureAvg, moistureMax,
    byDay,
  };
}


// ── Main component ────────────────────────────────────────────────────────────
type Props = { view?: 'week' | 'all' };

export function HarvestDashboard({ view = 'week' }: Props) {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true); setError(null);
      const s = createSupabaseBrowserClient();
      let q = s.from('harvest_bookings_full')
        .select('id,status,scheduled_date,actual_yield_kg,drying_preference,estimated_moisture_pct')
        .in('status', ['pending', 'confirmed', 'completed'])
        .order('scheduled_date', { ascending: true })
        .limit(500);
      if (view === 'week') {
        const from = new Date().toISOString().slice(0, 10);
        const to   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        q = q.gte('scheduled_date', from).lte('scheduled_date', to);
      }
      const { data: rows, error: err } = await q;
      if (err) { setError(err.message); setLoading(false); return; }
      setData(compute((rows as unknown as BookingRow[]) ?? []));
      setLoading(false);
    })();
  }, [view]);

  if (loading) return <LoadingState label="กำลังโหลดสรุป…" />;
  if (error)   return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;
  if (!data)   return null;

  const maxTonnage = Math.max(...data.byDay.map((d) => d.tonnage), 1);

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── 1. Status counts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        {[
          { label: 'รอยืนยัน',   value: data.pendingCount,   color: '#e65100' },
          { label: 'ยืนยันแล้ว', value: data.confirmedCount, color: '#2e7d32' },
          { label: 'เสร็จสิ้น',  value: data.completedCount, color: '#1b5e20' },
        ].map((s) => (
          <div key={s.label} style={{
            background: '#f9fafb', borderRadius: 10,
            padding: '12px 14px', border: `1px solid ${s.color}33`,
          }}>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{s.label}</p>
            <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 24, color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── 2. Dryer load ── */}
      <div style={{ background: '#fff8e1', borderRadius: 10, padding: '12px 14px', border: '1px solid #fde047' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13, color: '#713f12' }}>
          🔥 ต้องการอบ
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#713f12' }}>
          <strong>{data.dryerRequired}</strong> คิว ·{' '}
          <strong>{(data.dryerTonnage / 1000).toFixed(1)} ตัน</strong> คาดการณ์
        </p>
      </div>

      {/* ── 3. Moisture range ── */}
      {data.moistureAvg !== null && (
        <div style={{ background: '#e3f2fd', borderRadius: 10, padding: '12px 14px', border: '1px solid #90caf9' }}>
          <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13, color: '#0d47a1' }}>
            💧 ความชื้นที่แจ้ง (ประมาณการ)
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#0d47a1' }}>
            ต่ำสุด <strong>{data.moistureMin}%</strong> ·{' '}
            เฉลี่ย <strong>{data.moistureAvg}%</strong> ·{' '}
            สูงสุด <strong>{data.moistureMax}%</strong>
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#1565c0' }}>
            * ข้อมูลจากการแจ้งของเกษตรกร ยังไม่ผ่านการวัดจริง
          </p>
        </div>
      )}

      {/* ── 4. Tonnage by day ── */}
      {data.byDay.length > 0 && (
        <div>
          <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 13 }}>
            📦 ปริมาณคาดการณ์รายวัน
            <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>
              {' '}(🟩 ยืนยัน 🟧 รอ)
            </span>
          </p>
          {data.byDay.map((d) => (
            <TonnageBar key={d.date} day={d} maxTonnage={maxTonnage} />
          ))}
        </div>
      )}
    </div>

    {/* Queue workload — 7-day incoming summary */}
    <div style={{ marginTop: 24 }}>
      <HarvestWorkloadSummary />
    </div>
    </>
  );
}

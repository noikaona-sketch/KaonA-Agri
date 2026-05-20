'use client';

// ─────────────────────────────────────────────────────────────────────────────
// HarvestWorkloadSummary — P2 PR13
//
// Read-only queue workload for factory/admin planning.
// No scheduling engine. No AI. No optimization. No migration.
//
// Data: harvest_bookings_full, status IN (pending, confirmed) only.
// Excludes: completed, cancelled, no_show — they are not incoming workload.
// Prefers planned_delivery_date when set; falls back to scheduled_date.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState }         from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState }                from '@/shared/components/loading-state';
import { ErrorState }                  from '@/shared/components/error-state';

type WorkloadRow = {
  scheduled_date:       string;
  planned_delivery_date: string | null;
  status:               string;
  actual_yield_kg:      number | null;
  drying_preference:    string | null;
};

type DayStat = {
  date:         string;
  pendingKg:    number;
  confirmedKg:  number;
  dryingKg:     number;
  bookingCount: number;
};

function dateKey(row: WorkloadRow): string {
  // Prefer planned_delivery_date if set, else scheduled_date
  return (row.planned_delivery_date ?? row.scheduled_date).slice(0, 10);
}

function buildDayStats(rows: WorkloadRow[], days: string[]): DayStat[] {
  return days.map((date) => {
    const dayRows = rows.filter((r) => dateKey(r) === date);
    let pendingKg = 0, confirmedKg = 0, dryingKg = 0;
    for (const r of dayRows) {
      const kg = r.actual_yield_kg ?? 0;
      if (r.status === 'pending')   pendingKg   += kg;
      if (r.status === 'confirmed') confirmedKg += kg;
      if (r.drying_preference === 'required') dryingKg += kg;
    }
    return { date, pendingKg, confirmedKg, dryingKg, bookingCount: dayRows.length };
  });
}

function nextNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

// ── Summary tiles ─────────────────────────────────────────────────────────────
function SummaryTiles({ today, week }: {
  today: DayStat;
  week:  { pendingKg: number; confirmedKg: number; dryingKg: number };
}) {
  const fmt = (n: number) => n > 0 ? `${(n / 1000).toFixed(1)} ต.` : '—';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
      {[
        { label: 'วันนี้ — รอ',     value: fmt(today.pendingKg),   color: '#e65100' },
        { label: 'วันนี้ — ยืนยัน', value: fmt(today.confirmedKg), color: '#2e7d32' },
        { label: 'วันนี้ — ต้องอบ', value: fmt(today.dryingKg),    color: '#b45309' },
        { label: '7 วัน — รอ',      value: fmt(week.pendingKg),    color: '#e65100' },
        { label: '7 วัน — ยืนยัน',  value: fmt(week.confirmedKg),  color: '#2e7d32' },
        { label: '7 วัน — ต้องอบ',  value: fmt(week.dryingKg),     color: '#b45309' },
      ].map((s) => (
        <div key={s.label} style={{
          background: '#f9fafb', borderRadius: 10,
          padding: '10px 12px', border: `1px solid ${s.color}33`,
        }}>
          <p style={{ margin: '0 0 2px', fontSize: 10, color: '#6b7280', lineHeight: 1.3 }}>{s.label}</p>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 18, color: s.color }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── Daily workload bar table ───────────────────────────────────────────────────
function WorkloadBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(Math.round((value / max) * 100), value > 0 ? 4 : 0) : 0;
  return (
    <div style={{ background: '#f3f4f6', borderRadius: 4, height: 10, width: '100%' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
    </div>
  );
}

function DailyTable({ days }: { days: DayStat[] }) {
  const maxKg = Math.max(...days.map((d) => d.pendingKg + d.confirmedKg), 1);

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>วันที่</th>
            <th>รอ (ต.)</th>
            <th>ยืนยัน (ต.)</th>
            <th>ต้องอบ (ต.)</th>
            <th>รวมคิว</th>
            <th style={{ minWidth: 120 }}>แผนภาพ</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => {
            const totalKg  = d.pendingKg + d.confirmedKg;
            const isToday  = d.date === new Date().toISOString().slice(0, 10);
            const dateLabel = new Date(d.date).toLocaleDateString('th-TH', {
              weekday: 'short', day: 'numeric', month: 'short',
            });
            return (
              <tr key={d.date} style={{ background: isToday ? '#f0fdf4' : undefined }}>
                <td style={{ fontWeight: isToday ? 700 : 400, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {isToday ? '📅 ' : ''}{dateLabel}
                </td>
                <td style={{ fontSize: 12, color: '#e65100' }}>
                  {d.pendingKg > 0 ? (d.pendingKg / 1000).toFixed(1) : '—'}
                </td>
                <td style={{ fontSize: 12, color: '#2e7d32' }}>
                  {d.confirmedKg > 0 ? (d.confirmedKg / 1000).toFixed(1) : '—'}
                </td>
                <td style={{ fontSize: 12, color: '#b45309' }}>
                  {d.dryingKg > 0 ? (d.dryingKg / 1000).toFixed(1) : '—'}
                </td>
                <td style={{ fontSize: 12 }}>{d.bookingCount > 0 ? `${d.bookingCount} คิว` : '—'}</td>
                <td>
                  <WorkloadBar value={totalKg} max={maxKg} color={d.confirmedKg >= d.pendingKg ? '#2e7d32' : '#e65100'} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function HarvestWorkloadSummary() {
  const [rows,    setRows]    = useState<WorkloadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      // Effective date = planned_delivery_date ?? scheduled_date.
      // Filter applied client-side so both columns are respected correctly.
      // DB query fetches all active bookings; in-memory filter by effective date.
      const from = new Date().toISOString().slice(0, 10);
      const to   = nextNDays(7)[6]; // D+6
      const { data, error: err } = await s
        .from('harvest_bookings_full')
        .select('scheduled_date,planned_delivery_date,status,actual_yield_kg,drying_preference')
        .in('status', ['pending', 'confirmed'])
        .limit(500);
      if (err) setError(err.message);
      else setRows(
        ((data as unknown as WorkloadRow[]) ?? []).filter((r) => {
          const eff = (r.planned_delivery_date ?? r.scheduled_date).slice(0, 10);
          return eff >= from && eff <= to;
        })
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState label="กำลังโหลดปริมาณงาน…" />;
  if (error)   return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  const days     = nextNDays(7);
  const dayStats = buildDayStats(rows, days);
  const todayStat = dayStats[0];
  const weekTotals = {
    pendingKg:   dayStats.reduce((s, d) => s + d.pendingKg,   0),
    confirmedKg: dayStats.reduce((s, d) => s + d.confirmedKg, 0),
    dryingKg:    dayStats.reduce((s, d) => s + d.dryingKg,    0),
  };

  return (
    <div>
      <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 14 }}>
        📦 ปริมาณงาน 7 วันข้างหน้า
        <span style={{ fontWeight: 400, fontSize: 12, color: '#6b7280', marginLeft: 6 }}>
          (pending + confirmed เท่านั้น)
        </span>
      </p>
      <SummaryTiles today={todayStat} week={weekTotals} />
      <DailyTable days={dayStats} />
    </div>
  );
}

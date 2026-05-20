'use client';

// ─────────────────────────────────────────────────────────────────────────────
// HarvestDailyBoard — P2 PR14
// Read-only daily operation board for admin/factory.
// Queries harvest_bookings table directly (has all P2 columns).
// Effective date = planned_delivery_date ?? scheduled_date
// No AI, no weather, no queue optimization, no pricing.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState }         from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState }                from '@/shared/components/loading-state';
import { ErrorState }                  from '@/shared/components/error-state';

type BookingSlim = {
  status:               string;
  actual_yield_kg:      number | null;
  scheduled_date:       string;
  planned_delivery_date: string | null;
};

type DayStat = {
  pendingKg:    number;
  confirmedKg:  number;
  completedKg:  number;
  noShowCount:  number;
  activeCount:  number;
  deliveryCount: number;
};

function effectiveDate(r: BookingSlim): string {
  return (r.planned_delivery_date ?? r.scheduled_date).slice(0, 10);
}

function buildStat(rows: BookingSlim[], date: string): DayStat {
  const day = rows.filter((r) => effectiveDate(r) === date);
  let pendingKg = 0, confirmedKg = 0, completedKg = 0;
  let noShowCount = 0, deliveryCount = 0;
  for (const r of day) {
    const kg = r.actual_yield_kg ?? 0;
    if (r.status === 'pending')   { pendingKg   += kg; }
    if (r.status === 'confirmed') { confirmedKg += kg; deliveryCount++; }
    if (r.status === 'completed') { completedKg += kg; }
    if (r.status === 'no_show')   { noShowCount++; }
  }
  const activeCount = day.filter(
    (r) => r.status === 'pending' || r.status === 'confirmed',
  ).length;
  return { pendingKg, confirmedKg, completedKg, noShowCount, activeCount, deliveryCount };
}

const THRESHOLD_LABEL = (kg: number) =>
  kg < 20000 ? { label: 'ต่ำ',   color: '#2e7d32', bg: '#f0fdf4' } :
  kg < 50000 ? { label: 'ปานกลาง', color: '#b45309', bg: '#fffbeb' } :
               { label: 'สูง',   color: '#c62828', bg: '#fff1f2' };

function fmt(kg: number) {
  return kg > 0 ? `${(kg / 1000).toFixed(1)} ต.` : '—';
}

function DayCard({ title, stat, isToday }: {
  title: string; stat: DayStat; isToday: boolean;
}) {
  const totalKg  = stat.pendingKg + stat.confirmedKg;
  const threshold = THRESHOLD_LABEL(totalKg);
  return (
    <div style={{
      background: isToday ? '#f0fdf4' : '#fafafa',
      border: `1px solid ${isToday ? '#86efac' : '#e5e7eb'}`,
      borderRadius: 12, padding: '12px 14px', flex: 1, minWidth: 200,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{title}</p>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          background: threshold.bg, color: threshold.color,
        }}>
          {threshold.label} {totalKg > 0 ? `(${fmt(totalKg)})` : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
        {[
          { label: '⏳ รอ',     value: fmt(stat.pendingKg),   color: '#e65100' },
          { label: '✅ ยืนยัน', value: fmt(stat.confirmedKg), color: '#2e7d32' },
          isToday && { label: '🏁 เสร็จ', value: fmt(stat.completedKg), color: '#1b5e20' },
          isToday && { label: '⚠️ ไม่มา', value: String(stat.noShowCount), color: '#b45309' },
          { label: '📋 คิวเปิด', value: String(stat.activeCount), color: '#374151' },
          { label: '🚚 ส่งวันนี้', value: String(stat.deliveryCount), color: '#1565c0' },
        ].filter(Boolean).map((s) => s && (
          <div key={s.label}>
            <p style={{ margin: 0, fontSize: 10, color: '#6b7280' }}>{s.label}</p>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HarvestDailyBoard() {
  const [rows,    setRows]    = useState<BookingSlim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const today    = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data, error: err } = await s
        .from('harvest_bookings')
        .select('status,actual_yield_kg,scheduled_date,planned_delivery_date')
        .in('status', ['pending', 'confirmed', 'completed', 'no_show'])
        .gte('scheduled_date', today)
        .lte('scheduled_date', tomorrow)
        .limit(500);
      if (err) setError(err.message);
      else setRows((data as unknown as BookingSlim[]) ?? []);
      setLoading(false);
    })();
  }, [today, tomorrow]);

  if (loading) return <LoadingState label="กำลังโหลดกระดานงาน…" />;
  if (error)   return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  const todayStat    = buildStat(rows, today);
  const tomorrowStat = buildStat(rows, tomorrow);

  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 14 }}>
        📅 กระดานงานประจำวัน
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <DayCard title="📅 วันนี้"    stat={todayStat}    isToday />
        <DayCard title="📆 พรุ่งนี้"  stat={tomorrowStat} isToday={false} />
      </div>
    </div>
  );
}

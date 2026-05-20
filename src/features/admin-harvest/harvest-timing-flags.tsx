'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { HarvestEmptyState } from './harvest-data-quality';

type RiskLevel = 'green' | 'yellow' | 'red';

type BookingRow = {
  id: string;
  status: string;
  scheduled_date: string;
  planned_delivery_date: string | null;
  drying_preference: string | null;
  estimated_moisture_pct: number | null;
  actual_received_kg: number | null;
  actual_completed_at: string | null;
};

type TimingFlag = {
  key: string;
  title: string;
  level: RiskLevel;
  value: string;
  detail: string;
};

const LEVEL_STYLE: Record<RiskLevel, { label: string; color: string; bg: string; border: string }> = {
  green: { label: 'Green', color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  yellow: { label: 'Yellow', color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  red: { label: 'Red', color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5' },
};

function effectiveDate(r: BookingRow) {
  return (r.planned_delivery_date ?? r.scheduled_date).slice(0, 10);
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function variance(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
}

function pctLevel(value: number, yellow: number, red: number): RiskLevel {
  if (value < yellow) return 'green';
  if (value < red) return 'yellow';
  return 'red';
}

export function HarvestTimingFlags() {
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [estimateMap, setEstimateMap] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayYmd());

  const dateFrom = useMemo(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), []);
  const dateTo = useMemo(() => new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      const s = createSupabaseBrowserClient();
      const { data, error: qErr } = await s
        .from('harvest_bookings')
        .select('id,status,scheduled_date,planned_delivery_date,drying_preference,estimated_moisture_pct,actual_received_kg,actual_completed_at')
        .gte('scheduled_date', dateFrom)
        .lte('scheduled_date', dateTo)
        .in('status', ['pending', 'confirmed', 'completed'])
        .order('scheduled_date', { ascending: true })
        .limit(1200);

      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }

      const base = (data as BookingRow[] | null) ?? [];
      setRows(base);

      const ids = base.map((r) => r.id);
      if (ids.length > 0) {
        const { data: viewRows, error: vErr } = await s
          .from('harvest_bookings_full')
          .select('id,estimated_yield_kg')
          .in('id', ids)
          .limit(1200);

        if (vErr) {
          setError(vErr.message);
          setLoading(false);
          return;
        }

        const map: Record<string, number | null> = {};
        for (const row of ((viewRows as { id: string; estimated_yield_kg: number | null }[] | null) ?? [])) {
          map[row.id] = row.estimated_yield_kg ?? null;
        }
        setEstimateMap(map);
      }

      setLoading(false);
    })();
  }, [dateFrom, dateTo]);

  if (loading) return <LoadingState label="กำลังโหลด Timing Flags…" />;
  if (error) return <ErrorState title="โหลด Timing Flags ไม่สำเร็จ" detail={error} />;
  if (rows.length === 0) {
    return (
      <section>
        <HarvestEmptyState message="ยังไม่มีข้อมูลคิวเกี่ยวสำหรับแสดง Timing Flags" />
        <p style={{ marginTop: 10 }}>
          <Link href="/admin/harvest" className="admin-btn admin-btn--secondary">กลับหน้ารถเกี่ยว</Link>
        </p>
      </section>
    );
  }

  const activeRows = rows.filter((r) => r.status === 'pending' || r.status === 'confirmed');
  const selectedRows = activeRows.filter((r) => effectiveDate(r) === selectedDate);

  const nearTermRows = activeRows.filter((r) => {
    const d = effectiveDate(r);
    return d >= selectedDate && d <= new Date(new Date(selectedDate).getTime() + 2 * 86400000).toISOString().slice(0, 10);
  });

  const queueCount = nearTermRows.length;
  const queueLevel: RiskLevel = queueCount >= 24 ? 'red' : queueCount >= 14 ? 'yellow' : 'green';

  const dryingKg = nearTermRows.reduce((sum, r) => {
    if (r.drying_preference !== 'required') return sum;
    return sum + (estimateMap[r.id] ?? 0);
  }, 0);
  const dryerLevel: RiskLevel = dryingKg >= 45000 ? 'red' : dryingKg >= 25000 ? 'yellow' : 'green';

  const moistureValues = selectedRows.map((r) => r.estimated_moisture_pct).filter((v): v is number => typeof v === 'number');
  const avgMoisture = moistureValues.length > 0 ? moistureValues.reduce((a, b) => a + b, 0) / moistureValues.length : null;
  const moistureLevel: RiskLevel = avgMoisture == null ? 'green' : pctLevel(avgMoisture, 18, 22);

  const recentCompleted = rows.filter((r) => r.status === 'completed' && !!r.actual_completed_at).slice(-30);
  const deltasPct = recentCompleted
    .map((r) => {
      const est = estimateMap[r.id];
      if (!est || est <= 0 || !r.actual_received_kg) return null;
      return ((r.actual_received_kg - est) / est) * 100;
    })
    .filter((v): v is number => v != null);
  const deltaStd = Math.sqrt(variance(deltasPct));
  const deviationLevel: RiskLevel = deltasPct.length < 5 ? 'green' : pctLevel(deltaStd, 15, 25);

  const cards: TimingFlag[] = [
    {
      key: 'queue',
      title: 'Queue pressure',
      level: queueLevel,
      value: `${queueCount} bookings`,
      detail: 'Near-term load for selected date + next 2 days. High count may delay intake flow.',
    },
    {
      key: 'dryer',
      title: 'Dryer pressure',
      level: dryerLevel,
      value: `${(dryingKg / 1000).toFixed(1)} t`,
      detail: 'Estimated tonnage with drying_preference=required in near-term period.',
    },
    {
      key: 'moisture',
      title: 'Moisture risk',
      level: moistureLevel,
      value: avgMoisture == null ? 'No moisture data' : `${avgMoisture.toFixed(1)}%`,
      detail: 'Average estimated moisture for selected day. Higher value implies wetter incoming crop.',
    },
    {
      key: 'deviation',
      title: 'Timing deviation risk',
      level: deviationLevel,
      value: deltasPct.length < 5 ? 'Insufficient samples' : `σ ${deltaStd.toFixed(1)}%`,
      detail: 'Variance of expected vs actual received (recent completed records). High variance = unstable forecast period.',
    },
  ];

  return (
    <section>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 10, marginBottom: 12 }}>
        <div>
          <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700 }}>Selected date</p>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="admin-input" />
        </div>
        <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>Read-only warning flags for harvest timing operations.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
        {cards.map((card) => {
          const tone = LEVEL_STYLE[card.level];
          return (
            <article key={card.key} style={{ background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>{card.title}</p>
                <span style={{ fontSize: 10, fontWeight: 700, color: tone.color }}>{tone.label}</span>
              </div>
              <p style={{ margin: '4px 0 3px', color: tone.color, fontWeight: 800, fontSize: 22 }}>{card.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>{card.detail}</p>
            </article>
          );
        })}
      </div>

      <p style={{ margin: '10px 0 0', fontSize: 11, color: '#6b7280' }}>
        Threshold-based warning only (green/yellow/red). No optimization, no auto scheduling, no recommendation logic.
      </p>
    </section>
  );
}

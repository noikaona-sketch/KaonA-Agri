'use client';

import { useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState } from '@/shared/components/error-state';

type BookingRiskRow = {
  status: string;
  actual_yield_kg: number | null;
  scheduled_date: string;
  planned_delivery_date: string | null;
};

type RiskLevel = 'green' | 'yellow' | 'red';

type RiskCard = {
  title: string;
  level: RiskLevel;
  value: string;
  explanation: string;
};

const DAILY_CAPACITY_KG = 50000;

const RISK_STYLE: Record<RiskLevel, { color: string; bg: string; border: string; label: string }> = {
  green: { color: '#166534', bg: '#f0fdf4', border: '#86efac', label: 'Green' },
  yellow: { color: '#92400e', bg: '#fffbeb', border: '#fcd34d', label: 'Yellow' },
  red: { color: '#b91c1c', bg: '#fef2f2', border: '#fca5a5', label: 'Red' },
};

function effectiveDate(row: BookingRiskRow) {
  return (row.planned_delivery_date ?? row.scheduled_date).slice(0, 10);
}

function ratioLevel(ratio: number): RiskLevel {
  if (ratio < 0.7) return 'green';
  if (ratio <= 0.9) return 'yellow';
  return 'red';
}

function countLevel(n: number, yellowMin: number, redMinExclusive: number): RiskLevel {
  if (n < yellowMin) return 'green';
  if (n <= redMinExclusive) return 'yellow';
  return 'red';
}

export function HarvestRiskIndicator() {
  const [rows, setRows] = useState<BookingRiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const weekStart = useMemo(() => new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      const s = createSupabaseBrowserClient();
      const { data, error: qErr } = await s
        .from('harvest_bookings')
        .select('status,actual_yield_kg,scheduled_date,planned_delivery_date')
        .in('status', ['pending', 'confirmed', 'completed', 'no_show'])
        .gte('scheduled_date', weekStart)
        .limit(800);
      if (qErr) {
        setError(qErr.message);
        setLoading(false);
        return;
      }
      setRows((data as BookingRiskRow[]) ?? []);
      setLoading(false);
    })();
  }, [weekStart]);

  if (loading) return <LoadingState label="กำลังโหลดตัวชี้วัดความเสี่ยง…" />;
  if (error) return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  const activeToday = rows.filter((r) => {
    const d = effectiveDate(r);
    return d === today && (r.status === 'pending' || r.status === 'confirmed');
  });

  const todayExpectedKg = activeToday.reduce((sum, r) => sum + (r.actual_yield_kg ?? 0), 0);
  const queueLoadRatio = DAILY_CAPACITY_KG > 0 ? todayExpectedKg / DAILY_CAPACITY_KG : 0;

  const pendingAll = rows.filter((r) => r.status === 'pending').length;

  const weekRows = rows.filter((r) => {
    const d = effectiveDate(r);
    return d >= weekStart && d <= today;
  });
  const weekNoShow = weekRows.filter((r) => r.status === 'no_show').length;
  const weekServed = weekRows.filter((r) => r.status === 'completed' || r.status === 'no_show').length;
  const noShowRate = weekServed > 0 ? (weekNoShow / weekServed) * 100 : null;

  const todayBookings = activeToday.length;
  const pendingToday = activeToday.filter((r) => r.status === 'pending').length;
  const intakeScore =
    (todayBookings >= 40 ? 1 : 0) +
    (todayExpectedKg >= 40000 ? 1 : 0) +
    (pendingToday >= 15 ? 1 : 0);
  const intakeLevel: RiskLevel = intakeScore >= 3 ? 'red' : intakeScore >= 1 ? 'yellow' : 'green';

  const cards: RiskCard[] = [
    {
      title: 'Queue overload risk',
      level: ratioLevel(queueLoadRatio),
      value: `${(queueLoadRatio * 100).toFixed(0)}%`,
      explanation: `Today expected ${(todayExpectedKg / 1000).toFixed(1)}t vs daily capacity ${(DAILY_CAPACITY_KG / 1000).toFixed(1)}t.`,
    },
    {
      title: 'Pending backlog',
      level: countLevel(pendingAll, 20, 50),
      value: `${pendingAll}`,
      explanation: 'Total pending/submitted bookings in current queue.',
    },
    {
      title: 'No-show warning',
      level: noShowRate === null ? 'green' : noShowRate < 5 ? 'green' : noShowRate <= 10 ? 'yellow' : 'red',
      value: noShowRate === null ? 'No data yet' : `${noShowRate.toFixed(1)}%`,
      explanation: noShowRate === null
        ? 'No completed/no-show records in the last 7 days.'
        : `Last 7 days: ${weekNoShow} no-show from ${weekServed} completed/no-show records.`,
    },
    {
      title: 'Today intake pressure',
      level: intakeLevel,
      value: `${todayBookings} bookings`,
      explanation: `Signals: bookings ${todayBookings}/40, expected ${(todayExpectedKg / 1000).toFixed(1)}t/40.0t, pending confirmations ${pendingToday}/15.`,
    },
  ];

  return (
    <section>
      <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 14 }}>⚠️ Harvest Risk Indicator</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        {cards.map((card) => {
          const style = RISK_STYLE[card.level];
          return (
            <article key={card.title} style={{ background: style.bg, border: `1px solid ${style.border}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700 }}>{card.title}</p>
                <span style={{ fontSize: 10, fontWeight: 700, color: style.color }}>{style.label}</span>
              </div>
              <p style={{ margin: '4px 0 2px', fontSize: 22, fontWeight: 800, color: style.color }}>{card.value}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>{card.explanation}</p>
            </article>
          );
        })}
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11, color: '#6b7280' }}>
        Read-only operational indicator. Not used for auto scheduling or farmer scoring.
      </p>
    </section>
  );
}

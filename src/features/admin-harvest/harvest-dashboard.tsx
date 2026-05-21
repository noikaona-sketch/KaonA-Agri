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
import { TonnageBar }        from './harvest-tonnage-bar';
import { HarvestDailyBoard } from './harvest-daily-board';
import { HarvestWorkloadSummary } from './harvest-workload-summary';
import { ErrorState }   from '@/shared/components/error-state';
import { getWeatherReadinessForecast, type WeatherReadinessLevel } from '@/shared/weather/weather-readiness';

type BookingRow = {
  id:               string;
  status:           string;
  expected_date_from: string | null;
  expected_date_to: string | null;
  estimated_tonnage:  number | null;
  estimated_moisture: number | null;
  requires_dryer: boolean | null;
};

export type DayStat = {
  date:      string;
  pending:   number;
  confirmed: number;
  tonnage:   number;
};

type DailyAlertLevel = 'normal' | 'busy' | 'peak';

function weatherBadge(level: WeatherReadinessLevel): string {
  if (level === 'suitable') return '☀️ suitable';
  if (level === 'caution') return '🌦️ caution';
  return '🌧️ rain risk';
}

type DashboardData = {
  expectedTonnage: number;
  pendingCount:     number;
  confirmedCount:   number;
  completedCount:   number;
  dryerRequired:    number;
  dryerTonnage:     number;
  moistureMin:      number | null;
  moistureAvg:      number | null;
  moistureMax:      number | null;
  byDay:            DayStat[];
  peakDaysCount: number;
  busiestDay: string | null;
  maxEstimatedTonnage: number;
};

const DAY_MS = 86400000;

function toDateOnly(value: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function getAlertLevel(tonnage: number): DailyAlertLevel {
  if (tonnage >= 100) return 'peak';
  if (tonnage >= 50) return 'busy';
  return 'normal';
}

function compute(rows: BookingRow[]): DashboardData {
  const active = rows.filter((r) => r.status === 'pending' || r.status === 'confirmed');
  const expectedTonnage = active.reduce((sum, r) => sum + (r.estimated_tonnage ?? 0), 0);

  // Moisture stats (active rows with estimates)
  const moistures = active
        .map((r) => r.estimated_moisture)
    .filter((v): v is number => v !== null);
  const moistureMin = moistures.length ? Math.min(...moistures) : null;
  const moistureMax = moistures.length ? Math.max(...moistures) : null;
  const moistureAvg = moistures.length
    ? Math.round((moistures.reduce((s, v) => s + v, 0) / moistures.length) * 10) / 10
    : null;

  // Dryer load (read-only count by farmer preference)
  const dryerRows  = active.filter((r) => r.requires_dryer === true);
  const dryerTonnage = dryerRows.reduce((s, r) => s + (r.estimated_tonnage ?? 0), 0);

  // Group by day
  const dayMap: Record<string, DayStat> = {};
  for (const r of active) {
    const from = toDateOnly(r.expected_date_from);
    const to = toDateOnly(r.expected_date_to) ?? from;
    if (!from || !to) continue;

    const startTs = Date.parse(`${from}T00:00:00Z`);
    const endTs = Date.parse(`${to}T00:00:00Z`);
    if (Number.isNaN(startTs) || Number.isNaN(endTs) || endTs < startTs) continue;

    const days = Math.floor((endTs - startTs) / DAY_MS) + 1;
    const dailyTonnage = (r.estimated_tonnage ?? 0) / days;

    for (let i = 0; i < days; i++) {
      const date = new Date(startTs + i * DAY_MS).toISOString().slice(0, 10);
      if (!dayMap[date]) dayMap[date] = { date, pending: 0, confirmed: 0, tonnage: 0 };
      if (r.status === 'pending') dayMap[date].pending++;
      if (r.status === 'confirmed') dayMap[date].confirmed++;
      dayMap[date].tonnage += dailyTonnage;
    }
  }
  const byDay = Object.values(dayMap).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 14);
  const peakDaysCount = byDay.filter((d) => getAlertLevel(d.tonnage) === 'peak').length;
  const busiest = byDay.reduce<DayStat | null>((max, day) => (!max || day.tonnage > max.tonnage ? day : max), null);

  return {
    expectedTonnage,
    pendingCount:   rows.filter((r) => r.status === 'pending').length,
    confirmedCount: rows.filter((r) => r.status === 'confirmed').length,
    completedCount: rows.filter((r) => r.status === 'completed').length,
    dryerRequired:  dryerRows.length,
    dryerTonnage,
    moistureMin, moistureAvg, moistureMax,
    byDay,
    peakDaysCount,
    busiestDay: busiest?.date ?? null,
    maxEstimatedTonnage: busiest?.tonnage ?? 0,
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
      let q = s.from('harvest_bookings')
        .select('id,status,expected_date_from,expected_date_to,estimated_tonnage,estimated_moisture,requires_dryer')
        .in('status', ['pending', 'confirmed', 'completed'])
        .order('expected_date_from', { ascending: true })
        .limit(500);
      if (view === 'week') {
        const from = new Date().toISOString().slice(0, 10);
        const to   = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        q = q.gte('expected_date_to', from).lte('expected_date_from', to);
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
  const weatherByDate = data.byDay.length > 0
    ? getWeatherReadinessForecast({ startDate: data.byDay[0].date, days: data.byDay.length })
      .reduce<Record<string, WeatherReadinessLevel>>((acc, day) => {
        acc[day.date] = day.level;
        return acc;
      }, {})
    : {};

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── 1. Expected incoming tonnage ── */}
      <div style={{
        background: '#ecfeff', borderRadius: 10, padding: '12px 14px', border: '1px solid #67e8f9',
      }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13, color: '#155e75' }}>
          🚚 ปริมาณรับเข้าคาดการณ์รวม
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#0f172a' }}>
          <strong>{data.expectedTonnage.toFixed(1)} ตัน</strong> จากคิวที่ยังรอ/ยืนยัน
        </p>
      </div>

      {/* ── 2. Status counts ── */}
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

      {/* ── 3. Dryer load ── */}
      <div style={{ background: '#fff8e1', borderRadius: 10, padding: '12px 14px', border: '1px solid #fde047' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13, color: '#713f12' }}>
          🔥 ต้องการอบ
        </p>
        <p style={{ margin: 0, fontSize: 13, color: '#713f12' }}>
          <strong>{data.dryerRequired}</strong> คิว ·{' '}
          <strong>{data.dryerTonnage.toFixed(1)} ตัน</strong> คาดการณ์
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
        <div style={{ background: '#fff1f2', borderRadius: 10, padding: '12px 14px', border: '1px solid #fecdd3' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#9f1239' }}>Peak days</p>
          <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 24, color: '#be123c' }}>{data.peakDaysCount}</p>
        </div>
        <div style={{ background: '#eff6ff', borderRadius: 10, padding: '12px 14px', border: '1px solid #bfdbfe' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#1d4ed8' }}>Busiest day</p>
          <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 16, color: '#1e3a8a' }}>{data.busiestDay ?? '-'}</p>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '12px 14px', border: '1px solid #bbf7d0' }}>
          <p style={{ margin: 0, fontSize: 11, color: '#166534' }}>Max estimated tonnage</p>
          <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 24, color: '#166534' }}>{data.maxEstimatedTonnage.toFixed(1)} ตัน</p>
        </div>
      </div>

      {/* ── 4. Moisture range ── */}
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

      {data.byDay.length === 0 && (
        <div style={{ border: '1px dashed #d1d5db', borderRadius: 10, padding: '12px 14px', background: '#f9fafb' }}>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            ยังไม่มีข้อมูลโหลดรายวันในช่วงวันที่เลือก
          </p>
        </div>
      )}

      {/* ── 5. Tonnage by day ── */}
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

      {data.byDay.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <p style={{ margin: '8px 0 10px', fontWeight: 700, fontSize: 13 }}>📋 ตารางโหลดรายวัน</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 520, fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['วันที่', 'Booking ทั้งหมด', 'รอ', 'ยืนยัน', 'ตันคาดการณ์', 'Weather', 'Alert'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.byDay.map((d) => {
                const level = getAlertLevel(d.tonnage);
                const alertText = level === 'peak' ? '🔴 peak' : level === 'busy' ? '🟡 busy' : '🟢 normal';
                return (
                <tr key={`row-${d.date}`}>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{d.date}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{d.pending + d.confirmed}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{d.pending}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{d.confirmed}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{d.tonnage.toFixed(1)}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>{weatherBadge(weatherByDate[d.date] ?? 'suitable')}</td>
                  <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 700 }}>{alertText}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </div>

    {/* Queue workload — 7-day incoming summary */}
    <div style={{ marginTop: 24 }}>
      <HarvestWorkloadSummary />
    </div>
    <div style={{ marginTop: 8 }}><HarvestDailyBoard /></div>
    </>
  );
}

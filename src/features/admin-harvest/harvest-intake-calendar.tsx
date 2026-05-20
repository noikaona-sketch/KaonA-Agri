'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState } from '@/shared/components/error-state';

type IntakeRow = {
  scheduled_date: string;
  planned_delivery_date: string | null;
  status: string;
  actual_yield_kg: number | null;
  quality_moisture: number | null;
  drying_preference: string | null;
};

type DailyIntakeSummary = {
  date: string;
  bookingCount: number;
  expectedTonnageKg: number;
  expectedMoistureAvg: number | null;
  dryingCount: number;
  dryingTonnageKg: number;
  completedCount: number;
  pendingCount: number;
};

function toDateKey(row: IntakeRow): string {
  return (row.planned_delivery_date ?? row.scheduled_date).slice(0, 10);
}

function summarize(rows: IntakeRow[], days: string[]): DailyIntakeSummary[] {
  return days.map((day) => {
    const dayRows = rows.filter((r) => toDateKey(r) === day);
    const moistureRows = dayRows.filter((r) => typeof r.quality_moisture === 'number');
    const dryingRows = dayRows.filter((r) => r.drying_preference && r.drying_preference !== 'none');
    return {
      date: day,
      bookingCount: dayRows.length,
      expectedTonnageKg: dayRows.reduce((sum, r) => sum + (r.actual_yield_kg ?? 0), 0),
      expectedMoistureAvg: moistureRows.length > 0
        ? moistureRows.reduce((sum, r) => sum + (r.quality_moisture ?? 0), 0) / moistureRows.length
        : null,
      dryingCount: dryingRows.length,
      dryingTonnageKg: dryingRows.reduce((sum, r) => sum + (r.actual_yield_kg ?? 0), 0),
      completedCount: dayRows.filter((r) => r.status === 'completed').length,
      pendingCount: dayRows.filter((r) => r.status === 'pending').length,
    };
  });
}

function getFutureDays(totalDays: number): string[] {
  return Array.from({ length: totalDays }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function HarvestIntakeCalendar() {
  const [rows, setRows] = useState<IntakeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<'day' | 'week'>('week');

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data, error: err } = await s
        .from('harvest_bookings')
        .select('scheduled_date,planned_delivery_date,status,actual_yield_kg,quality_moisture,drying_preference')
        .in('status', ['pending', 'confirmed', 'completed'])
        .limit(1000);
      if (err) setError(err.message);
      else setRows((data as IntakeRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const days = useMemo(() => getFutureDays(range === 'day' ? 1 : 7), [range]);
  const summaries = useMemo(() => summarize(rows, days), [rows, days]);
  const hasData = summaries.some((d) => d.bookingCount > 0);

  if (loading) return <LoadingState label="กำลังโหลดปฏิทินรับเข้า…" />;
  if (error) return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  return (
    <div>
      <div className="admin-filter-bar" style={{ justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className={`admin-btn ${range === 'day' ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            onClick={() => setRange('day')}
          >
            รายวัน
          </button>
          <button
            type="button"
            className={`admin-btn ${range === 'week' ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            onClick={() => setRange('week')}
          >
            รายสัปดาห์
          </button>
        </div>
        <Link href="/admin/harvest" className="admin-btn admin-btn--secondary">กลับหน้ารถเกี่ยว</Link>
      </div>

      {!hasData ? (
        <div style={{ border: '1px dashed #d1d5db', borderRadius: 12, padding: 24, textAlign: 'center', color: '#6b7280' }}>
          No intake scheduled
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>วันที่</th>
                <th>จำนวนคิว</th>
                <th>คาดการณ์ตัน</th>
                <th>ความชื้นคาดการณ์</th>
                <th>ต้องอบลดความชื้น</th>
                <th>เสร็จแล้ว</th>
                <th>รอดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((d) => (
                <tr key={d.date}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(d.date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{d.bookingCount > 0 ? d.bookingCount : '—'}</td>
                  <td>{d.expectedTonnageKg > 0 ? `${(d.expectedTonnageKg / 1000).toFixed(2)} ตัน` : '—'}</td>
                  <td>{d.expectedMoistureAvg != null ? `${d.expectedMoistureAvg.toFixed(1)}%` : '—'}</td>
                  <td>
                    {d.dryingCount > 0
                      ? `${d.dryingCount} คิว / ${(d.dryingTonnageKg / 1000).toFixed(2)} ตัน`
                      : '—'}
                  </td>
                  <td>{d.completedCount > 0 ? d.completedCount : '—'}</td>
                  <td>{d.pendingCount > 0 ? d.pendingCount : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


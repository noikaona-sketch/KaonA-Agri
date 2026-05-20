'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState } from '@/shared/components/error-state';

type ViewRow = {
  id: string;
  scheduled_date: string;
  status: string;
  actual_yield_kg: number | null;
  quality_moisture: number | null;
};

type P2Row = {
  id: string;
  estimated_moisture_pct: number | null;
  actual_received_kg: number | null;
};

type AnalyticsSummary = {
  days: 7 | 30;
  totalTonnageKg: number;
  bookingCount: number;
  completionRate: number;
  noShowRate: number;
  avgExpectedMoisture: number | null;
  expectedVsActualDeltaKg: number | null;
};

function summarize(days: 7 | 30, rows: (ViewRow & P2Row)[]): AnalyticsSummary {
  const total = rows.length;
  const completed = rows.filter((r) => r.status === 'completed').length;
  const noShow = rows.filter((r) => r.status === 'no_show').length;
  const totalTonnageKg = rows.reduce((s, r) => s + (r.actual_received_kg ?? r.actual_yield_kg ?? 0), 0);

  const expectedMoisture = rows
    .map((r) => r.estimated_moisture_pct)
    .filter((v): v is number => typeof v === 'number');
  const avgExpectedMoisture = expectedMoisture.length
    ? Math.round((expectedMoisture.reduce((s, v) => s + v, 0) / expectedMoisture.length) * 10) / 10
    : null;

  const deltaRows = rows.filter((r) => r.actual_yield_kg != null && r.actual_received_kg != null);
  const expectedVsActualDeltaKg = deltaRows.length
    ? deltaRows.reduce((s, r) => s + ((r.actual_received_kg ?? 0) - (r.actual_yield_kg ?? 0)), 0)
    : null;

  return {
    days,
    totalTonnageKg,
    bookingCount: total,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    noShowRate: total > 0 ? Math.round((noShow / total) * 100) : 0,
    avgExpectedMoisture,
    expectedVsActualDeltaKg,
  };
}

function SummaryCard({ s }: { s: AnalyticsSummary }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, background: '#fff' }}>
      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>ช่วง {s.days} วัน</p>
      <p style={{ margin: '4px 0 10px', fontSize: 20, fontWeight: 800 }}>📦 {(s.totalTonnageKg / 1000).toFixed(1)} ตัน</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, fontSize: 13 }}>
        <div><strong>{s.bookingCount}</strong> นัด</div>
        <div><strong>{s.completionRate}%</strong> สำเร็จ</div>
        <div><strong>{s.noShowRate}%</strong> ไม่มาตามนัด</div>
        <div><strong>{s.avgExpectedMoisture != null ? `${s.avgExpectedMoisture}%` : '—'}</strong> ชื้นคาด</div>
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 12, color: '#4b5563' }}>
        Δ คาด vs จริง: <strong>{s.expectedVsActualDeltaKg != null ? `${s.expectedVsActualDeltaKg.toLocaleString()} กก.` : '—'}</strong>
      </p>
    </div>
  );
}

export function HarvestAnalyticsPage() {
  const [rows, setRows] = useState<(ViewRow & P2Row)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      const s = createSupabaseBrowserClient();
      const from30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

      const { data: vData, error: vErr } = await s
        .from('harvest_bookings_full')
        .select('id,scheduled_date,status,actual_yield_kg,quality_moisture')
        .gte('scheduled_date', from30)
        .in('status', ['pending', 'confirmed', 'completed', 'no_show'])
        .order('scheduled_date', { ascending: false })
        .limit(600);
      if (vErr) {
        setError(vErr.message);
        setLoading(false);
        return;
      }

      const viewRows = (vData as ViewRow[] | null) ?? [];
      const ids = viewRows.map((r) => r.id);
      let p2Map: Record<string, P2Row> = {};

      if (ids.length > 0) {
        const { data: tData } = await s
          .from('harvest_bookings')
          .select('id,estimated_moisture_pct,actual_received_kg')
          .in('id', ids);
        for (const r of (tData as P2Row[] | null) ?? []) p2Map[r.id] = r;
      }

      setRows(viewRows.map((r) => ({ ...r, ...(p2Map[r.id] ?? { id: r.id, estimated_moisture_pct: null, actual_received_kg: null }) })));
      setLoading(false);
    })();
  }, []);

  const now = Date.now();
  const data7 = useMemo(() => rows.filter((r) => now - new Date(r.scheduled_date).getTime() <= 7 * 86400000), [rows, now]);
  const data30 = rows;
  const summary7 = summarize(7, data7);
  const summary30 = summarize(30, data30);

  if (loading) return <LoadingState label="กำลังโหลด Harvest Analytics…" />;
  if (error) return <ErrorState title="โหลด Analytics ไม่สำเร็จ" detail={error} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="admin-filter-bar" style={{ justifyContent: 'space-between' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Read-only สรุปแนวโน้ม 7/30 วันจากข้อมูล Harvest P2</p>
        <Link href="/admin/harvest" className="admin-btn admin-btn--secondary">← กลับหน้ารถเกี่ยว</Link>
      </div>

      {rows.length === 0 ? (
        <div style={{ border: '1px dashed #d1d5db', borderRadius: 12, padding: 32, textAlign: 'center', color: '#6b7280', background: '#fafafa' }}>
          No analytics data yet
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
            <SummaryCard s={summary7} />
            <SummaryCard s={summary30} />
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ช่วงเวลา</th><th>ตันรวม</th><th>จำนวนนัด</th><th>สำเร็จ</th><th>ไม่มาตามนัด</th><th>ชื้นคาดเฉลี่ย</th><th>Δ คาด vs จริง (กก.)</th>
                </tr>
              </thead>
              <tbody>
                {[summary7, summary30].map((s) => (
                  <tr key={s.days}>
                    <td>{s.days} วัน</td>
                    <td>{(s.totalTonnageKg / 1000).toFixed(2)}</td>
                    <td>{s.bookingCount}</td>
                    <td>{s.completionRate}%</td>
                    <td>{s.noShowRate}%</td>
                    <td>{s.avgExpectedMoisture != null ? `${s.avgExpectedMoisture}%` : '—'}</td>
                    <td>{s.expectedVsActualDeltaKg != null ? s.expectedVsActualDeltaKg.toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

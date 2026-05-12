'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';

type CalendarRow = {
  week_start: string;
  plot_count: number;
  total_estimated_kg: number;
  total_estimated_revenue: number;
  crop_types: string[];
};

type HarvestRow = {
  cycle_id: string;
  member_name: string;
  crop_name: string;
  plot_name: string;
  province: string | null;
  harvest_date_estimated: string;
  days_to_harvest: number;
  area_planted_rai: number | null;
  estimated_yield_kg: number | null;
  estimated_revenue: number | null;
  map_color: string;
};

export function HarvestCalendarPanel() {
  const [calendar, setCalendar]   = useState<CalendarRow[]>([]);
  const [upcoming, setUpcoming]   = useState<HarvestRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const [cal, harvest] = await Promise.all([
        s.from('harvest_calendar').select('*').limit(24),
        s.from('farming_map_view')
          .select('cycle_id,member_name,crop_name,plot_name,province,harvest_date_estimated,days_to_harvest,area_planted_rai,estimated_yield_kg,estimated_revenue,map_color')
          .not('harvest_date_estimated', 'is', null)
          .lte('days_to_harvest', 60)
          .gte('days_to_harvest', 0)
          .order('days_to_harvest'),
      ]);
      setCalendar((cal.data as CalendarRow[]) ?? []);
      setUpcoming((harvest.data as HarvestRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <LoadingState label="กำลังโหลดปฏิทิน…" />;

  const urgentCount = upcoming.filter((r) => r.days_to_harvest <= 14).length;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {urgentCount > 0 && (
        <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 10, padding: '12px 16px', fontWeight: 600, color: '#c62828', fontSize: 14 }}>
          🔴 มี {urgentCount} แปลงที่พร้อมเก็บเกี่ยวภายใน 14 วัน
        </div>
      )}

      {/* Upcoming 60 days */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0d3d1f' }}>📅 60 วันข้างหน้า</h2>
        {upcoming.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>ไม่มีแปลงที่คาดจะเก็บเกี่ยวใน 60 วัน</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>แปลง</th><th>สมาชิก</th><th>พืช</th><th>คาดเก็บ</th><th>เหลือ</th><th>ผลผลิต (กก.)</th><th>รายได้ (บาท)</th><th></th></tr>
              </thead>
              <tbody>
                {upcoming.map((r) => (
                  <tr key={r.cycle_id} style={{ background: r.days_to_harvest <= 14 ? '#fff8f8' : undefined }}>
                    <td style={{ fontWeight: 600 }}>{r.plot_name} <span style={{ fontSize: 12, color: '#6b7280' }}>{r.province ?? ''}</span></td>
                    <td>{r.member_name}</td>
                    <td style={{ fontWeight: 600 }}>{r.crop_name}</td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{new Date(r.harvest_date_estimated).toLocaleDateString('th-TH')}</td>
                    <td>
                      <span className={`status-badge ${r.days_to_harvest <= 14 ? 'status-badge--rejected' : r.days_to_harvest <= 30 ? 'status-badge--pending' : 'status-badge--approved'}`}>
                        {r.days_to_harvest === 0 ? 'พร้อมเก็บ' : `${r.days_to_harvest} วัน`}
                      </span>
                    </td>
                    <td>{(r.estimated_yield_kg ?? 0).toLocaleString()}</td>
                    <td>{(r.estimated_revenue ?? 0).toLocaleString()}</td>
                    <td>
                      <a href={`/admin/appointments/new?cycle=${r.cycle_id}`} className="admin-btn admin-btn--success" style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>📅 นัดขาย</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Weekly calendar */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0d3d1f' }}>📆 ปฏิทินรายสัปดาห์ (180 วัน)</h2>
        {calendar.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14 }}>ยังไม่มีข้อมูล</p>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {calendar.map((w) => {
              const weekEnd = new Date(w.week_start);
              weekEnd.setDate(weekEnd.getDate() + 6);
              const isExpanded = expandedWeek === w.week_start;
              return (
                <div key={w.week_start} style={{ background: '#fff', border: '1px solid #e8ede8', borderRadius: 12, overflow: 'hidden' }}>
                  <button
                    onClick={() => setExpandedWeek(isExpanded ? null : w.week_start)}
                    style={{ width: '100%', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 16 }}>📦</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                        {new Date(w.week_start).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} —{' '}
                        {weekEnd.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                        {w.crop_types?.join(', ')} · {w.plot_count} แปลง
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: 800, color: '#1b5e20', fontSize: 15 }}>{(w.total_estimated_kg / 1000).toFixed(1)} ตัน</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{(w.total_estimated_revenue / 1000).toFixed(0)}K บาท</p>
                    </div>
                    <span style={{ color: '#6b7280', fontSize: 16 }}>{isExpanded ? '▲' : '▼'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

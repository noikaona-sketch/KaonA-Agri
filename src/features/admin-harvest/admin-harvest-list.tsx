'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type Booking = {
  id: string; status: string; truck_type: string;
  scheduled_date: string; scheduled_time_start: string | null;
  actual_date: string | null; actual_yield_kg: number | null;
  quality_grade: string | null; quality_moisture: number | null;
  truck_status: string | null; truck_lat: number | null; truck_lng: number | null;
  member_name: string; member_phone: string | null;
  crop_name: string; plot_name: string; plot_province: string | null;
  area_planted_rai: number | null; estimated_yield_kg: number | null;
  truck_member_name: string | null; truck_member_phone: string | null;
  external_truck_name: string | null; external_truck_plate: string | null; external_truck_phone: string | null;
  product_name: string | null; seed_variety: string | null;
  grade_a_moisture_max: number | null; grade_b_moisture_max: number | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  pending:   { badge: 'pending',   label: '⏳ รอยืนยัน' },
  confirmed: { badge: 'approved',  label: '✅ ยืนยัน' },
  completed: { badge: 'approved',  label: '🏁 เสร็จ' },
  cancelled: { badge: 'suspended', label: '⛔ ยกเลิก' },
};

const TRUCK_STATUS: Record<string, string> = {
  waiting: '⏳ รอออกเดินทาง', on_way: '🚜 กำลังเดินทาง',
  arrived: '📍 ถึงแปลงแล้ว', loading: '⬆️ กำลังบรรทุก', done: '✅ เสร็จแล้ว',
};

const GRADE_COLOR: Record<string, string> = { A: '#1b5e20', B: '#e65100', C: '#c62828', reject: '#9e9e9e' };

export function AdminHarvestList() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [acting, setActing]     = useState<string | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);
  const [completing, setCompleting] = useState<Booking | null>(null);
  const [completeForm, setCompleteForm] = useState({ yieldKg: '', moisture: '', grade: '', note: '' });

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const { data, error: err } = await s.from('harvest_bookings_full').select('*').order('scheduled_date').limit(200);
    if (err) setError(err.message);
    else setBookings((data as Booking[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function confirm(id: string) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('harvest_bookings').update({ status: 'confirmed' }).eq('id', id);
    setActing(null); setNotice('✅ ยืนยันแล้ว'); await load();
  }

  async function saveComplete() {
    if (!completing) return;
    setActing(completing.id);
    const s = createSupabaseBrowserClient();
    const moisture = Number(completeForm.moisture);
    let grade = completeForm.grade;

    // auto-calc grade ถ้าไม่ได้เลือก
    if (!grade && moisture > 0) {
      const aMax = completing.grade_a_moisture_max ?? 14.5;
      const bMax = completing.grade_b_moisture_max ?? 18.0;
      grade = moisture <= aMax ? 'A' : moisture <= bMax ? 'B' : moisture <= 25 ? 'C' : 'reject';
    }

    await s.from('harvest_bookings').update({
      status: 'completed',
      actual_date: new Date().toISOString().slice(0, 10),
      actual_yield_kg: Number(completeForm.yieldKg) || null,
      quality_moisture: moisture || null,
      quality_grade: grade || null,
      quality_note: completeForm.note || null,
    }).eq('id', completing.id);

    // อัปเดต planting_cycle ด้วย
    if (completeForm.yieldKg) {
      await s.from('planting_cycles').update({
        actual_yield_kg: Number(completeForm.yieldKg),
        actual_harvest_at: new Date().toISOString().slice(0, 10),
        status: 'harvested',
      }).eq('id', completing.id);
    }

    setActing(null); setCompleting(null);
    setCompleteForm({ yieldKg: '', moisture: '', grade: '', note: '' });
    setNotice('🏁 บันทึกการเก็บเกี่ยวแล้ว'); await load();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error) return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  return (
    <div>
      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

      <div className="admin-filter-bar">
        <Link href="/admin/harvest/new" className="admin-btn admin-btn--primary">🚜 นัดรถเกี่ยว</Link>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>แปลง / พืช</th><th>สมาชิก</th><th>วันนัด</th><th>รถเกี่ยว</th><th>GPS</th><th>ผลผลิต</th><th>เกรด</th><th>สถานะ</th><th style={{ textAlign: 'center' }}>จัดการ</th></tr>
          </thead>
          <tbody>
            {bookings.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ยังไม่มีนัดรถเกี่ยว</td></tr>}
            {bookings.map((b) => {
              const st = STATUS_MAP[b.status] ?? { badge: 'pending', label: b.status };
              const truckName = b.truck_type === 'internal'
                ? (b.truck_member_name ?? '—')
                : `${b.external_truck_name ?? '—'} (${b.external_truck_plate ?? ''})`;
              return (
                <tr key={b.id}>
                  <td>
                    <p style={{ margin: 0, fontWeight: 700 }}>{b.plot_name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#2e7d32', fontWeight: 600 }}>{b.crop_name}</p>
                    {b.product_name && <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{b.product_name} {b.seed_variety ? `(${b.seed_variety})` : ''}</p>}
                  </td>
                  <td>
                    <p style={{ margin: 0, fontWeight: 600 }}>{b.member_name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{b.member_phone ?? ''}</p>
                  </td>
                  <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                    {new Date(b.scheduled_date).toLocaleDateString('th-TH')}
                    {b.scheduled_time_start && <span style={{ display: 'block', color: '#6b7280' }}>{b.scheduled_time_start} น.</span>}
                  </td>
                  <td>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: b.truck_type === 'external' ? 400 : 600 }}>{truckName}</p>
                    {b.truck_type === 'external' && b.external_truck_phone && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{b.external_truck_phone}</p>}
                    {b.truck_status && <span style={{ fontSize: 11, color: '#e65100' }}>{TRUCK_STATUS[b.truck_status]}</span>}
                  </td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace', color: '#6b7280' }}>
                    {b.truck_lat ? `${b.truck_lat.toFixed(4)}, ${b.truck_lng?.toFixed(4)}` : '—'}
                    {b.truck_lat && <a href={`https://www.openstreetmap.org/?mlat=${b.truck_lat}&mlon=${b.truck_lng}&zoom=15`} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: 11, color: '#1565c0' }}>📍 ดูบนแผนที่</a>}
                  </td>
                  <td>{b.actual_yield_kg ? <span style={{ fontWeight: 700 }}>{b.actual_yield_kg.toLocaleString()} กก.</span> : <span style={{ color: '#6b7280', fontSize: 12 }}>~{(b.estimated_yield_kg ?? 0).toLocaleString()}</span>}</td>
                  <td>
                    {b.quality_grade ? (
                      <span style={{ fontWeight: 800, fontSize: 16, color: GRADE_COLOR[b.quality_grade] }}>
                        เกรด {b.quality_grade}
                        {b.quality_moisture ? <span style={{ display: 'block', fontSize: 11, fontWeight: 400 }}>{b.quality_moisture}% ชื้น</span> : null}
                      </span>
                    ) : '—'}
                  </td>
                  <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {b.status === 'pending' && <button className="admin-btn admin-btn--success" onClick={() => confirm(b.id)} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>✅</button>}
                      {b.status === 'confirmed' && <button className="admin-btn admin-btn--primary" onClick={() => { setCompleting(b); setCompleteForm({ yieldKg: String(b.estimated_yield_kg ?? ''), moisture: '', grade: '', note: '' }); }} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>🏁 บันทึก</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Complete + Quality Modal */}
      {completing && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCompleting(null)}>
          <div className="admin-modal" style={{ maxWidth: 460 }}>
            <div className="admin-modal__header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🏁 บันทึกการเก็บเกี่ยว</h2>
              <button className="admin-modal__close" onClick={() => setCompleting(null)}>×</button>
            </div>
            <div className="admin-modal__body">
              <p style={{ margin: 0, fontSize: 14, color: '#4a6741', fontWeight: 600 }}>
                {completing.crop_name} · {completing.plot_name} · {completing.member_name}
              </p>
              {completing.product_name && (
                <div style={{ background: '#e3f2fd', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: '#1565c0' }}>
                  🔬 {completing.product_name} {completing.seed_variety ?? ''} — เกรด A ≤{completing.grade_a_moisture_max ?? 14.5}% ชื้น
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="reg-label">ผลผลิตจริง (กก.)
                  <input className="reg-input" type="number" value={completeForm.yieldKg} onChange={(e) => setCompleteForm((p) => ({ ...p, yieldKg: e.target.value }))} />
                </label>
                <label className="reg-label">ความชื้น (%)
                  <input className="reg-input" type="number" step="0.1" value={completeForm.moisture} onChange={(e) => setCompleteForm((p) => ({ ...p, moisture: e.target.value }))} placeholder="14.5" />
                </label>
              </div>
              <label className="reg-label">เกรด (ระบบจะคำนวณจากความชื้นอัตโนมัติ)
                <select className="reg-input" value={completeForm.grade} onChange={(e) => setCompleteForm((p) => ({ ...p, grade: e.target.value }))}>
                  <option value="">คำนวณอัตโนมัติ</option>
                  <option value="A">เกรด A</option>
                  <option value="B">เกรด B</option>
                  <option value="C">เกรด C</option>
                  <option value="reject">Reject</option>
                </select>
              </label>
              {completeForm.moisture && (
                <div style={{ background: '#f7faf7', borderRadius: 8, padding: 10, fontSize: 14 }}>
                  เกรดจากความชื้น {completeForm.moisture}%:&nbsp;
                  <strong style={{ color: GRADE_COLOR[
                    Number(completeForm.moisture) <= (completing.grade_a_moisture_max ?? 14.5) ? 'A' :
                    Number(completeForm.moisture) <= (completing.grade_b_moisture_max ?? 18) ? 'B' :
                    Number(completeForm.moisture) <= 25 ? 'C' : 'reject'
                  ] }}>
                    เกรด {Number(completeForm.moisture) <= (completing.grade_a_moisture_max ?? 14.5) ? 'A' :
                      Number(completeForm.moisture) <= (completing.grade_b_moisture_max ?? 18) ? 'B' :
                      Number(completeForm.moisture) <= 25 ? 'C' : 'Reject'}
                  </strong>
                </div>
              )}
              <label className="reg-label">หมายเหตุ
                <input className="reg-input" value={completeForm.note} onChange={(e) => setCompleteForm((p) => ({ ...p, note: e.target.value }))} placeholder="หมายเหตุการเก็บเกี่ยว..." />
              </label>
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setCompleting(null)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" onClick={saveComplete} disabled={acting !== null}>
                {acting ? '…' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

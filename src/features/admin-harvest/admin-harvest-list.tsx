'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { HarvestCompleteForm, CompletedActualDisplay, isCompleteFormValid, type CompleteFormState } from './harvest-complete-form';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type Booking = {
  id: string; status: string; truck_type: string;
  scheduled_date: string; scheduled_time_start: string | null;
  actual_date: string | null; actual_yield_kg: number | null;
  quality_grade: string | null; quality_moisture: number | null;
  actual_received_kg: number | null; actual_moisture_pct: number | null; actual_completed_at: string | null; admin_note: string | null;
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
  const [completeForm, setCompleteForm] = useState<CompleteFormState>({ receivedKg: '', actualMoisture: '', adminNote: '' });

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
    if (!completing || !isCompleteFormValid(completeForm)) return;
    setActing(completing.id);
    const s = createSupabaseBrowserClient();
    const { error: saveErr } = await s.from('harvest_bookings').update({
      status:              'completed',
      actual_received_kg:  Number(completeForm.receivedKg),
      actual_moisture_pct: Number(completeForm.actualMoisture),
      actual_completed_at: new Date().toISOString(),
      admin_note:          completeForm.adminNote.trim() || null,
    }).eq('id', completing.id);
    setActing(null);
    if (saveErr) { setNotice(`❌ ${saveErr.message}`); return; }
    setCompleting(null);
    setCompleteForm({ receivedKg: '', actualMoisture: '', adminNote: '' });
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
                    {b.status === 'completed' ? (
                      <CompletedActualDisplay
                        actualReceivedKg={b.actual_received_kg}
                        actualMoisturePct={b.actual_moisture_pct}
                        actualCompletedAt={b.actual_completed_at}
                        adminNote={b.admin_note}
                        farmerEstKg={b.actual_yield_kg}
                        farmerEstMoisture={b.quality_moisture}
                      />
                    ) : (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {b.status === 'pending' && <button className="admin-btn admin-btn--success" onClick={() => confirm(b.id)} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>✅</button>}
                        {b.status === 'confirmed' && <button className="admin-btn admin-btn--primary" onClick={() => { setCompleting(b); setCompleteForm({ receivedKg: '', actualMoisture: '', adminNote: '' }); }} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>🏁 บันทึก</button>}
                      </div>
                    )}
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
              <HarvestCompleteForm
                completing={completing}
                form={completeForm}
                onChange={(patch) => setCompleteForm((p) => ({ ...p, ...patch }))}
              />
              {!isCompleteFormValid(completeForm) && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#e53e3e' }}>
                  กรุณาระบุน้ำหนักรับจริงและความชื้นจริงก่อนบันทึก
                </p>
              )}
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setCompleting(null)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" onClick={saveComplete} disabled={acting !== null || !isCompleteFormValid(completeForm)}>
                {acting ? '…' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type Appt = {
  id: string;
  appointment_number: string;
  status: string;
  payment_status: string;
  appointment_date: string;
  appointment_time: string | null;
  estimated_qty_kg: number;
  actual_qty_kg: number | null;
  price_per_kg: number;
  total_amount: number;
  location_note: string | null;
  note: string | null;
  member: { full_name: string; phone: string | null }[] | null;
  planting_cycles: { crop_name: string; plot_id: string }[] | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  scheduled: { badge: 'pending',   label: '📅 นัดแล้ว' },
  confirmed: { badge: 'approved',  label: '✅ ยืนยัน' },
  completed: { badge: 'approved',  label: '🏁 ขายแล้ว' },
  cancelled: { badge: 'suspended', label: '⛔ ยกเลิก' },
};

export function AdminAppointmentsList() {
  const [appts, setAppts]     = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [acting, setActing]   = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [completing, setCompleting] = useState<Appt | null>(null);
  const [actualQty, setActualQty] = useState('');
  const [actualPrice, setActualPrice] = useState('');

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    let q = s.from('sale_appointments')
      .select('*,member:members!sale_appointments_member_id_fkey(full_name,phone),planting_cycles(crop_name,plot_id)')
      .order('appointment_date').limit(200);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setAppts((data as Appt[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function confirm(id: string) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('sale_appointments').update({ status: 'confirmed' }).eq('id', id);
    setActing(null); setNotice('✅ ยืนยันนัดแล้ว'); await load();
  }

  async function complete() {
    if (!completing) return;
    setActing(completing.id);
    const s = createSupabaseBrowserClient();
    const qty = Number(actualQty) || completing.estimated_qty_kg;
    const price = Number(actualPrice) || completing.price_per_kg;
    await s.from('sale_appointments').update({
      status: 'completed',
      actual_qty_kg: qty,
      price_per_kg: price,
      payment_status: 'paid',
      paid_amount: qty * price,
    }).eq('id', completing.id);
    setActing(null); setCompleting(null); setActualQty(''); setActualPrice('');
    setNotice('🏁 บันทึกการขายสำเร็จ'); await load();
  }

  async function cancel(id: string) {
    if (!window.confirm('ยกเลิกนัดนี้?')) return;
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('sale_appointments').update({ status: 'cancelled' }).eq('id', id);
    setActing(null); setNotice('⛔ ยกเลิกแล้ว'); await load();
  }

  const today = new Date().toISOString().slice(0, 10);
  const pending = appts.filter((a) => ['scheduled','confirmed'].includes(a.status)).length;

  return (
    <div>
      {pending > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontWeight: 600, color: '#e65100', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>📅 มี {pending} นัดที่รอดำเนินการ</span>
          <Link href="/admin/appointments/new" className="admin-btn admin-btn--primary" style={{ fontSize: 13, minHeight: 34, padding: '6px 14px' }}>
            ➕ นัดขายใหม่
          </Link>
        </div>
      )}

      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="scheduled">📅 นัดแล้ว</option>
          <option value="confirmed">✅ ยืนยัน</option>
          <option value="completed">🏁 ขายแล้ว</option>
          <option value="cancelled">⛔ ยกเลิก</option>
        </select>
        {pending === 0 && (
          <Link href="/admin/appointments/new" className="admin-btn admin-btn--primary">➕ นัดขายใหม่</Link>
        )}
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>เลขที่</th><th>สมาชิก</th><th>พืช</th><th>วันนัด</th><th>ปริมาณ (กก.)</th><th>ราคา/กก.</th><th>ยอดรวม</th><th>สถานะ</th><th style={{ textAlign: 'center' }}>จัดการ</th></tr>
            </thead>
            <tbody>
              {appts.length === 0 && <tr><td colSpan={9} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ยังไม่มีนัดขาย</td></tr>}
              {appts.map((a) => {
                const st = STATUS_MAP[a.status] ?? { badge: 'pending', label: a.status };
                const isToday = a.appointment_date === today;
                return (
                  <tr key={a.id} style={{ background: isToday && a.status === 'confirmed' ? '#f1f8f1' : undefined }}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
                      {a.appointment_number}
                      {isToday && <span style={{ display: 'block', fontSize: 10, color: '#2e7d32', fontWeight: 800 }}>วันนี้!</span>}
                    </td>
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>{a.member?.[0]?.full_name ?? '—'}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{a.member?.[0]?.phone ?? ''}</p>
                    </td>
                    <td style={{ fontWeight: 600 }}>{a.planting_cycles?.[0]?.crop_name ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      {new Date(a.appointment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {a.appointment_time && <span style={{ display: 'block', color: '#6b7280' }}>{a.appointment_time} น.</span>}
                    </td>
                    <td>
                      {a.actual_qty_kg ? (
                        <span style={{ fontWeight: 700 }}>{a.actual_qty_kg.toLocaleString()} <span style={{ fontWeight: 400, fontSize: 11, color: '#6b7280' }}>(จริง)</span></span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>~{a.estimated_qty_kg.toLocaleString()} <span style={{ fontSize: 11 }}>(ประมาณ)</span></span>
                      )}
                    </td>
                    <td style={{ fontWeight: 700, color: '#1b5e20' }}>{a.price_per_kg} บาท</td>
                    <td style={{ fontWeight: 800 }}>{a.total_amount.toLocaleString()} บาท</td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {a.status === 'scheduled' && <button className="admin-btn admin-btn--success" onClick={() => confirm(a.id)} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>✅ ยืนยัน</button>}
                        {a.status === 'confirmed' && <button className="admin-btn admin-btn--primary" onClick={() => { setCompleting(a); setActualQty(String(a.estimated_qty_kg)); setActualPrice(String(a.price_per_kg)); }} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>🏁 บันทึกขาย</button>}
                        {!['completed','cancelled'].includes(a.status) && <button className="admin-btn admin-btn--danger" onClick={() => cancel(a.id)} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>⛔</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Complete modal */}
      {completing && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setCompleting(null)}>
          <div className="admin-modal" style={{ maxWidth: 420 }}>
            <div className="admin-modal__header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>🏁 บันทึกการขาย</h2>
              <button className="admin-modal__close" onClick={() => setCompleting(null)}>×</button>
            </div>
            <div className="admin-modal__body">
              <p style={{ margin: 0, fontSize: 14, color: '#4a6741' }}>
                <strong>{completing.member?.[0]?.full_name}</strong> · {completing.planting_cycles?.[0]?.crop_name}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="reg-label">ปริมาณจริง (กก.) <span className="reg-required">*</span>
                  <input className="reg-input" type="number" value={actualQty} onChange={(e) => setActualQty(e.target.value)} placeholder={String(completing.estimated_qty_kg)} />
                </label>
                <label className="reg-label">ราคา (บาท/กก.)
                  <input className="reg-input" type="number" step="0.1" value={actualPrice} onChange={(e) => setActualPrice(e.target.value)} />
                </label>
              </div>
              <div style={{ background: '#f7faf7', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18, color: '#1b5e20' }}>
                  <span>ยอดรวม</span>
                  <span>{((Number(actualQty) || completing.estimated_qty_kg) * (Number(actualPrice) || completing.price_per_kg)).toLocaleString()} บาท</span>
                </div>
              </div>
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setCompleting(null)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" onClick={complete} disabled={acting !== null}>
                {acting ? '…' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

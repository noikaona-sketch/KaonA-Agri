'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type Appointment = {
  id: string; appointment_number: string; status: string;
  payment_status: string; appointment_date: string;
  appointment_time: string | null; estimated_qty_kg: number;
  actual_qty_kg: number | null; price_per_kg: number;
  total_amount: number; location_note: string | null;
  members: { full_name: string; phone: string | null }[] | null;
  planting_cycles: { crop_name: string; season_year: number }[] | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  scheduled:  { badge: 'pending',   label: '📅 นัดแล้ว' },
  confirmed:  { badge: 'approved',  label: '✅ ยืนยัน' },
  completed:  { badge: 'approved',  label: '🏁 ขายแล้ว' },
  cancelled:  { badge: 'suspended', label: '⛔ ยกเลิก' },
};
const PAY_MAP: Record<string, string> = { unpaid: '⏳ ยังไม่ชำระ', paid: '✅ ชำระแล้ว', partial: '🔸 บางส่วน' };

export function AppointmentsList() {
  const [items, setItems]     = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [acting, setActing]   = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    let q = s.from('sale_appointments')
      .select('id,appointment_number,status,payment_status,appointment_date,appointment_time,estimated_qty_kg,actual_qty_kg,price_per_kg,total_amount,location_note,members(full_name,phone),planting_cycles(crop_name,season_year)')
      .order('appointment_date').limit(200);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setItems((data as Appointment[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function confirm(id: string) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('sale_appointments').update({ status: 'confirmed' }).eq('id', id);
    setActing(null); setNotice('✅ ยืนยันนัดแล้ว'); await load();
  }

  async function cancel(id: string) {
    if (!window.confirm('ยกเลิกนัดขายนี้?')) return;
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('sale_appointments').update({ status: 'cancelled' }).eq('id', id);
    setActing(null); setNotice('⛔ ยกเลิกแล้ว'); await load();
  }

  const todayCount = items.filter((i) => i.appointment_date === new Date().toISOString().slice(0, 10)).length;
  const pendingCount = items.filter((i) => ['scheduled', 'confirmed'].includes(i.status)).length;

  return (
    <div>
      {/* Badges */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {todayCount > 0 && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '8px 14px', fontSize: 14, fontWeight: 600, color: '#1b5e20' }}>
            📅 วันนี้ {todayCount} นัด
          </div>
        )}
        {pendingCount > 0 && (
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '8px 14px', fontSize: 14, fontWeight: 600, color: '#e65100' }}>
            ⏳ รอดำเนินการ {pendingCount} นัด
          </div>
        )}
        {notice && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '8px 14px', fontSize: 14, fontWeight: 600, color: '#1b5e20' }}>
            {notice}
          </div>
        )}
      </div>

      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="scheduled">📅 นัดแล้ว</option>
          <option value="confirmed">✅ ยืนยัน</option>
          <option value="completed">🏁 ขายแล้ว</option>
          <option value="cancelled">⛔ ยกเลิก</option>
        </select>
        <Link href="/admin/appointments/new" className="admin-btn admin-btn--primary">
          ➕ นัดขายใหม่
        </Link>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>เลขที่</th><th>สมาชิก</th><th>พืช</th><th>วันนัด</th><th>ปริมาณ</th><th>ราคา</th><th>ยอด</th><th>สถานะ</th><th>การชำระ</th><th style={{ textAlign: 'center' }}>จัดการ</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีนัดขาย</td></tr>}
              {items.map((item) => {
                const st = STATUS_MAP[item.status] ?? { badge: 'pending', label: item.status };
                const isToday = item.appointment_date === new Date().toISOString().slice(0, 10);
                return (
                  <tr key={item.id} style={{ background: isToday ? '#f9fff9' : undefined }}>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>{item.appointment_number}</td>
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>{item.members?.[0]?.full_name ?? '—'}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{item.members?.[0]?.phone ?? ''}</p>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {item.planting_cycles?.[0]?.crop_name ?? '—'}
                      <span style={{ display: 'block', fontSize: 11, color: '#6b7280' }}>{item.planting_cycles?.[0]?.season_year}</span>
                    </td>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
                      {new Date(item.appointment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {item.appointment_time && <span style={{ display: 'block', fontSize: 11, color: '#6b7280' }}>{item.appointment_time} น.</span>}
                      {isToday && <span className="status-badge status-badge--approved" style={{ fontSize: 10 }}>วันนี้</span>}
                    </td>
                    <td>
                      <p style={{ margin: 0, fontWeight: 700 }}>{(item.actual_qty_kg ?? item.estimated_qty_kg).toLocaleString()} กก.</p>
                      {item.actual_qty_kg && item.actual_qty_kg !== item.estimated_qty_kg && (
                        <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>คาด: {item.estimated_qty_kg.toLocaleString()}</p>
                      )}
                    </td>
                    <td>{item.price_per_kg} บาท/กก.</td>
                    <td style={{ fontWeight: 800, color: '#1b5e20' }}>{item.total_amount.toLocaleString()} บาท</td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                    <td style={{ fontSize: 12 }}>{PAY_MAP[item.payment_status] ?? item.payment_status}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <Link href={`/admin/appointments/${item.id}`} className="admin-btn admin-btn--ghost" style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>ดู</Link>
                        {item.status === 'scheduled' && <button className="admin-btn admin-btn--success" onClick={() => confirm(item.id)} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>✅</button>}
                        {['scheduled', 'confirmed'].includes(item.status) && <button className="admin-btn admin-btn--danger" onClick={() => cancel(item.id)} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>⛔</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

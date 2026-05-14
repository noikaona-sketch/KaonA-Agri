'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

// service_bookings table — ถ้ายังไม่มีจะ fallback gracefully
type BookingRow = {
  id: string;
  member_id: string;
  service_type: string;
  scheduled_date: string | null;
  status: string;
  note: string | null;
  created_at: string;
  members: { full_name: string; phone: string | null }[] | null;
  assigned_to: { full_name: string } | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  pending:    { badge: 'pending',   label: '⏳ รอยืนยัน' },
  confirmed:  { badge: 'approved',  label: '✅ ยืนยันแล้ว' },
  in_progress:{ badge: 'pending',   label: '🔄 กำลังดำเนินการ' },
  completed:  { badge: 'approved',  label: '🏁 เสร็จแล้ว' },
  cancelled:  { badge: 'suspended', label: '⛔ ยกเลิก' },
};

const SERVICE_LABELS: Record<string, string> = {
  tractor:   '🚜 รถไถ',
  spray:     '💦 ฉีดพ่น',
  transport: '🚛 ขนส่ง',
  harvest:   '🌾 เก็บเกี่ยว',
  other:     '📋 อื่นๆ',
};

export function AdminServiceList() {
  const [rows, setRows]       = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [acting, setActing]   = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    let q = s.from('service_bookings')
      .select('*,members(full_name,phone),assigned_to:assigned_to_member_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(200);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error: err } = await q;
    if (err) {
      // table อาจยังไม่มี
      if (err.code === '42P01') setError('ยังไม่มีข้อมูลการจองบริการ — run migrations ก่อน');
      else setError(err.message);
    } else setRows((data as BookingRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function updateStatus(id: string, status: string) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('service_bookings').update({ status }).eq('id', id);
    setActing(null);
    setNotice(`อัปเดตสถานะแล้ว`);
    await load();
  }

  return (
    <div>
      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="pending">⏳ รอยืนยัน</option>
          <option value="confirmed">✅ ยืนยันแล้ว</option>
          <option value="in_progress">🔄 กำลังดำเนินการ</option>
          <option value="completed">🏁 เสร็จแล้ว</option>
          <option value="cancelled">⛔ ยกเลิก</option>
        </select>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '12px 16px', color: '#e65100' }}>⚠️ {error}</div>}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>สมาชิก</th><th>บริการ</th><th>วันนัด</th><th>ผู้รับงาน</th><th>สถานะ</th><th style={{ textAlign: 'center' }}>อัปเดต</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีการจอง</td></tr>}
              {rows.map((r) => {
                const st = STATUS_MAP[r.status] ?? { badge: 'pending', label: r.status };
                return (
                  <tr key={r.id}>
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>{r.members?.[0]?.full_name ?? '—'}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.members?.[0]?.phone ?? ''}</p>
                    </td>
                    <td>{SERVICE_LABELS[r.service_type] ?? r.service_type}</td>
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString('th-TH') : '—'}</td>
                    <td>{r.assigned_to?.full_name ?? <span style={{ color: '#9ca3af' }}>ยังไม่ได้มอบหมาย</span>}</td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {r.status === 'pending'     && <button className="admin-btn admin-btn--success" onClick={() => updateStatus(r.id, 'confirmed')} disabled={acting !== null}>✅ ยืนยัน</button>}
                        {r.status === 'confirmed'   && <button className="admin-btn admin-btn--secondary" onClick={() => updateStatus(r.id, 'in_progress')} disabled={acting !== null}>🔄 เริ่มงาน</button>}
                        {r.status === 'in_progress' && <button className="admin-btn admin-btn--success" onClick={() => updateStatus(r.id, 'completed')} disabled={acting !== null}>🏁 เสร็จ</button>}
                        {!['completed','cancelled'].includes(r.status) && <button className="admin-btn admin-btn--danger" onClick={() => updateStatus(r.id, 'cancelled')} disabled={acting !== null}>⛔</button>}
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

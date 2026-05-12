'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type SeedOrder = {
  id: string;
  member_id: string;
  seed_type: string;
  quantity_kg: number;
  status: string;
  note: string | null;
  created_at: string;
  members: { full_name: string; phone: string | null } | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  requested: { badge: 'pending',   label: '⏳ รอดำเนินการ' },
  approved:  { badge: 'approved',  label: '✅ อนุมัติ' },
  delivered: { badge: 'approved',  label: '📦 จัดส่งแล้ว' },
  rejected:  { badge: 'rejected',  label: '❌ ไม่อนุมัติ' },
};

export function AdminSeedsList() {
  const [orders, setOrders]   = useState<SeedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [acting, setActing]   = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    let q = s.from('seed_orders').select('*,members(full_name,phone)').order('created_at', { ascending: false }).limit(200);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setOrders((data as SeedOrder[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [statusFilter]);

  async function approve(id: string, decision: 'approved' | 'rejected') {
    if (!window.confirm(decision === 'approved' ? 'อนุมัติคำสั่งนี้?' : 'ปฏิเสธคำสั่งนี้?')) return;
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('seed_orders').update({ status: decision }).eq('id', id);
    setActing(null);
    setNotice(decision === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธแล้ว');
    await load();
  }

  async function markDelivered(id: string) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('seed_orders').update({ status: 'delivered' }).eq('id', id);
    setActing(null);
    setNotice('📦 บันทึกการจัดส่งแล้ว');
    await load();
  }

  return (
    <div>
      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="requested">⏳ รอดำเนินการ</option>
          <option value="approved">✅ อนุมัติ</option>
          <option value="delivered">📦 จัดส่งแล้ว</option>
          <option value="rejected">❌ ไม่อนุมัติ</option>
        </select>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>สมาชิก</th><th>ชนิดเมล็ด</th><th>จำนวน (กก.)</th><th>สถานะ</th><th>วันที่สั่ง</th><th style={{ textAlign: 'center' }}>การดำเนินการ</th></tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีคำสั่ง</td></tr>}
              {orders.map((o) => {
                const st = STATUS_MAP[o.status] ?? { badge: 'pending', label: o.status };
                return (
                  <tr key={o.id}>
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>{o.members?.full_name ?? '—'}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{o.members?.phone ?? ''}</p>
                    </td>
                    <td style={{ fontWeight: 600 }}>{o.seed_type}</td>
                    <td>{o.quantity_kg.toLocaleString()}</td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                    <td style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(o.created_at).toLocaleDateString('th-TH')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                        {o.status === 'requested' && <>
                          <button className="admin-btn admin-btn--success" onClick={() => approve(o.id, 'approved')} disabled={acting !== null}>✅</button>
                          <button className="admin-btn admin-btn--danger"  onClick={() => approve(o.id, 'rejected')} disabled={acting !== null}>❌</button>
                        </>}
                        {o.status === 'approved' && <button className="admin-btn admin-btn--secondary" onClick={() => markDelivered(o.id)} disabled={acting !== null}>📦 จัดส่ง</button>}
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

'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type Order = {
  id: string; order_number: string; order_type: string;
  status: string; payment_status: string; payment_method: string | null;
  total: number; paid_amount: number; created_at: string;
  pickup_date: string | null; reserved_until: string | null;
  members: { full_name: string; phone: string | null }[] | null;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  pending:    { badge: 'pending',   label: '⏳ รอยืนยัน' },
  confirmed:  { badge: 'approved',  label: '✅ ยืนยัน' },
  ready:      { badge: 'approved',  label: '📦 พร้อมรับ' },
  completed:  { badge: 'approved',  label: '🏁 เสร็จ' },
  cancelled:  { badge: 'suspended', label: '⛔ ยกเลิก' },
};
const PAY_TH: Record<string, string> = { cash: '💵', transfer: '📱', debit_account: '📒', credit: '💳' };

export function AdminOrdersList() {
  const [orders, setOrders]   = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [acting, setActing]   = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    let q = s.from('sale_orders')
      .select('id,order_number,order_type,status,payment_status,payment_method,total,paid_amount,created_at,pickup_date,reserved_until,members(full_name,phone)')
      .order('created_at', { ascending: false }).limit(200);
    if (typeFilter) q = q.eq('order_type', typeFilter);
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data, error: err } = await q;
    if (err) setError(err.message);
    else setOrders((data as Order[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [typeFilter, statusFilter]);

  async function confirmReservation(id: string) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('sale_orders').update({ status: 'confirmed' }).eq('id', id);
    setActing(null); await load();
  }

  async function markReady(id: string) {
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('sale_orders').update({ status: 'ready' }).eq('id', id);
    setActing(null); await load();
  }

  async function cancelOrder(id: string) {
    if (!window.confirm('ยกเลิกคำสั่งนี้?')) return;
    setActing(id);
    const s = createSupabaseBrowserClient();
    await s.from('sale_orders').update({ status: 'cancelled' }).eq('id', id);
    setActing(null); await load();
  }

  const pendingCount = orders.filter((o) => ['pending','confirmed','ready'].includes(o.status)).length;

  return (
    <div>
      {pendingCount > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: '#e65100', fontSize: 14 }}>
          📋 มี {pendingCount} คำสั่งที่รอดำเนินการ
        </div>
      )}
      <div className="admin-filter-bar">
        <select className="admin-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">ทุกประเภท</option>
          <option value="sale">💰 ขายทันที</option>
          <option value="reservation">📋 จอง</option>
        </select>
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="pending">⏳ รอยืนยัน</option>
          <option value="confirmed">✅ ยืนยัน</option>
          <option value="ready">📦 พร้อมรับ</option>
          <option value="completed">🏁 เสร็จ</option>
          <option value="cancelled">⛔ ยกเลิก</option>
        </select>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>เลขที่</th><th>สมาชิก</th><th>ประเภท</th><th>ยอด</th><th>ชำระ</th><th>สถานะ</th><th>วันที่</th><th style={{ textAlign: 'center' }}>จัดการ</th></tr>
            </thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มีคำสั่ง</td></tr>}
              {orders.map((o) => {
                const st = STATUS_MAP[o.status] ?? { badge: 'pending', label: o.status };
                const isReservation = o.order_type === 'reservation';
                return (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{o.order_number}</td>
                    <td>
                      <p style={{ margin: 0, fontWeight: 600 }}>{o.members?.[0]?.full_name ?? '—'}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{o.members?.[0]?.phone ?? ''}</p>
                    </td>
                    <td>{isReservation ? '📋 จอง' : '💰 ขาย'}</td>
                    <td style={{ fontWeight: 700 }}>{o.total.toLocaleString()} บาท</td>
                    <td>
                      <span style={{ fontSize: 13 }}>{PAY_TH[o.payment_method ?? ''] ?? ''} </span>
                      <span className={`status-badge ${o.payment_status === 'paid' ? 'status-badge--approved' : 'status-badge--pending'}`} style={{ fontSize: 11 }}>
                        {o.payment_status === 'paid' ? 'ชำระแล้ว' : o.payment_status === 'partial' ? 'บางส่วน' : 'ยังไม่ชำระ'}
                      </span>
                    </td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                    <td style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(o.created_at).toLocaleDateString('th-TH')}
                      {o.pickup_date && <span style={{ display: 'block' }}>นัดรับ: {new Date(o.pickup_date).toLocaleDateString('th-TH')}</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {o.status === 'pending'   && <button className="admin-btn admin-btn--success" onClick={() => confirmReservation(o.id)} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>✅</button>}
                        {o.status === 'confirmed' && <button className="admin-btn admin-btn--secondary" onClick={() => markReady(o.id)} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>📦</button>}
                        {!['completed','cancelled'].includes(o.status) && <button className="admin-btn admin-btn--danger" onClick={() => cancelOrder(o.id)} disabled={acting !== null} style={{ fontSize: 12, padding: '4px 8px', minHeight: 30 }}>⛔</button>}
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

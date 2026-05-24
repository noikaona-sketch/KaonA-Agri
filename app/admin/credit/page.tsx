'use client';

import { useEffect, useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { LoadingState } from '@/shared/components/loading-state';

type CreditRow = {
  member_id: string; balance: number; debit_balance: number;
  total_spent: number; total_paid: number;
  members: { full_name: string; phone: string | null }[] | null;
};

export default function AdminCreditPage() {
  const [rows, setRows]     = useState<CreditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal]   = useState<{ memberId: string; name: string; action: 'add_credit' | 'record_payment' } | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote]     = useState('');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/credit', { credentials: 'include' });
    const d = (await res.json()) as { items?: CreditRow[] };
    setRows(d.items ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function doAction() {
    if (!modal || !amount || Number(amount) <= 0) return;
    setActing(modal.memberId);
    const res = await fetch('/api/admin/credit', { credentials: 'include', 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: modal.action, member_id: modal.memberId, amount: Number(amount), note }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setActing(null); setModal(null); setAmount(''); setNote('');
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice(modal.action === 'add_credit' ? '✅ เพิ่มเครดิตแล้ว' : '✅ บันทึกการชำระแล้ว');
    await load();
  }

  return (
    <AdminWebShell title="💳 จัดการเครดิต / ยอดค้างชำระ" subtitle="ดูยอดค้าง เพิ่มเครดิต และบันทึกการชำระ">
      {notice && <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>{notice}</div>}

      {loading && <LoadingState label="กำลังโหลด…" />}

      {!loading && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>สมาชิก</th><th>ยอดค้างชำระ</th><th>รวมซื้อ</th><th>รวมชำระ</th><th style={{ textAlign: 'center' }}>จัดการ</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่มียอดค้างชำระ</td></tr>}
              {rows.map((r) => (
                <tr key={r.member_id}>
                  <td>
                    <p style={{ margin: 0, fontWeight: 700 }}>{r.members?.[0]?.full_name ?? '—'}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.members?.[0]?.phone ?? ''}</p>
                  </td>
                  <td style={{ fontWeight: 800, color: r.debit_balance > 0 ? '#c62828' : '#2e7d32', fontSize: 16 }}>
                    {r.debit_balance.toLocaleString()} บาท
                  </td>
                  <td style={{ color: '#6b7280' }}>{r.total_spent.toLocaleString()} บาท</td>
                  <td style={{ color: '#6b7280' }}>{r.total_paid.toLocaleString()} บาท</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button className="admin-btn admin-btn--success" onClick={() => setModal({ memberId: r.member_id, name: r.members?.[0]?.full_name ?? '', action: 'record_payment' })} disabled={acting !== null} style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}>💵 รับชำระ</button>
                      <button className="admin-btn admin-btn--secondary" onClick={() => setModal({ memberId: r.member_id, name: r.members?.[0]?.full_name ?? '', action: 'add_credit' })} disabled={acting !== null} style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }}>💳 เติมเครดิต</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div className="admin-modal" style={{ maxWidth: 380 }}>
            <div className="admin-modal__header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {modal.action === 'add_credit' ? '💳 เติมเครดิต' : '💵 รับชำระเงิน'} — {modal.name}
              </h2>
              <button className="admin-modal__close" onClick={() => setModal(null)}>×</button>
            </div>
            <div className="admin-modal__body">
              <label className="reg-label">จำนวน (บาท) <span className="reg-required">*</span>
                <input className="reg-input" type="number" min="1" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
              <label className="reg-label">หมายเหตุ
                <input className="reg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เหตุผล / อ้างอิง..." />
              </label>
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setModal(null)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" onClick={doAction} disabled={acting !== null || !amount}>
                {acting ? '…' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminWebShell>
  );
}

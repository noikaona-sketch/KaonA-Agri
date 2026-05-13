'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type QueueItem = {
  id: string;           // approval id
  member_id: string;
  created_at: string;
  members: {
    id: string; full_name: string; phone: string | null;
    citizen_id_masked: string; registration_type: string | null;
    address: string | null; created_at: string;
  };
};

export function AdminApprovalQueue() {
  const [items, setItems]     = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true); setError(null);
    const res = await fetch('/api/admin/members/approvals');
    const payload = (await res.json()) as { items?: QueueItem[]; error?: string };
    if (!res.ok) { setError(payload.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setItems(payload.items ?? []);
    setLoading(false);
  }

  useEffect(() => { void loadQueue(); }, []);

  async function review(approvalId: string, memberId: string, decision: 'approved' | 'rejected') {
    if (!window.confirm(decision === 'approved' ? 'อนุมัติสมาชิกนี้?' : 'ไม่อนุมัติสมาชิกนี้?')) return;
    setActingId(approvalId); setNotice(null);
    const res = await fetch('/api/admin/members/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, approvalId, decision }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    setActingId(null);
    if (!res.ok) { setError(payload.error ?? 'ดำเนินการไม่สำเร็จ'); return; }
    setNotice(decision === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติแล้ว');
    await loadQueue();
  }

  if (loading) return <LoadingState label="กำลังโหลดคิวอนุมัติ…" />;
  if (error) return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  return (
    <div>
      {notice && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 14, color: '#1b5e20', fontWeight: 600 }}>
          {notice}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ margin: '8px 0 0', fontWeight: 600 }}>ไม่มีคำขอรออนุมัติ</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>เบอร์โทร</th>
                <th>เลขบัตร</th>
                <th>ประเภท</th>
                <th>ที่อยู่</th>
                <th>วันที่ยื่น</th>
                <th style={{ textAlign: 'center' }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/admin/members/${item.member_id}`}
                      style={{ fontWeight: 700, color: '#0d3d1f', textDecoration: 'none' }}>
                      {item.members.full_name}
                    </Link>
                  </td>
                  <td style={{ color: '#6b7280' }}>{item.members.phone ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                    {item.members.citizen_id_masked}
                  </td>
                  <td>
                    <span className="role-pill">
                      {item.members.registration_type === 'self' ? '🌾 สมัครเอง' :
                       item.members.registration_type === 'admin_created' ? '⚙️ admin สร้าง' : '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#6b7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.members.address ?? '—'}
                  </td>
                  <td style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(item.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button className="admin-btn admin-btn--success"
                        onClick={() => review(item.id, item.member_id, 'approved')}
                        disabled={actingId !== null} style={{ fontSize: 13 }}>
                        ✅ อนุมัติ
                      </button>
                      <button className="admin-btn admin-btn--danger"
                        onClick={() => review(item.id, item.member_id, 'rejected')}
                        disabled={actingId !== null} style={{ fontSize: 13 }}>
                        ❌ ไม่อนุมัติ
                      </button>
                      <Link href={`/admin/members/${item.member_id}`} className="admin-btn admin-btn--ghost" style={{ fontSize: 13 }}>
                        ดูข้อมูล
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

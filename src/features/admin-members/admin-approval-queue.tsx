'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type QueueItem = {
  approval_id: string;
  member_id: string;
  full_name: string;
  phone: string | null;
  citizen_id_masked: string;
  requested_at: string;
};

export function AdminApprovalQueue() {
  const [items, setItems]     = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc('list_member_onboarding_queue');
    if (rpcError) setError(rpcError.message);
    else setItems((data as QueueItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void loadQueue(); }, []);

  async function review(approvalId: string, memberId: string, decision: 'approved' | 'rejected') {
    if (!window.confirm(decision === 'approved' ? 'อนุมัติสมาชิกนี้?' : 'ไม่อนุมัติสมาชิกนี้?')) return;
    setActingId(approvalId);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcError } = await supabase.rpc('review_member_onboarding', {
      p_approval_id: approvalId, p_decision: decision,
    });
    setActingId(null);
    if (rpcError) { setError(rpcError.message); return; }
    setNotice(decision === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ไม่อนุมัติแล้ว');
    await loadQueue();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error) return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  return (
    <div>
      {notice && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '12px 16px', marginBottom: 16, color: '#1b5e20', fontWeight: 600 }}>
          {notice}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>ไม่มีคำขอรออนุมัติ</p>
          <p style={{ margin: '4px 0 0', fontSize: 14 }}>สมาชิกทุกคนได้รับการตรวจสอบแล้ว</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>เบอร์โทร</th>
                <th>เลขบัตร (ปกปิด)</th>
                <th>วันที่ยื่น</th>
                <th style={{ textAlign: 'center' }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.approval_id}>
                  <td>
                    <Link href={`/admin/members/${item.member_id}`} style={{ fontWeight: 700, color: '#0d3d1f', textDecoration: 'none' }}>
                      {item.full_name}
                    </Link>
                  </td>
                  <td style={{ color: '#6b7280' }}>{item.phone ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', color: '#6b7280' }}>{item.citizen_id_masked}</td>
                  <td style={{ color: '#6b7280', whiteSpace: 'nowrap', fontSize: 13 }}>
                    {new Date(item.requested_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button
                        className="admin-btn admin-btn--success"
                        onClick={() => review(item.approval_id, item.member_id, 'approved')}
                        disabled={actingId !== null}
                      >
                        ✅ อนุมัติ
                      </button>
                      <button
                        className="admin-btn admin-btn--danger"
                        onClick={() => review(item.approval_id, item.member_id, 'rejected')}
                        disabled={actingId !== null}
                      >
                        ❌ ไม่อนุมัติ
                      </button>
                      <Link href={`/admin/members/${item.member_id}`} className="admin-btn admin-btn--secondary">
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

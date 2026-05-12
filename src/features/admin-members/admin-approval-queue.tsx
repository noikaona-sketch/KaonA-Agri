'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type QueueItem = {
  approval_id: string;
  member_id: string;
  full_name: string;
  phone: string | null;
  citizen_id_masked: string;
  requested_at: string;
};

export function AdminApprovalQueue() {
  const [items, setItems]   = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc('list_member_onboarding_queue');
    if (rpcError) { setError(rpcError.message); } else { setItems((data as QueueItem[]) ?? []); }
    setLoading(false);
  }

  useEffect(() => { void loadQueue(); }, []);

  async function review(approvalId: string, decision: 'approved' | 'rejected') {
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

  if (loading) return <LoadingState label="กำลังโหลดคิวอนุมัติ…" />;
  if (error) return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  return (
    <div className="mobile-stack">
      {notice && <p style={{ margin: 0, fontWeight: 600, color: 'var(--primary)' }}>{notice}</p>}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40 }}>✅</div>
          <p style={{ margin: '8px 0 0' }}>ไม่มีคำขอรออนุมัติ</p>
        </div>
      )}

      {items.map((item) => (
        <article key={item.approval_id} className="kaona-card">
          <div className="kaona-card__header">
            <div className="kaona-card__heading">
              <p className="kaona-card__title">{item.full_name}</p>
              <p className="kaona-card__subtitle">
                📞 {item.phone ?? '-'} · บัตร: {item.citizen_id_masked}
              </p>
              <p className="kaona-card__subtitle">
                ยื่นเมื่อ: {new Date(item.requested_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <StatusChip status="submitted" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
            <UIButton
              onClick={() => review(item.approval_id, 'approved')}
              loading={actingId === item.approval_id}
              disabled={actingId !== null}
            >
              ✅ อนุมัติ
            </UIButton>
            <UIButton
              variant="secondary"
              onClick={() => review(item.approval_id, 'rejected')}
              loading={actingId === item.approval_id}
              disabled={actingId !== null}
            >
              ❌ ไม่อนุมัติ
            </UIButton>
          </div>
        </article>
      ))}
    </div>
  );
}

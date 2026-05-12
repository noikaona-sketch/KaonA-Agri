'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { FormSheet } from '@/shared/components/form-sheet';
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

export function MemberApprovalQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function loadQueue() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc('list_member_onboarding_queue');

    if (rpcError) {
      setError(rpcError.message);
      setLoading(false);
      return;
    }

    setItems(Array.isArray(data) ? (data as QueueItem[]) : []);
    setLoading(false);
  }

  useEffect(() => {
    void loadQueue();
  }, []);

  async function review(approvalId: string, decision: 'approved' | 'rejected') {
    const confirmationMessage = decision === 'approved' ? 'ยืนยันอนุมัติคำขอสมัครสมาชิกนี้ใช่หรือไม่?' : 'ยืนยันไม่อนุมัติคำขอสมัครสมาชิกนี้ใช่หรือไม่?';
    if (!window.confirm(confirmationMessage)) return;

    setActingId(approvalId);
    setError(null);
    setNotice(null);

    const supabase = createSupabaseBrowserClient();
    const { error: rpcError } = await supabase.rpc('review_member_onboarding', {
      p_approval_id: approvalId,
      p_decision: decision,
    });

    setActingId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setNotice(decision === 'approved' ? 'อนุมัติคำขอสมาชิกเรียบร้อยแล้ว' : 'ไม่อนุมัติคำขอสมาชิกเรียบร้อยแล้ว');

    await loadQueue();
  }

  return (
    <FormSheet title="คิวอนุมัติสมาชิก">
      {loading ? <p>กำลังโหลดรายการรออนุมัติ...</p> : null}
      {!loading && items.length === 0 ? <p>ยังไม่มีคำขอสมัครสมาชิกที่รออนุมัติ</p> : null}
      {error ? <ErrorState title="โหลดคิวอนุมัติไม่สำเร็จ" detail={error} /> : null}
      {notice ? <p>{notice}</p> : null}

      {items.map((item) => (
        <article key={item.approval_id}>
          <h3>{item.full_name}</h3>
          <p>เบอร์โทร: {item.phone ?? '-'}</p>
          <p>เลขบัตรประชาชน (ปกปิด): {item.citizen_id_masked}</p>
          <p>วันที่ยื่นคำขอ: {new Date(item.requested_at).toLocaleString('th-TH')}</p>
          <StatusChip status="submitted" />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <UIButton
              onClick={() => review(item.approval_id, 'approved')}
              loading={actingId === item.approval_id}
              disabled={actingId !== null}
            >
              อนุมัติ
            </UIButton>
            <UIButton
              variant="secondary"
              onClick={() => review(item.approval_id, 'rejected')}
              loading={actingId === item.approval_id}
              disabled={actingId !== null}
            >
              ไม่อนุมัติ
            </UIButton>
          </div>
          <hr style={{ margin: '12px 0' }} />
        </article>
      ))}
    </FormSheet>
  );
}

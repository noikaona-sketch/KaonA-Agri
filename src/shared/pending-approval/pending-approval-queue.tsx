'use client';

import { useMemo, useState } from 'react';

import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

import { PendingApprovalPanel } from './pending-approval-panel';
import type { PendingApprovalDomain, PendingApprovalStatus } from './status-model';

type ApprovalQueueItem = {
  id: string;
  title: string;
  applicantName: string;
  submittedAt: string;
  domain: PendingApprovalDomain;
  status: PendingApprovalStatus;
  reviewerComment?: string;
};

const mockQueueSeed: ApprovalQueueItem[] = [
  { id: 'APR-130-01', title: 'สมัครสมาชิกเกษตรกร', applicantName: 'สมชาย ใจดี', submittedAt: '2026-05-10T07:10:00.000Z', domain: 'member_onboarding', status: 'submitted' },
  { id: 'APR-130-02', title: 'ลงทะเบียนแปลงเพาะปลูก', applicantName: 'วิภา คำดี', submittedAt: '2026-05-10T07:20:00.000Z', domain: 'plot_registration', status: 'under_review' },
  { id: 'APR-130-03', title: 'คำขอตรวจยืนยันไม่เผา', applicantName: 'มนัส ศรีสุข', submittedAt: '2026-05-10T07:40:00.000Z', domain: 'no_burn_verification', status: 'submitted' },
];

export function PendingApprovalQueue() {
  const [items, setItems] = useState(mockQueueSeed);
  const [selectedId, setSelectedId] = useState(mockQueueSeed[0]?.id ?? '');
  const [commentDraft, setCommentDraft] = useState('');

  const selectedItem = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);

  function review(decision: 'approved' | 'rejected' | 'needs_update') {
    if (!selectedItem) return;
    setItems((prev) =>
      prev.map((item) => (item.id === selectedItem.id ? { ...item, status: decision, reviewerComment: commentDraft.trim() || undefined } : item)),
    );
    setCommentDraft('');
  }

  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <h3 style={{ margin: 0 }}>คิวรอตรวจสอบคำขอ (MVP Mock)</h3>
      <p style={{ marginTop: 0, marginBottom: 8 }}>รองรับรายการรออนุมัติ, รีวิวรายละเอียด, อนุมัติ/ไม่อนุมัติ และบันทึกความเห็นผู้ตรวจ</p>

      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setSelectedId(item.id)}
          style={{ textAlign: 'left', background: item.id === selectedId ? 'var(--surface-soft)' : 'var(--surface-default)', border: '1px solid var(--line-soft)', borderRadius: 10, padding: 10 }}
        >
          <strong>{item.title}</strong>
          <p style={{ margin: '4px 0' }}>ผู้ยื่นคำขอ: {item.applicantName}</p>
          <p style={{ margin: '4px 0' }}>เลขอ้างอิง: {item.id}</p>
          <StatusChip status={item.status} />
        </button>
      ))}

      {selectedItem ? (
        <article style={{ border: '1px solid var(--line-soft)', borderRadius: 12, padding: 12, display: 'grid', gap: 10 }}>
          <h4 style={{ margin: 0 }}>รายละเอียดคำขอ</h4>
          <p style={{ margin: 0 }}>ผู้ยื่นคำขอ: {selectedItem.applicantName}</p>
          <p style={{ margin: 0 }}>ส่งคำขอเมื่อ: {new Date(selectedItem.submittedAt).toLocaleString()}</p>
          <PendingApprovalPanel domain={selectedItem.domain} status={selectedItem.status} />
          <label>
            ความเห็นผู้ตรวจ (ไม่บังคับ)
            <textarea rows={3} value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} placeholder="ระบุเหตุผลประกอบการอนุมัติ/ไม่อนุมัติ" />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <UIButton onClick={() => review('approved')}>อนุมัติ</UIButton>
            <UIButton variant="secondary" onClick={() => review('rejected')}>
              ไม่อนุมัติ
            </UIButton>
            <UIButton variant="ghost" onClick={() => review('needs_update')}>
              ขอแก้ไขข้อมูล
            </UIButton>
          </div>
          {selectedItem.reviewerComment ? <p style={{ margin: 0 }}>ความเห็นล่าสุด: {selectedItem.reviewerComment}</p> : null}
        </article>
      ) : null}
    </section>
  );
}

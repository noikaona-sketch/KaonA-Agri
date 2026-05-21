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
  applicantRole?: string;
  submittedAt: string;
  domain: PendingApprovalDomain;
  status: PendingApprovalStatus;
  hasRequiredDocuments?: boolean;
  bankVerified?: boolean;
  reviewerComment?: string;
};

const mockQueueSeed: ApprovalQueueItem[] = [
  {
    id: 'APR-130-01',
    title: 'สมัครสมาชิกเกษตรกร',
    applicantName: 'สมชาย ใจดี',
    applicantRole: 'farmer',
    submittedAt: '2026-05-10T07:10:00.000Z',
    domain: 'member_onboarding',
    status: 'submitted',
    hasRequiredDocuments: true,
    bankVerified: true,
  },
  {
    id: 'APR-130-02',
    title: 'ลงทะเบียนแปลงเพาะปลูก',
    applicantName: 'วิภา คำดี',
    applicantRole: 'team_leader',
    submittedAt: '2026-05-10T07:20:00.000Z',
    domain: 'plot_registration',
    status: 'under_review',
    hasRequiredDocuments: false,
    bankVerified: true,
  },
  {
    id: 'APR-130-03',
    title: 'คำขอตรวจยืนยันไม่เผา',
    applicantName: 'มนัส ศรีสุข',
    submittedAt: '2026-05-10T07:40:00.000Z',
    domain: 'no_burn_verification',
    status: 'needs_update',
    hasRequiredDocuments: true,
    bankVerified: false,
  },
];

type QueueFilter = 'all' | 'ready_to_approve' | 'missing_documents' | 'bank_not_verified' | 'returned_correction_needed';

export function PendingApprovalQueue() {
  const [items, setItems] = useState(mockQueueSeed);
  const [selectedId, setSelectedId] = useState(mockQueueSeed[0]?.id ?? '');
  const [commentDraft, setCommentDraft] = useState('');
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('all');
  const [roleFilter, setRoleFilter] = useState('all_roles');

  const roleOptions = useMemo(() => {
    const roles = new Set(items.map((item) => item.applicantRole).filter((role): role is string => Boolean(role)));
    return ['all_roles', ...Array.from(roles).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filteredItems = useMemo(() => {
    const byFilter = items.filter((item) => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'ready_to_approve') return item.hasRequiredDocuments === true && item.bankVerified === true && item.status !== 'needs_update';
      if (activeFilter === 'missing_documents') return item.hasRequiredDocuments === false;
      if (activeFilter === 'bank_not_verified') return item.bankVerified === false;
      return item.status === 'needs_update' || item.status === 'rejected';
    });

    if (roleFilter === 'all_roles') {
      return byFilter;
    }

    return byFilter.filter((item) => item.applicantRole === roleFilter);
  }, [activeFilter, items, roleFilter]);

  const selectedItem = useMemo(() => filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null, [filteredItems, selectedId]);

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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          สถานะคิว{' '}
          <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as QueueFilter)}>
            <option value="all">all</option>
            <option value="ready_to_approve">ready to approve</option>
            <option value="missing_documents">missing documents</option>
            <option value="bank_not_verified">bank not verified</option>
            <option value="returned_correction_needed">returned / correction needed</option>
          </select>
        </label>
        {roleOptions.length > 1 ? (
          <label>
            Role{' '}
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all_roles">all roles</option>
              {roleOptions
                .filter((option) => option !== 'all_roles')
                .map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
      </div>

      {filteredItems.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => setSelectedId(item.id)}
          style={{ textAlign: 'left', background: item.id === selectedId ? 'var(--surface-soft)' : 'var(--surface-default)', border: '1px solid var(--line-soft)', borderRadius: 10, padding: 10 }}
        >
          <strong>{item.title}</strong>
          <p style={{ margin: '4px 0' }}>ผู้ยื่นคำขอ: {item.applicantName}</p>
          {item.applicantRole ? <p style={{ margin: '4px 0' }}>Role: {item.applicantRole}</p> : null}
          <p style={{ margin: '4px 0' }}>เลขอ้างอิง: {item.id}</p>
          <StatusChip status={item.status} />
        </button>
      ))}

      {filteredItems.length === 0 ? <p style={{ margin: 0 }}>ไม่พบรายการที่ตรงกับตัวกรอง</p> : null}

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

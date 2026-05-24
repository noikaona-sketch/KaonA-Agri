'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type QueueItem = {
  id: string;
  member_id: string;
  status?: string;
  created_at: string;
  roles?: string[];
  member: {
    id: string; full_name: string; phone: string | null;
    citizen_id_masked: string; registration_type: string | null;
    address: string | null; created_at: string;
    status?: string | null;
    bank_verified_status?: string | null;
  } | null;
  missingDocuments?: string[];
};

type QueueFilter = 'all' | 'ready_to_approve' | 'missing_documents' | 'bank_not_verified' | 'returned_correction_needed';

type QueueSummary = {
  pendingApprovals: number;
  readyToApprove: number;
  missingDocuments: number;
  bankNotVerified: number;
  returnedMembers: number;
};

export function AdminApprovalQueue() {
  const [items, setItems]     = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('all');
  const [activeRole, setActiveRole] = useState('all_roles');

  const roleOptions = useMemo(() => {
    const roles = new Set(items.flatMap((item) => item.roles ?? []));
    return ['all_roles', ...Array.from(roles).sort((a, b) => a.localeCompare(b))];
  }, [items]);

  const filteredItems = useMemo(() => {
    const byStatusFilter = items.filter((item) => {
      const missingCount = item.missingDocuments?.length ?? 0;
      const bankNotVerified = item.member?.bank_verified_status !== 'verified';

      if (activeFilter === 'all') return true;
      if (activeFilter === 'ready_to_approve') return missingCount === 0 && !bankNotVerified;
      if (activeFilter === 'missing_documents') return missingCount > 0;
      if (activeFilter === 'bank_not_verified') return bankNotVerified;
      return item.status === 'returned' || item.status === 'needs_update' || item.member?.status === 'returned';
    });

    if (activeRole === 'all_roles') return byStatusFilter;
    return byStatusFilter.filter((item) => (item.roles ?? []).includes(activeRole));
  }, [activeFilter, activeRole, items]);

  async function loadQueue() {
    setLoading(true); setError(null);
    const res = await fetch('/api/admin/members/approvals', { credentials: 'include' });
    const payload = (await res.json()) as { items?: QueueItem[]; summary?: QueueSummary; error?: string };
    if (!res.ok) { setError(payload.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setItems(payload.items ?? []);
    setSummary(payload.summary ?? null);
    setLoading(false);
  }

  useEffect(() => { void loadQueue(); }, []);

  async function review(approvalId: string, memberId: string, decision: 'approved' | 'rejected') {
    if (!window.confirm(decision === 'approved' ? 'อนุมัติสมาชิกนี้?' : 'ไม่อนุมัติสมาชิกนี้?')) return;
    setActingId(approvalId); setNotice(null);
    const res = await fetch('/api/admin/members/approvals', { credentials: 'include', 
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
      {summary && (
        <div style={{ marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <KpiCard label="Pending approvals" value={summary.pendingApprovals} />
          <KpiCard label="Ready to approve" value={summary.readyToApprove} tone="green" />
          <KpiCard label="Missing documents" value={summary.missingDocuments} tone="amber" />
          <KpiCard label="Bank not verified" value={summary.bankNotVerified} tone="orange" />
          <KpiCard label="Returned members" value={summary.returnedMembers} tone="red" />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <label>
          Queue filter{' '}
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
            <select value={activeRole} onChange={(event) => setActiveRole(event.target.value)}>
              <option value="all_roles">all roles</option>
              {roleOptions.filter((role) => role !== 'all_roles').map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ margin: '8px 0 0', fontWeight: 600 }}>{items.length === 0 ? 'ไม่มีคำขอรออนุมัติ' : 'ไม่พบคำขอที่ตรงกับตัวกรอง'}</p>
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
                <th>เอกสารที่ขาด</th>
                <th>วันที่ยื่น</th>
                <th style={{ textAlign: 'center' }}>การดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link href={`/admin/members/${item.member_id}`}
                      style={{ fontWeight: 700, color: '#0d3d1f', textDecoration: 'none' }}>
                      {item.member?.full_name}
                    </Link>
                  </td>
                  <td style={{ color: '#6b7280' }}>{item.member?.phone ?? '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280' }}>
                    {item.member?.citizen_id_masked}
                  </td>
                  <td>
                    <span className="role-pill">
                      {item.member?.registration_type === 'self' ? '🌾 สมัครเอง' :
                       item.member?.registration_type === 'admin_created' ? '⚙️ admin สร้าง' : '—'}
                    </span>
                    {(item.roles?.length ?? 0) > 0 ? (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>
                        Role: {(item.roles ?? []).join(', ')}
                      </div>
                    ) : null}
                  </td>
                  <td style={{ fontSize: 12, color: '#6b7280', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.member?.address ?? '—'}
                  </td>
                  <td>
                    {(item.missingDocuments?.length ?? 0) === 0 ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#1b5e20', background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 999, padding: '3px 8px' }}>
                        ✅ ครบ
                      </span>
                    ) : (
                      <span
                        title={(item.missingDocuments ?? []).join(', ')}
                        style={{ fontSize: 12, fontWeight: 700, color: '#e65100', background: '#fff8e1', border: '1px solid #ffd54f', borderRadius: 999, padding: '3px 8px', cursor: 'help' }}
                      >
                        ⚠️ ขาด {(item.missingDocuments ?? []).length} รายการ
                      </span>
                    )}
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

function KpiCard({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'green' | 'amber' | 'orange' | 'red' }) {
  const toneStyle = tone === 'green'
    ? { border: '#a5d6a7', bg: '#e8f5e9', text: '#1b5e20' }
    : tone === 'amber'
      ? { border: '#ffd54f', bg: '#fff8e1', text: '#e65100' }
      : tone === 'orange'
        ? { border: '#ffcc80', bg: '#fff3e0', text: '#ef6c00' }
        : tone === 'red'
          ? { border: '#ef9a9a', bg: '#ffebee', text: '#b71c1c' }
          : { border: '#d1d5db', bg: '#f9fafb', text: '#111827' };

  return (
    <div style={{ border: `1px solid ${toneStyle.border}`, background: toneStyle.bg, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1, color: toneStyle.text }}>{value}</div>
    </div>
  );
}

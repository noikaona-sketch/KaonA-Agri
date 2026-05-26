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
    rejection_reason?: string | null;
  } | null;
  missingDocuments?: string[];
};

type QueueFilter = 'all' | 'ready_to_approve' | 'missing_documents' | 'bank_not_verified' | 'returned_correction_needed' | 'cancelled_waiting_reapply';
const REGISTRATION_TYPE_LABEL: Record<string, string> = {
  self: '🌾 สมัครเอง',
  admin_created: '⚙️ Admin สร้าง',
  admin_import: '📥 Admin Import',
};

const MEMBER_STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: '⏳ รออนุมัติ', bg: '#fff8e1', color: '#e65100' },
  pending_approval: { label: '🕒 รอตรวจสอบ', bg: '#fff8e1', color: '#e65100' },
  returned: { label: '↩️ ตีกลับแก้ไข', bg: '#e3f2fd', color: '#1565c0' },
  rejected: { label: '❌ ไม่อนุมัติ', bg: '#ffebee', color: '#c62828' },
  approved: { label: '✅ อนุมัติแล้ว', bg: '#e8f5e9', color: '#2e7d32' },
  suspended: { label: '⛔ ระงับใช้งาน', bg: '#f5f5f5', color: '#616161' },
};

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
      if (activeFilter === 'cancelled_waiting_reapply') return item.member?.status === 'rejected' && item.member?.rejection_reason === 'cancelled_by_admin';
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
    let reason = '';
    if (decision === 'rejected') {
      const input = window.prompt('ระบุเหตุผลที่ไม่อนุมัติ (จำเป็น):');
      if (input === null) return; // กด cancel
      if (!input.trim()) { setError('กรุณาระบุเหตุผล'); return; }
      reason = input.trim();
    } else {
      if (!window.confirm('อนุมัติสมาชิกนี้?')) return;
    }
    setActingId(approvalId); setNotice(null); setError(null);
    const res = await fetch('/api/admin/members/approvals', { credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, approvalId, decision, reason }),
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

      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, alignItems:'center', background:'#f8fafc', padding:'12px 14px', borderRadius:10, border:'1px solid #e2e8f0' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          <span style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>กรองตามสถานะ</span>
          <select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value as QueueFilter)}
            style={{ padding:'7px 32px 7px 10px', borderRadius:8, border:'1px solid #cbd5e1', background:'#fff', fontSize:13, color:'#1e293b', fontWeight:500, cursor:'pointer', appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center', minWidth:200 }}>
            <option value="all">📋 ทั้งหมด</option>
            <option value="ready_to_approve">✅ พร้อมอนุมัติ</option>
            <option value="missing_documents">📄 ขาดเอกสาร</option>
            <option value="bank_not_verified">🏦 ยังไม่ verify ธนาคาร</option>
            <option value="returned_correction_needed">↩️ ตีกลับ / รอแก้ไข</option>
            <option value="cancelled_waiting_reapply">🔄 ยกเลิกแล้ว / รอสมัครใหม่</option>
          </select>
        </div>
        {roleOptions.length > 1 && (
          <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
            <span style={{ fontSize:11, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>กรองตาม Role</span>
            <select value={activeRole} onChange={(e) => setActiveRole(e.target.value)}
              style={{ padding:'7px 32px 7px 10px', borderRadius:8, border:'1px solid #cbd5e1', background:'#fff', fontSize:13, color:'#1e293b', fontWeight:500, cursor:'pointer', appearance:'none', backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center', minWidth:160 }}>
              <option value="all_roles">👥 ทุก Role</option>
              {roleOptions.filter(r => r !== 'all_roles').map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
        )}
        <div style={{ marginLeft:'auto', fontSize:12, color:'#64748b', alignSelf:'flex-end', paddingBottom:2 }}>
          แสดง {filteredItems?.length ?? 0} รายการ
        </div>
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
                      {item.member?.registration_type ? (REGISTRATION_TYPE_LABEL[item.member.registration_type] ?? `🧩 ${item.member.registration_type}`) : '—'}
                    </span>
                    {(item.roles?.length ?? 0) > 0 ? (
                      <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>
                        Role: {(item.roles ?? []).join(', ')}
                      </div>
                    ) : null}
                    {item.member?.status && (
                      <div style={{ marginTop: 4 }}>
                        {(() => {
                          const st = item.member?.status === 'rejected' && item.member?.rejection_reason === 'cancelled_by_admin'
                            ? { label: '🔄 ยกเลิกแล้ว / รอสมัครใหม่', bg: '#eef2ff', color: '#4338ca' }
                            : (MEMBER_STATUS_LABEL[item.member.status] ?? { label: 'ไม่ระบุสถานะ', bg: '#f3f4f6', color: '#374151' });
                          return <span style={{ fontSize: 11, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 999, padding: '2px 8px' }}>{st.label}</span>;
                        })()}
                      </div>
                    )}
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
                    <div style={{ display:'flex', gap:6, justifyContent:'flex-end', flexWrap:'wrap', alignItems:'center' }}>
                      {/* badge ยกเลิกแล้ว / รอสมัครใหม่ */}
                      {item.member?.rejection_reason === 'cancelled_by_admin' && (
                        <span style={{ fontSize:11, padding:'3px 8px', borderRadius:6, background:'#EEF2FF', color:'#4F46E5', fontWeight:600, whiteSpace:'nowrap' }}>
                          🔄 ยกเลิกแล้ว / รอสมัครใหม่
                        </span>
                      )}
                      <button
                        onClick={() => review(item.id, item.member_id, 'approved')}
                        disabled={actingId !== null}
                        style={{ display:'flex', alignItems:'center', gap:5, padding:'6px 14px', borderRadius:8, border:'none', background:'#16a34a', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', opacity:actingId?0.6:1, whiteSpace:'nowrap' }}>
                        {actingId===item.id ? '⏳' : '✅'} อนุมัติ
                      </button>
                      <Link href={`/admin/members/${item.member_id}`}
                        style={{ display:'flex', alignItems:'center', gap:4, padding:'6px 14px', borderRadius:8, border:'1px solid #d1d5db', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}>
                        🔍 ดูข้อมูล / ปฏิเสธ
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

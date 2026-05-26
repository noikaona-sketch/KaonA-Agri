'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ErrorState }   from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type MemberRow = {
  member_id: string; full_name: string; phone: string | null;
  status: string; roles: string[]; effective_role: string | null; created_at: string;
  bank_verified_status: string;
  has_plots: boolean; has_bank: boolean;
  readyToApprove: boolean; missingFields: string[]; readinessReason: string[];
};

const ROLE_ICONS: Record<string, string> = {
  farmer: '🌾', truck_owner: '🚛', inspector: '🔍', staff: '👷', leader: '👥', admin: '⚙️',
};

const STATUS_TABS = [
  { key: '',           label: 'ทั้งหมด' },
  { key: 'pending_approval', label: '🕒 Pending Approval' },
  { key: 'pending',    label: '⏳ รออนุมัติ' },
  { key: 'returned',   label: '↩️ ตีกลับ' },
  { key: 'approved',   label: '✅ อนุมัติแล้ว' },
  { key: 'rejected',   label: '❌ ไม่อนุมัติ' },
  { key: 'suspended',  label: '⛔ ระงับ' },
] as const;

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  approved:  { label: '✅ อนุมัติ',    color: '#1b5e20', bg: '#e8f5e9' },
  pending_approval: { label: '🕒 Pending Approval', color: '#e65100', bg: '#fff8e1' },
  pending:   { label: '⏳ รออนุมัติ',  color: '#e65100', bg: '#fff8e1' },
  returned:  { label: '↩️ ตีกลับ',    color: '#1565c0', bg: '#e3f2fd' },
  rejected:  { label: '❌ ไม่อนุมัติ', color: '#c62828', bg: '#ffebee' },
  suspended: { label: '⛔ ระงับ',       color: '#616161', bg: '#f5f5f5' },
};

function readinessIndicator(m: MemberRow) {
  if (m.readyToApprove) return <span style={{ fontSize: 12, color: '#1b5e20', fontWeight: 600 }}>✅ พร้อม</span>;
  return <span style={{ fontSize: 12, color: '#e65100' }} title={`ขาด: ${(m.missingFields ?? []).join(', ')}`}>⚠️ ยังไม่ครบ</span>;
}

export function AdminMemberList() {
  const [members,      setMembers]      = useState<MemberRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res  = await fetch(`/api/admin/members/list?status=${statusFilter}`);
      const data = (await res.json()) as { members?: MemberRow[]; error?: string };
      if (!res.ok) { setError(data.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
      setMembers(data.members ?? []);
      setLoading(false);
    })();
  }, [statusFilter]);

  const filtered = members.filter((m) =>
    !search ||
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.phone ?? '').includes(search)
  );

  return (
    <div>
      {/* Status Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap', borderBottom: '2px solid #e8ede8', paddingBottom: 0 }}>
        {STATUS_TABS.map((t) => (
          <button key={t.key} onClick={() => setStatusFilter(t.key)}
            style={{ padding: '8px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: statusFilter === t.key ? 700 : 400, background: 'none', color: statusFilter === t.key ? '#1b5e20' : '#6b7280', borderBottom: statusFilter === t.key ? '2.5px solid #1b5e20' : '2.5px solid transparent', marginBottom: -2 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <input className="admin-search" placeholder="🔍 ค้นหาชื่อหรือเบอร์โทร…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1 }} />
        <Link href="/admin/members/approvals" className="admin-btn admin-btn--primary">✅ คิวอนุมัติ</Link>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>{filtered.length} รายการ</p>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error   && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>เบอร์โทร</th>
                <th>บทบาท</th>
                <th>สถานะ</th>
                <th>ความพร้อม</th>
                <th>วันที่สมัคร</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>ไม่พบสมาชิก</td></tr>
              )}
              {filtered.map((m) => {
                const sb = STATUS_BADGE[m.status] ?? { label: m.status, color: '#333', bg: '#f5f5f5' };
                return (
                  <tr key={m.member_id}>
                    <td style={{ fontWeight: 600 }}>{m.full_name}</td>
                    <td style={{ color: '#6b7280' }}>{m.phone ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {(m.roles ?? []).map((r) => (
                          <span key={r} className="role-pill">{ROLE_ICONS[r] ?? ''} {r}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 12, background: sb.bg, color: sb.color }}>
                        {sb.label}
                      </span>
                    </td>
                    <td>{readinessIndicator(m)}</td>
                    <td style={{ color: '#6b7280', whiteSpace: 'nowrap', fontSize: 13 }}>
                      {new Date(m.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <Link href={`/admin/members/${m.member_id}`} className="admin-btn admin-btn--ghost">
                        ดูรายละเอียด →
                      </Link>
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

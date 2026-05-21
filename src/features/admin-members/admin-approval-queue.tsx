'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type QueueItem = {
  id: string;
  member_id: string;
  created_at: string;
  member: {
    id: string; full_name: string; phone: string | null;
    citizen_id_masked: string; registration_type: string | null;
    address: string | null; created_at: string;
    bank_verified_status?: string | null;
    status?: string | null;
    district?: string | null;
    province?: string | null;
  } | null;
  roles?: string[];
  missingDocuments?: string[];
};

type QueueFilter = 'all' | 'ready' | 'missing_docs' | 'bank_not_verified' | 'returned';

export function AdminApprovalQueue() {
  const [items, setItems]     = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<QueueFilter>('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');

  async function loadQueue() {
    setLoading(true); setError(null);
    const res = await fetch('/api/admin/members/approvals');
    const payload = (await res.json()) as { items?: QueueItem[]; error?: string };
    if (!res.ok) { setError(payload.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setItems(payload.items ?? []);
    setLoading(false);
  }

  useEffect(() => { void loadQueue(); }, []);

  const roleOptions = useMemo(() => {
    const roles = new Set<string>();
    for (const item of items) {
      for (const role of item.roles ?? []) roles.add(role);
    }
    return ['all', ...Array.from(roles).sort()];
  }, [items]);

  const areaOptions = useMemo(() => {
    const areas = new Set<string>();
    for (const item of items) {
      const p = item.member?.province?.trim();
      const d = item.member?.district?.trim();
      if (p || d) areas.add([p, d].filter(Boolean).join(' / '));
    }
    return ['all', ...Array.from(areas).sort((a, b) => a.localeCompare(b, 'th'))];
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const missingCount = item.missingDocuments?.length ?? 0;
      const bankVerified = item.member?.bank_verified_status === 'verified';
      const isReady = missingCount === 0 && bankVerified;
      const isReturned = item.member?.status === 'returned';

      const matchMain =
        activeFilter === 'all' ||
        (activeFilter === 'ready' && isReady) ||
        (activeFilter === 'missing_docs' && missingCount > 0) ||
        (activeFilter === 'bank_not_verified' && !bankVerified) ||
        (activeFilter === 'returned' && isReturned);

      const matchRole = roleFilter === 'all' || (item.roles ?? []).includes(roleFilter);
      const itemArea = [item.member?.province?.trim(), item.member?.district?.trim()].filter(Boolean).join(' / ');
      const matchArea = areaFilter === 'all' || itemArea === areaFilter;

      return matchMain && matchRole && matchArea;
    });
  }, [activeFilter, areaFilter, items, roleFilter]);

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

      <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {[
            ['all', 'ทั้งหมด'],
            ['ready', 'พร้อมอนุมัติ'],
            ['missing_docs', 'เอกสารไม่ครบ'],
            ['bank_not_verified', 'bank ยังไม่ verify'],
            ['returned', 'ตีกลับ / แก้ไข'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveFilter(value as QueueFilter)}
              className="admin-btn"
              style={{
                padding: '6px 10px',
                fontSize: 13,
                border: activeFilter === value ? '1px solid #2e7d32' : '1px solid #d1d5db',
                background: activeFilter === value ? '#e8f5e9' : '#fff',
                color: activeFilter === value ? '#1b5e20' : '#374151',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            role:
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="admin-select" style={{ minWidth: 170 }}>
              <option value="all">ทุก role</option>
              {roleOptions.filter((v) => v !== 'all').map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            จังหวัด/อำเภอ:
            <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} className="admin-select" style={{ minWidth: 200 }}>
              <option value="all">ทุกพื้นที่</option>
              {areaOptions.filter((v) => v !== 'all').map((area) => (
                <option key={area} value={area}>{area}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <p style={{ margin: '8px 0 0', fontWeight: 600 }}>ไม่พบรายการตามตัวกรอง</p>
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

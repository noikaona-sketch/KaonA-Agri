'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type MemberRow = {
  member_id: string;
  full_name: string;
  phone: string | null;
  status: string;
  roles: string[];
  effective_role: string | null;
  created_at: string;
};

const ROLE_ICONS: Record<string, string> = {
  farmer: '🌾', truck_owner: '🚛', inspector: '🔍',
  staff: '👷', leader: '👥', admin: '⚙️',
};

export function AdminMemberList() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();

      // ลอง RPC ก่อน
      const { data: rpcData, error: rpcError } = await supabase.rpc('list_members_with_roles', {
        p_status: statusFilter || null,
        p_limit: 200,
      });

      if (!rpcError) {
        setMembers((rpcData as MemberRow[]) ?? []);
        setLoading(false);
        return;
      }

      // fallback: query ตรงถ้า RPC ยังไม่มี (migration ยังไม่ run ครบ)
      let q = supabase.from('members')
        .select('id, full_name, phone, status, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data: rawData, error: rawError } = await q;

      if (rawError) { setError(rawError.message); setLoading(false); return; }

      // normalize ให้ตรง MemberRow type
      const normalized = ((rawData ?? []) as Array<Record<string, unknown>>).map((m) => ({
        member_id: m.id as string,
        full_name: m.full_name as string,
        phone: m.phone as string | null,
        status: m.status as string,
        roles: [] as string[],
        effective_role: null,
        created_at: m.created_at as string,
      }));
      setMembers(normalized);
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
      <div className="admin-filter-bar">
        <input className="admin-search" placeholder="🔍  ค้นหาชื่อหรือเบอร์โทร…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="pending">⏳ รออนุมัติ</option>
          <option value="approved">✅ อนุมัติแล้ว</option>
          <option value="rejected">❌ ไม่อนุมัติ</option>
          <option value="suspended">⛔ ระงับ</option>
        </select>
        <Link href="/admin/members/approvals" className="admin-btn admin-btn--primary">
          ✅ คิวอนุมัติ
        </Link>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
        {filtered.length} รายการ
      </p>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ชื่อ-นามสกุล</th>
                <th>เบอร์โทร</th>
                <th>บทบาท</th>
                <th>สถานะ</th>
                <th>วันที่สมัคร</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: '32px' }}>ไม่พบสมาชิก</td></tr>
              )}
              {filtered.map((m) => (
                <tr key={m.member_id}>
                  <td style={{ fontWeight: 600 }}>{m.full_name}</td>
                  <td style={{ color: '#6b7280' }}>{m.phone ?? '—'}</td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                      {(m.roles as string[]).map((r) => (
                        <span key={r} className="role-pill">{ROLE_ICONS[r] ?? ''} {r}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-badge--${m.status}`}>
                      {m.status === 'approved' ? '✅ อนุมัติ' :
                       m.status === 'pending'  ? '⏳ รออนุมัติ' :
                       m.status === 'rejected' ? '❌ ไม่อนุมัติ' : '⛔ ระงับ'}
                    </span>
                  </td>
                  <td style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {new Date(m.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td>
                    <Link href={`/admin/members/${m.member_id}`} className="admin-btn admin-btn--ghost">
                      ดูรายละเอียด →
                    </Link>
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

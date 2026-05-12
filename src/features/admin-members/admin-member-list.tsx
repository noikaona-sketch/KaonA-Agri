'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type MemberRow = {
  member_id: string;
  full_name: string;
  phone: string | null;
  status: string;
  roles: string[];
  effective_role: string | null;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  approved: '#e8f5e9', pending: '#fff8e1', rejected: '#ffebee', suspended: '#f5f5f5',
};
const STATUS_LABELS: Record<string, string> = {
  approved: '✅ อนุมัติ', pending: '⏳ รออนุมัติ', rejected: '❌ ไม่อนุมัติ', suspended: '⛔ ระงับ',
};
const ROLE_ICONS: Record<string, string> = {
  farmer: '🌾', truck_owner: '🚛', inspector: '🔍', staff: '👷', leader: '👥', admin: '⚙️',
};

export function AdminMemberList() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [search, setSearch]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcError } = await supabase.rpc('list_members_with_roles', {
        p_status: statusFilter || null,
        p_limit: 100,
      });
      if (rpcError) { setError(rpcError.message); } else { setMembers((data as MemberRow[]) ?? []); }
      setLoading(false);
    })();
  }, [statusFilter]);

  const filtered = members.filter((m) =>
    !search || m.full_name.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search)
  );

  return (
    <div className="mobile-stack">
      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
        <input className="reg-input" placeholder="ค้นหาชื่อหรือเบอร์…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="reg-input" style={{ width: 'auto' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทั้งหมด</option>
          <option value="pending">รออนุมัติ</option>
          <option value="approved">อนุมัติ</option>
          <option value="rejected">ไม่อนุมัติ</option>
          <option value="suspended">ระงับ</option>
        </select>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
        {filtered.length} รายการ
      </p>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {filtered.map((m) => (
        <article key={m.member_id} className="kaona-card" style={{ background: STATUS_COLORS[m.status] ?? '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{m.full_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                {m.phone ?? '-'} · {new Date(m.created_at).toLocaleDateString('th-TH')}
              </p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                {(m.roles as string[]).map((r) => (
                  <span key={r} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#fff', border: '1px solid var(--border)' }}>
                    {ROLE_ICONS[r] ?? ''} {r}
                  </span>
                ))}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {STATUS_LABELS[m.status] ?? m.status}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <Link href={`/admin/members/${m.member_id}`}>
              <UIButton variant="secondary" style={{ fontSize: 13, padding: '6px 12px', minHeight: 36 }}>
                ดูรายละเอียด
              </UIButton>
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}

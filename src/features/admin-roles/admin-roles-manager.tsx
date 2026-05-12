'use client';

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
};

const ALL_ROLES = ['farmer', 'truck_owner', 'inspector', 'staff', 'leader', 'admin'] as const;
type AppRole = typeof ALL_ROLES[number];

const ROLE_LABELS: Record<AppRole, string> = {
  farmer: '🌾 สมาชิกเกษตรกร',
  truck_owner: '🚛 ทีมบริการ',
  inspector: '🔍 ผู้ตรวจสอบ',
  staff: '👷 เจ้าหน้าที่',
  leader: '👥 หัวหน้ากลุ่ม',
  admin: '⚙️ แอดมิน',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'รออนุมัติ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', suspended: 'ระงับ',
};

export function AdminRolesManager() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc('list_members_with_roles', { p_limit: 100 });
    if (rpcError) { setError(rpcError.message); } else { setMembers((data as MemberRow[]) ?? []); }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function addRole(memberId: string, role: AppRole) {
    setActing(`${memberId}-${role}`);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcError } = await supabase.rpc('admin_add_member_role', {
      p_member_id: memberId, p_role: role, p_is_primary: false,
    });
    setActing(null);
    if (rpcError) { setError(rpcError.message); return; }
    setNotice(`เพิ่ม ${ROLE_LABELS[role]} ให้แล้ว`);
    await load();
  }

  async function removeRole(memberId: string, role: AppRole) {
    if (!window.confirm(`ลบ role "${ROLE_LABELS[role]}" จากสมาชิกนี้?`)) return;
    setActing(`${memberId}-${role}-remove`);
    setNotice(null);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcError } = await supabase.rpc('admin_remove_member_role', {
      p_member_id: memberId, p_role: role,
    });
    setActing(null);
    if (rpcError) { setError(rpcError.message); return; }
    setNotice('ลบ role แล้ว');
    await load();
  }

  const filtered = members.filter((m) =>
    !search || m.full_name.toLowerCase().includes(search.toLowerCase()) || m.phone?.includes(search)
  );

  if (loading) return <LoadingState label="กำลังโหลดรายชื่อสมาชิก..." />;

  return (
    <div className="mobile-stack">
      <input className="reg-input" placeholder="ค้นหาชื่อหรือเบอร์โทร…" value={search} onChange={(e) => setSearch(e.target.value)} />

      {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}
      {notice && <p style={{ margin: 0, color: 'var(--primary)', fontWeight: 600, fontSize: 14 }}>✅ {notice}</p>}

      {filtered.length === 0 && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>ไม่พบสมาชิก</p>}

      {filtered.map((m) => (
        <article key={m.member_id} className="kaona-card">
          <div className="kaona-card__header">
            <div className="kaona-card__heading">
              <p className="kaona-card__title">{m.full_name}</p>
              <p className="kaona-card__subtitle">{m.phone ?? '-'} · {STATUS_LABELS[m.status] ?? m.status}</p>
            </div>
          </div>

          {/* roles ที่มีอยู่ */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {(m.roles as AppRole[]).map((role) => (
              <span key={role} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: '#e8f5e9', fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>
                {ROLE_LABELS[role] ?? role}
                <button
                  onClick={() => removeRole(m.member_id, role)}
                  disabled={acting !== null}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0, fontSize: 14, lineHeight: 1 }}
                  aria-label={`ลบ ${role}`}
                >×</button>
              </span>
            ))}
          </div>

          {/* เพิ่ม role */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALL_ROLES.filter((r) => !(m.roles as string[]).includes(r)).map((role) => (
              <UIButton
                key={role}
                variant="secondary"
                onClick={() => addRole(m.member_id, role)}
                disabled={acting !== null}
                loading={acting === `${m.member_id}-${role}`}
                style={{ fontSize: 12, padding: '4px 10px', minHeight: 32 }}
              >
                + {ROLE_LABELS[role]}
              </UIButton>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}

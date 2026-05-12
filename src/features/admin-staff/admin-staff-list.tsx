'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type AdminUserRow = {
  id: string;
  email: string;
  full_name: string;
  department: string;
  status: string;
  created_at: string;
};

const DEPT_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'แอดมิน', sales: 'ฝ่ายขาย',
  accounting: 'บัญชี', finance: 'การเงิน', field: 'ภาคสนาม', stock: 'สต๊อก',
};
const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ รออนุมัติ', approved: '✅ อนุมัติ', suspended: '⛔ ระงับ',
};

export function AdminStaffList() {
  const [staff, setStaff]     = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [notice, setNotice]   = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: err } = await supabase
      .from('admin_users')
      .select('id, email, full_name, department, status, created_at')
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); } else { setStaff((data as AdminUserRow[]) ?? []); }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function updateStatus(id: string, status: 'approved' | 'suspended') {
    if (!window.confirm(status === 'approved' ? 'อนุมัติบัญชีนี้?' : 'ระงับบัญชีนี้?')) return;
    setActing(id);
    const supabase = createSupabaseBrowserClient();
    const { error: err } = await supabase.from('admin_users').update({ status }).eq('id', id);
    setActing(null);
    if (err) { setError(err.message); return; }
    setNotice(status === 'approved' ? '✅ อนุมัติแล้ว' : '⛔ ระงับแล้ว');
    await load();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error) return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  return (
    <div className="mobile-stack">
      {notice && <p style={{ margin: 0, fontWeight: 600, color: 'var(--primary)' }}>{notice}</p>}
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{staff.length} บัญชี</p>

      {staff.map((s) => (
        <article key={s.id} className="kaona-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700 }}>{s.full_name}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>{s.email}</p>
              <p style={{ margin: '2px 0 0', fontSize: 13 }}>
                🏢 {DEPT_LABELS[s.department] ?? s.department}
              </p>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {STATUS_LABELS[s.status] ?? s.status}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            {s.status === 'pending' && (
              <UIButton onClick={() => updateStatus(s.id, 'approved')} loading={acting === s.id} disabled={acting !== null} style={{ fontSize: 13, minHeight: 36 }}>
                ✅ อนุมัติ
              </UIButton>
            )}
            {s.status === 'approved' && (
              <UIButton variant="secondary" onClick={() => updateStatus(s.id, 'suspended')} loading={acting === s.id} disabled={acting !== null} style={{ fontSize: 13, minHeight: 36 }}>
                ⛔ ระงับ
              </UIButton>
            )}
            {s.status === 'suspended' && (
              <UIButton variant="ghost" onClick={() => updateStatus(s.id, 'approved')} loading={acting === s.id} disabled={acting !== null} style={{ fontSize: 13, minHeight: 36 }}>
                ✅ คืนสิทธิ์
              </UIButton>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

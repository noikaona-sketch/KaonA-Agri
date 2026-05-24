'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';
import { ALL_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS, AdminRole, AdminPermission } from '@/shared/auth/admin-permissions';

type PermRow = { id: string; admin_role: string; permission: string; granted: boolean };

const ROLES: AdminRole[] = [
  'super_admin','member_admin','field_admin','market_admin',
  'service_admin','seed_admin','finance_admin','readonly_admin',
];

const ROLE_LABEL: Record<string, string> = {
  super_admin:   '⚙️ Super Admin',
  member_admin:  '👥 Member Admin',
  field_admin:   '🔍 Field Admin',
  market_admin:  '💰 Market Admin',
  service_admin: '🚛 Service Admin',
  seed_admin:    '🌽 Seed Admin',
  finance_admin: '💳 Finance Admin',
  readonly_admin:'👁️ Readonly',
};

const PERM_LABEL: Record<string, string> = {
  'members.read':        '👥 สมาชิก — ดู',
  'members.write':       '👥 สมาชิก — แก้ไข',
  'members.approve':     '👥 สมาชิก — อนุมัติ',
  'members.import':      '👥 สมาชิก — Import',
  'market_prices.read':  '💰 ราคา — ดู',
  'market_prices.write': '💰 ราคา — แก้ไข',
  'field.read':          '🔍 ภาคสนาม — ดู',
  'field.write':         '🔍 ภาคสนาม — แก้ไข',
  'service.read':        '🚛 บริการ — ดู',
  'service.write':       '🚛 บริการ — แก้ไข',
  'seed.read':           '🌽 เมล็ด — ดู',
  'seed.write':          '🌽 เมล็ด — แก้ไข',
  'finance.read':        '💳 การเงิน — ดู',
  'finance.write':       '💳 การเงิน — แก้ไข',
  'reports.read':        '📊 รายงาน — ดู',
  'admin_users.manage':  '⚙️ จัดการเจ้าหน้าที่',
};

export function AdminPermissionMatrix() {
  const [rows,    setRows]    = useState<PermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState<string | null>(null);
  const [notice,  setNotice]  = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/role-permissions', { credentials: 'include' });
    if (res.ok) {
      const d = (await res.json()) as { permissions?: PermRow[] };
      setRows(d.permissions ?? []);
    }
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function isGranted(role: string, perm: string): boolean {
    const row = rows.find((r) => r.admin_role === role && r.permission === perm);
    if (row) return row.granted;
    // super_admin always all
    if (role === 'super_admin') return true;
    // fallback to config default
    return (ROLE_DEFAULT_PERMISSIONS[role as AdminRole] ?? []).includes(perm as AdminPermission);
  }

  async function toggle(role: string, perm: string, current: boolean) {
    if (role === 'super_admin') return; // super_admin cannot be restricted
    const key = `${role}:${perm}`;
    setSaving(key); setNotice(null);
    const res = await fetch('/api/admin/role-permissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ admin_role: role, permission: perm, granted: !current }),
    });
    if (res.ok) {
      setRows((prev) => {
        const exists = prev.find((r) => r.admin_role === role && r.permission === perm);
        if (exists) return prev.map((r) => r.admin_role === role && r.permission === perm ? { ...r, granted: !current } : r);
        return [...prev, { id: key, admin_role: role, permission: perm, granted: !current }];
      });
      setNotice(`✅ อัปเดต ${ROLE_LABEL[role]} — ${PERM_LABEL[perm] ?? perm}`);
    }
    setSaving(null);
  }

  if (loading) return <LoadingState label="กำลังโหลด permission matrix…" />;

  return (
    <div>
      {notice && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontWeight: 600, color: '#1b5e20', fontSize: 13 }}>
          {notice}
        </div>
      )}

      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
        คลิก ✅/❌ เพื่อเปิด/ปิดสิทธิ์ — Super Admin มีสิทธิ์ทั้งหมดเสมอ
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 12px', background: '#f7faf7', borderBottom: '2px solid #c8e6c9', minWidth: 200, position: 'sticky', left: 0 }}>
                สิทธิ์
              </th>
              {ROLES.map((r) => (
                <th key={r} style={{ padding: '8px 10px', background: '#f7faf7', borderBottom: '2px solid #c8e6c9', whiteSpace: 'nowrap', textAlign: 'center', fontSize: 12 }}>
                  {ROLE_LABEL[r]}
                  {r === 'super_admin' && <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>ล็อก</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((perm, i) => (
              <tr key={perm} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '8px 12px', fontWeight: 500, color: '#374151', borderBottom: '1px solid #f0f0f0', position: 'sticky', left: 0, background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {PERM_LABEL[perm] ?? perm}
                </td>
                {ROLES.map((role) => {
                  const granted = isGranted(role, perm);
                  const key     = `${role}:${perm}`;
                  const busy    = saving === key;
                  const locked  = role === 'super_admin';
                  return (
                    <td key={role} style={{ textAlign: 'center', padding: '6px 10px', borderBottom: '1px solid #f0f0f0' }}>
                      <button
                        onClick={() => !locked && !busy && void toggle(role, perm, granted)}
                        disabled={locked || busy}
                        style={{ fontSize: 18, background: 'none', border: 'none', cursor: locked ? 'default' : 'pointer', opacity: busy ? 0.5 : 1 }}
                        title={locked ? 'Super Admin ไม่สามารถจำกัดสิทธิ์ได้' : (granted ? 'คลิกเพื่อปิดสิทธิ์' : 'คลิกเพื่อเปิดสิทธิ์')}
                      >
                        {granted ? '✅' : '❌'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

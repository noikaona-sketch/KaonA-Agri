'use client';

import { useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminApprovalQueue } from '@/features/admin-members/admin-approval-queue';
import { AdminMemberList } from '@/features/admin-members/admin-member-list';
import { AdminRolesManager } from '@/features/admin-roles/admin-roles-manager';
import { AdminGroups } from '@/features/admin-groups/admin-groups';
import { AdminCreatePin } from '@/features/admin-invites/admin-create-pin';

type Tab = 'approvals' | 'list' | 'roles' | 'groups' | 'pin';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'approvals', icon: '✅', label: 'คิวอนุมัติ' },
  { key: 'list',      icon: '👥', label: 'สมาชิกทั้งหมด' },
  { key: 'roles',     icon: '🏷️', label: 'Role' },
  { key: 'groups',    icon: '🗂️', label: 'กลุ่ม' },
  { key: 'pin',       icon: '🔑', label: 'สร้าง PIN' },
];

export default function AdminMembersPage() {
  const [tab, setTab] = useState<Tab>('approvals');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} ${cur.label}`} subtitle="จัดการสมาชิก สิทธิ์ กลุ่ม และ PIN">
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'approvals' && <AdminApprovalQueue />}
      {tab === 'list'      && <AdminMemberList />}
      {tab === 'roles'     && <AdminRolesManager />}
      {tab === 'groups'    && <AdminGroups />}
      {tab === 'pin'       && <AdminCreatePin />}
    </AdminWebShell>
  );
}

'use client';

import { useState } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminApprovalQueue } from '@/features/admin-members/admin-approval-queue';
import { AdminMemberList } from '@/features/admin-members/admin-member-list';
import { AdminRolesManager } from '@/features/admin-roles/admin-roles-manager';
import { AdminGroups } from '@/features/admin-groups/admin-groups';
import { AdminCreatePin } from '@/features/admin-invites/admin-create-pin';

type Tab = 'approvals' | 'list' | 'roles' | 'groups' | 'pin' | 'import';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'approvals', icon: '✅', label: 'คิวอนุมัติ' },
  { key: 'list',      icon: '👥', label: 'สมาชิกทั้งหมด' },
  { key: 'roles',     icon: '🏷️', label: 'Role' },
  { key: 'groups',    icon: '🗂️', label: 'กลุ่ม' },
  { key: 'pin',       icon: '🔑', label: 'สร้าง PIN' },
  { key: 'import',    icon: '📥', label: 'Import' },
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
      {tab === 'import'    && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
          <h3 style={{ margin: 0 }}>📥 Import สมาชิกจาก Excel</h3>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            ดาวน์โหลด template แล้วกรอกข้อมูลสมาชิก จากนั้นอัปโหลดเพื่อ preview ก่อน import
          </p>
          <a href="/api/admin/members/import-template" download
            className="admin-btn admin-btn--secondary" style={{ width: 'fit-content' }}>
            📄 ดาวน์โหลด Template (.xlsx)
          </a>
          <div style={{ background: '#fff8e1', borderRadius: 10, padding: '14px 16px', border: '1px solid #ffe082', fontSize: 13 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#e65100' }}>⚠️ กฎสำคัญ</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#6b7280', lineHeight: 2 }}>
              <li>สมาชิกที่ import จะได้สถานะ <strong>pending_approval</strong> เสมอ — ไม่มี auto approve</li>
              <li>เลขบัตรประชาชนจะถูก mask อัตโนมัติ — ไม่เก็บข้อมูลดิบ</li>
              <li>ตรวจสอบ preview ก่อนยืนยัน import ทุกครั้ง</li>
            </ul>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
            * หน้า preview import จะพร้อมในเร็วๆ นี้ (PR5)
          </p>
        </div>
      )}
    </AdminWebShell>
  );
}

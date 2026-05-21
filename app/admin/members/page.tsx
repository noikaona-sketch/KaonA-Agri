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
          <h3 style={{ margin: 0 }}>📥 Import สมาชิกจาก Excel (Scaffold)</h3>
          <p style={{ margin: 0, color: '#6b7280', fontSize: 14 }}>
            ดาวน์โหลด template แล้วกรอกข้อมูลสมาชิก จากนั้นอัปโหลดเพื่อ preview และตรวจสอบความถูกต้องก่อนยืนยัน import
          </p>
          <a href="/api/admin/members/import-template" download
            className="admin-btn admin-btn--secondary" style={{ width: 'fit-content' }}>
            📄 ดาวน์โหลด Template (.xlsx)
          </a>

          <div style={{ border: '1px dashed #cfd8dc', borderRadius: 10, padding: '16px', background: '#fafafa' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>📤 Upload Area (placeholder)</p>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>
              รองรับเฉพาะ scaffold phase 2 — ยังไม่เปิดอัปโหลดจริง และยังไม่มี parser
            </p>
          </div>

          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #e2e8f0' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>🧭 Import Flow Steps</p>
            <ol style={{ margin: 0, paddingLeft: 18, color: '#475569', lineHeight: 1.9, fontSize: 14 }}>
              <li>Upload</li>
              <li>Preview</li>
              <li>Validate</li>
              <li>Confirm Import</li>
            </ol>
          </div>

          <div style={{ background: '#fff8e1', borderRadius: 10, padding: '14px 16px', border: '1px solid #ffe082', fontSize: 13 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#e65100' }}>⚠️ กฎสำคัญ</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#6b7280', lineHeight: 2 }}>
              <li>ไม่มี auto approve</li>
              <li>ต้อง preview ก่อน import ทุกครั้ง</li>
              <li>ต้องตรวจ duplicate detection ก่อน import</li>
            </ul>
          </div>

          <div style={{ borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb', background: '#ffffff' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700 }}>🔌 API Contract Placeholders</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#6b7280', lineHeight: 1.8, fontSize: 13 }}>
              <li><code>POST /api/admin/members/import/preview</code> → not implemented yet</li>
              <li><code>POST /api/admin/members/import/confirm</code> → not implemented yet</li>
            </ul>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9ca3af' }}>
              หมายเหตุ: endpoint ทั้งสองถูกป้องกันด้วยสิทธิ์ <code>members.import</code>
            </p>
          </div>
        </div>
      )}
    </AdminWebShell>
  );
}

'use client';

import { useState } from 'react';
import { AdminStaffList } from '@/features/admin-staff/admin-staff-list';
import { AdminPermissionMatrix } from '@/features/admin-permissions/admin-permission-matrix';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminVisitLogPanel } from '@/features/admin-visit-log/admin-visit-log-panel';

type Tab = 'staff' | 'permissions' | 'visit';

export default function AdminStaffPage() {
  const [tab, setTab] = useState<Tab>('staff');
  return (
    <AdminWebShell title="เจ้าหน้าที่" subtitle="อนุมัติและจัดการบัญชีเจ้าหน้าที่หลังบ้าน">
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid #e8ede8', paddingBottom: 12 }}>
        <button onClick={() => setTab('staff')}
          className={`admin-btn ${tab === 'staff' ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
          style={{ fontSize: 13, padding: '7px 14px' }}>
          👤 รายชื่อเจ้าหน้าที่
        </button>
        <button onClick={() => setTab('permissions')}
          className={`admin-btn ${tab === 'permissions' ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
          style={{ fontSize: 13, padding: '7px 14px' }}>
          🔐 จัดการสิทธิ์
        </button>
      </div>
      {tab === 'staff'       && <AdminStaffList />}
      {tab === 'visit'       && <AdminVisitLogPanel />}
      {tab === 'permissions' && <AdminPermissionMatrix />}
    </AdminWebShell>
  );
}


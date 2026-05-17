'use client';

// AdminPageGuard — ใช้ wrap admin page ที่ต้องการ permission เฉพาะ
// ป้องกัน direct URL access แม้ menu ถูกซ่อนแล้ว
// Server-side enforcement อยู่ใน PR4

import { useEffect, useState } from 'react';
import type { AdminPermission } from '@/shared/auth/admin-permissions';

type AdminMeResponse = {
  authenticated: boolean;
  adminRole?: string;
  permissions?: string[];
};

type Props = {
  requiredPermission: AdminPermission;
  children: React.ReactNode;
};

export function AdminPageGuard({ requiredPermission, children }: Props) {
  const [state, setState] = useState<'loading' | 'allowed' | 'forbidden'>('loading');

  useEffect(() => {
    void fetch('/api/admin/me').then(async (res) => {
      if (!res.ok) { setState('forbidden'); return; }
      const data = (await res.json()) as AdminMeResponse;
      if (!data.authenticated) { setState('forbidden'); return; }
      const perms = data.permissions ?? [];
      setState(perms.includes(requiredPermission) ? 'allowed' : 'forbidden');
    }).catch(() => setState('forbidden'));
  }, [requiredPermission]);

  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200, color: '#9ca3af', fontSize: 14 }}>
        กำลังตรวจสอบสิทธิ์…
      </div>
    );
  }

  if (state === 'forbidden') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 12, padding: 32 }}>
        <span style={{ fontSize: 48 }}>🔒</span>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#374151' }}>ไม่มีสิทธิ์เข้าถึง</p>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280', textAlign: 'center' }}>
          คุณไม่มีสิทธิ์ใช้งานส่วนนี้<br />
          กรุณาติดต่อผู้ดูแลระบบ
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontFamily: 'monospace' }}>
          required: {requiredPermission}
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

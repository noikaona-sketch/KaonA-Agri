'use client';

import { AdminWebShell }    from '@/shared/components/admin-web-shell';
import { AdminApiKeyList }  from '@/features/admin-harvest/admin-api-key-list';

export default function ApiKeysPage() {
  return (
    <AdminWebShell title="🔑 Factory API Keys" subtitle="จัดการ API keys สำหรับระบบโรงงานและเครื่องชั่ง">
      <AdminApiKeyList />
    </AdminWebShell>
  );
}

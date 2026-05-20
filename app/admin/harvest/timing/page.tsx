'use client';

import Link from 'next/link';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { HarvestTimingFlags } from '@/features/admin-harvest/harvest-timing-flags';

export default function HarvestTimingPage() {
  return (
    <AdminWebShell title="⏱️ Harvest Timing Flags" subtitle="Operational warnings for queue, dryer, moisture, and deviation risk">
      <div style={{ marginBottom: 12 }}>
        <Link href="/admin/harvest" className="admin-btn admin-btn--secondary" style={{ fontSize: 13, padding: '7px 14px' }}>
          ← กลับหน้ารถเกี่ยว
        </Link>
      </div>
      <HarvestTimingFlags />
    </AdminWebShell>
  );
}

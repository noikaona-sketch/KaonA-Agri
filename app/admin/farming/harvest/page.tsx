'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Link from 'next/link';

import { HarvestBookingForm } from '@/features/admin-harvest/harvest-booking-form';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { LoadingState } from '@/shared/components/loading-state';

function HarvestContent() {
  const router = useRouter();
  const params = useSearchParams();
  const cycleId = params.get('cycle') ?? undefined;

  return (
    <AdminWebShell title="🚜 นัดรถเกี่ยว" subtitle="เลือกรอบปลูก รถเกี่ยว และวันนัดหมาย">
      <div style={{ marginBottom: 16 }}>
        <Link href="/admin/farming" className="admin-btn admin-btn--secondary">← กลับแผนที่</Link>
      </div>
      <HarvestBookingForm cycleId={cycleId} onCreated={() => router.replace('/admin/farming')} />
    </AdminWebShell>
  );
}

export default function Page() {
  return <Suspense fallback={<LoadingState label="กำลังโหลด…" />}><HarvestContent /></Suspense>;
}

'use client';
import { Suspense } from 'react';
import { HarvestBookingForm } from '@/features/admin-harvest/harvest-booking-form';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return (
    <AdminWebShell title="🚜 สร้างนัดรถเกี่ยว" subtitle="เลือกรอบปลูก รถเกี่ยว และกำหนดวัน">
      <Suspense fallback={<div>กำลังโหลด…</div>}>
        <HarvestBookingForm />
      </Suspense>
    </AdminWebShell>
  );
}

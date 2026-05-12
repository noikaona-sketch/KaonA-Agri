'use client';
import { Suspense } from 'react';
import { NewAppointmentForm } from '@/features/admin-appointments/new-appointment-form';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return (
    <AdminWebShell title="📅 สร้างนัดขายใหม่" subtitle="เลือกรอบปลูก กำหนดปริมาณและวันนัด">
      <Suspense fallback={<div>กำลังโหลด…</div>}>
        <NewAppointmentForm />
      </Suspense>
    </AdminWebShell>
  );
}

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { AppointmentForm } from '@/features/admin-appointments/appointment-form';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { LoadingState } from '@/shared/components/loading-state';

function NewAppointmentContent() {
  const router = useRouter();
  const params = useSearchParams();
  const cycleId = params.get('cycle') ?? undefined;

  return (
    <AdminWebShell title="➕ สร้างนัดขายใหม่" subtitle="เลือกรอบปลูก กำหนดปริมาณ และวันนัด">
      <AppointmentForm
        cycleId={cycleId}
        onCreated={(id) => router.replace(`/admin/appointments/${id}`)}
      />
    </AdminWebShell>
  );
}

export default function Page() {
  return <Suspense fallback={<LoadingState label="กำลังโหลด…" />}><NewAppointmentContent /></Suspense>;
}

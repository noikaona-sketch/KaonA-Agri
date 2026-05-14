'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { RegisterTabs } from '@/features/member-register-tabs/register-tabs';
import { RegisterStatus } from '@/features/member-register-tabs/register-status';
import { RegisterContactAdmin } from '@/features/member-register-tabs/register-contact-admin';
import { RegisterEditInfo } from '@/features/member-register-tabs/register-edit-info';

function RegisterPageContent() {
  const params = useSearchParams();
  const tab = params.get('tab');

  if (tab === 'contact') {
    return (
      <MobileAppShell title="ติดต่อ admin" subtitle="สอบถามข้อมูลและขอความช่วยเหลือ">
        <RegisterContactAdmin />
      </MobileAppShell>
    );
  }

  if (tab === 'edit') {
    return (
      <MobileAppShell title="แก้ไขข้อมูลสมัคร" subtitle="อัปเดตข้อมูลเพื่อรอการอนุมัติ">
        <RegisterEditInfo />
      </MobileAppShell>
    );
  }

  return (
    <MobileAppShell title="สมัครเข้าร่วม KaonA" subtitle="เลือกประเภทการสมัครของคุณ">
      <RegisterTabs />
    </MobileAppShell>
  );
}

function PendingContent() {
  const params = useSearchParams();
  const tab = params.get('tab');

  if (tab === 'contact') {
    return (
      <MobileAppShell title="ติดต่อ admin" subtitle="สอบถามสถานะและขอความช่วยเหลือ">
        <RegisterContactAdmin />
      </MobileAppShell>
    );
  }
  if (tab === 'edit') {
    return (
      <MobileAppShell title="แก้ไขข้อมูลสมัคร" subtitle="อัปเดตข้อมูลก่อนรออนุมัติ">
        <RegisterEditInfo />
      </MobileAppShell>
    );
  }
  return (
    <MobileAppShell title="สถานะการสมัคร" subtitle="ติดตามสถานะคำขอสมัครสมาชิก">
      <RegisterStatus />
    </MobileAppShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <ProtectedRoute
        fallbackNoMember={<RegisterPageContent />}
        fallbackPendingApproval={<PendingContent />}
        fallbackRejected={<PendingContent />}
        fallbackAccessDenied={<PendingContent />}
      >
        <RegisterPageContent />
      </ProtectedRoute>
    </Suspense>
  );
}

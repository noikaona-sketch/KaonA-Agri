'use client';
import { RegistrationRequestForm } from '@/features/registration-vertical-slice';
import { LiffRequiredGuard } from '@/shared/components/liff-required-guard';

export default function ServiceRegisterPage() {
  return (
    <LiffRequiredGuard>
      <RegistrationRequestForm title="ลงทะเบียนผู้ให้บริการ" subtitle="สำหรับทีมบริการและผู้ให้บริการ" type="service_team" />
    </LiffRequiredGuard>
  );
}

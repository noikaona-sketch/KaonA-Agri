'use client';
import { RegistrationRequestForm } from '@/features/registration-vertical-slice';
import { LiffRequiredGuard } from '@/shared/components/liff-required-guard';

export default function FieldRegisterRolePage() {
  return (
    <LiffRequiredGuard>
      <RegistrationRequestForm title="สมัครบทบาทภาคสนาม" subtitle="สำหรับเจ้าหน้าที่ภาคสนาม กดส่งคำขอ" type="field_team" />
    </LiffRequiredGuard>
  );
}

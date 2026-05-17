'use client';
import { RegistrationRequestForm } from '@/features/registration-vertical-slice';
import { LiffRequiredGuard } from '@/shared/components/liff-required-guard';

export default function FieldAssistRegistrationPage() {
  return (
    <LiffRequiredGuard>
      <RegistrationRequestForm title="สมัครงานช่วยลงทะเบียน" subtitle="ช่วยสมัครสมาชิกหรือทีมบริการ" type="field_assist" />
    </LiffRequiredGuard>
  );
}

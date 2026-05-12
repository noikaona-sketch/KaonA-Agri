import { RegistrationRequestForm } from '@/features/registration-vertical-slice';

export default function AdminRegisterRolePage() {
  return <RegistrationRequestForm title="สมัครบทบาทหลังบ้าน" subtitle="สำหรับเจ้าหน้าที่หลังบ้าน กดส่งคำขอ" type="backoffice_role" />;
}

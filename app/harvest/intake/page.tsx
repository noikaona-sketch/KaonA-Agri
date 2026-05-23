'use client';

import { useRouter }          from 'next/navigation';
import { MobileAppShell }    from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }    from '@/shared/components/protected-route';
import { StaffIntakeForm }   from '@/features/staff-intake/intake-form';

function IntakeContent() {
  const router = useRouter();
  return (
    <MobileAppShell title="⚖️ บันทึกรับซื้อ" subtitle="กรอกน้ำหนักและความชื้นจริงจากตาชั่ง">
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <button className="admin-btn admin-btn--secondary" onClick={() => router.back()}
          style={{ alignSelf:'flex-start', fontSize:13, padding:'7px 14px' }}>← กลับ</button>
        <StaffIntakeForm onSuccess={(id) => console.log('[intake] booking completed:', id)} />
      </div>
    </MobileAppShell>
  );
}

export default function StaffIntakePage() {
  return (
    <ProtectedRoute allowedRoles={['staff','admin']}>
      <IntakeContent />
    </ProtectedRoute>
  );
}

'use client';

import { useRouter }              from 'next/navigation';
import { MobileAppShell }         from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }         from '@/shared/components/protected-route';
import { MoistureCalculatorForm } from '@/features/harvest-calculator/moisture-calculator-form';
import { useCurrentMember }       from '@/providers/auth-provider';

function CalculatorContent() {
  const router = useRouter();
  const member = useCurrentMember();
  return (
    <MobileAppShell title="🌽 คำนวณรายได้" subtitle="ประมาณรายได้ตามความชื้นข้าวโพด">
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <button className="admin-btn admin-btn--secondary" onClick={() => router.back()}
          style={{ alignSelf:'flex-start', fontSize:13, padding:'7px 14px' }}>← กลับ</button>
        <MoistureCalculatorForm memberId={member?.member_id} />
      </div>
    </MobileAppShell>
  );
}

export default function HarvestCalculatorPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer','staff','leader','admin']}>
      <CalculatorContent />
    </ProtectedRoute>
  );
}

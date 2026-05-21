'use client';

import { useRouter }                    from 'next/navigation';
import { MobileAppShell }               from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }               from '@/shared/components/protected-route';
import { MoistureCalculatorForm }       from '@/features/harvest-calculator/moisture-calculator-form';

export default function HarvestCalculatorPage() {
  const router = useRouter();
  return (
    <ProtectedRoute allowedRoles={['farmer', 'staff', 'leader', 'admin']}>
      <MobileAppShell title="🌽 คำนวณความคุ้มค่า" subtitle="ขายเลย vs รอให้ความชื้นลดลง">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <button
            className="admin-btn admin-btn--secondary"
            onClick={() => router.back()}
            style={{ alignSelf: 'flex-start', fontSize: 13, padding: '7px 14px' }}>
            ← กลับ
          </button>
          <MoistureCalculatorForm />
        </div>
      </MobileAppShell>
    </ProtectedRoute>
  );
}

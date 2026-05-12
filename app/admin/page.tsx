'use client';

import { AdminOperationalDashboard } from '@/features/admin-operational-dashboard';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import Link from 'next/link';
import { SectionHeader } from '@/shared/components/section-header';

export default function AdminOperationalDashboardPage() {
  return (
    <ProtectedRoute
      allowedRoles={['admin', 'staff']}
      fallbackUnauthenticated={
        <main className="mobile-shell">
          <section className="mobile-shell__card">
            <p className="mobile-shell__kicker">Admin access</p>
            <h1 className="mobile-shell__title">กรุณาเข้าสู่ระบบ</h1>
            <p className="mobile-shell__subtitle">ใช้บัญชีแอดมินเว็บ หรือเข้าใช้งานผ่าน LINE LIFF</p>
            <p>
              <Link href="/admin/login">ไปหน้า Admin Web Login</Link>
            </p>
          </section>
        </main>
      }
    >
      <MobileAppShell title="KaonA Agri" subtitle="Admin / staff workspace" roleBadge="Admin/Staff">
        <SectionHeader title="ภาพรวมงานปฏิบัติการ" subtitle="สรุปคิวงานและสถานะสำหรับแอดมิน/เจ้าหน้าที่" />
        <AdminOperationalDashboard />
      </MobileAppShell>
    </ProtectedRoute>
  );
}

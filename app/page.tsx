'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { useAuth } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

// หน้ารออนุมัติ — แสดงหลังส่งคำขอสมัครแล้ว
function PendingApprovalScreen() {
  return (
    <MobileAppShell title="รอการอนุมัติ" subtitle="คำขอสมัครของคุณอยู่ระหว่างตรวจสอบ">
      <div className="mobile-stack" style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 56 }}>🌱</div>
        <div>
          <h2 style={{ margin: '8px 0 4px', fontSize: 20 }}>ส่งคำขอแล้ว</h2>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
            <StatusChip status="submitted" />
          </div>
        </div>
        <div className="kaona-card" style={{ textAlign: 'left' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>ขั้นตอนถัดไป</p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 14, color: 'var(--text-secondary)', display: 'grid', gap: 6 }}>
            <li>เจ้าหน้าที่รับข้อมูลและตรวจสอบ</li>
            <li>แจ้งผลทาง LINE ภายใน 1-3 วันทำการ</li>
            <li>เมื่ออนุมัติแล้ว เปิด LINE Mini App เข้าใช้งานได้ทันที</li>
          </ul>
        </div>
      </div>
    </MobileAppShell>
  );
}

// redirect ไปหน้าสมัคร
function RedirectToRegister() {
  const router = useRouter();
  useEffect(() => { router.replace('/register'); }, [router]);
  return <LoadingState label="กำลังนำทางไปหน้าสมัคร…" />;
}

// หน้าหลัก — routing ตาม auth status
export default function HomePage() {
  const { status } = useAuth();

  // กำลังโหลด
  if (status === 'loading') {
    return <LoadingState label="กำลังตรวจสอบบัญชี LINE…" />;
  }

  // ยังไม่ได้ login / ไม่มี member record / access denied → ไปสมัคร
  if (
    status === 'unauthenticated' ||
    status === 'no_member' ||
    status === 'access_denied' ||
    status === 'error'
  ) {
    return <RedirectToRegister />;
  }

  // รออนุมัติ
  if (status === 'pending_approval') {
    return <PendingApprovalScreen />;
  }

  // ถูกปฏิเสธ / ระงับ
  if (status === 'rejected') {
    return (
      <MobileAppShell title="ไม่ผ่านการอนุมัติ" subtitle="ติดต่อเจ้าหน้าที่เพื่อขอข้อมูลเพิ่มเติม">
        <div className="mobile-stack" style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 56 }}>❌</div>
          <StatusChip status="rejected" />
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            กรุณาติดต่อเจ้าหน้าที่ผ่าน LINE OA ของ KaonA
          </p>
        </div>
      </MobileAppShell>
    );
  }

  if (status === 'suspended') {
    return (
      <MobileAppShell title="บัญชีถูกระงับ" subtitle="ติดต่อเจ้าหน้าที่เพื่อขอความช่วยเหลือ">
        <div className="mobile-stack" style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontSize: 56 }}>⚠️</div>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            บัญชีของคุณถูกระงับชั่วคราว กรุณาติดต่อเจ้าหน้าที่
          </p>
        </div>
      </MobileAppShell>
    );
  }

  // approved → หน้าหลักตาม role (TODO: role-based home)
  return (
    <MobileAppShell title="หน้าหลัก" subtitle="ยินดีต้อนรับสู่ KaonA Agri">
      <div className="mobile-stack" style={{ textAlign: 'center', padding: '16px 0' }}>
        <div style={{ fontSize: 48 }}>🌾</div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          กำลังพัฒนา dashboard — เร็วๆ นี้
        </p>
        <UIButton fullWidth onClick={() => window.location.reload()}>
          รีเฟรช
        </UIButton>
      </div>
    </MobileAppShell>
  );
}

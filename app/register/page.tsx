'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { RegisterTabs } from '@/features/member-register-tabs/register-tabs';
import { RegisterStatus } from '@/features/member-register-tabs/register-status';
import { RegisterContactAdmin } from '@/features/member-register-tabs/register-contact-admin';
import { RegisterEditInfo } from '@/features/member-register-tabs/register-edit-info';
import { useAuth } from '@/providers/auth-provider';

function RegisterPageContent() {
  const params = useSearchParams();
  const tab = params.get('tab');

  if (tab === 'about') {
    return (
      <MobileAppShell title="เกี่ยวกับ KaonA" subtitle="โครงการเกษตรกรรมยั่งยืน">
        <div className="mobile-stack">
          <div className="kaona-card" style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff', textAlign: 'center', padding: '28px 20px' }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🌽</div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>KaonA Agri</h2>
            <p style={{ margin: '8px 0 0', fontSize: 14, opacity: 0.85 }}>ระบบจัดการเกษตรกรรมครบวงจร</p>
          </div>
          {[
            { icon: '🌾', title: 'เมล็ดพันธุ์คุณภาพ', desc: 'คัดสรรเมล็ดพันธุ์ข้าวโพดคุณภาพสูง ราคาเป็นธรรม' },
            { icon: '🚜', title: 'บริการรถเกี่ยว', desc: 'ทีมรถเกี่ยวมืออาชีพ ตรงเวลา ราคาโปร่งใส' },
            { icon: '📊', title: 'ติดตามผลผลิต', desc: 'บันทึกและติดตามการเพาะปลูกแบบ real-time' },
            { icon: '💳', title: 'สินเชื่อเกษตรกร', desc: 'ระบบเครดิตยืดหยุ่น เพื่อสมาชิก KaonA' },
          ].map((item) => (
            <div key={item.title} className="kaona-card" style={{ display: 'flex', gap: 14 }}>
              <span style={{ fontSize: 28, flexShrink: 0 }}>{item.icon}</span>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{item.title}</p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </MobileAppShell>
    );
  }

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
  const { status, member } = useAuth();
  const params = useSearchParams();
  const tab = params.get('tab');
  const reapply = params.get('reapply') === '1';
  const forceRegisterLanding = reapply && status === 'rejected' && member?.rejection_reason === 'cancelled_by_admin';

  if (forceRegisterLanding) {
    return (
      <MobileAppShell title="สมัครเข้าร่วม KaonA" subtitle="เลือกประเภทการสมัครของคุณ">
        <RegisterTabs />
      </MobileAppShell>
    );
  }

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

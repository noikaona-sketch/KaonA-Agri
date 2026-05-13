'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useAuth, useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';

const ROLE_TH: Record<string, string> = {
  farmer: '🌾 เกษตรกร', truck_owner: '🚛 ทีมบริการ',
  inspector: '🔍 ผู้ตรวจ', staff: '👷 เจ้าหน้าที่',
  leader: '👥 หัวหน้ากลุ่ม', admin: '⚙️ แอดมิน',
};

// Farmer home
function FarmerHome({ name, memberId }: { name: string; memberId: string }) {
  const [stats, setStats] = useState({ plots: 0, activeCycles: 0 });

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void Promise.all([
      s.from('plots').select('id', { count: 'exact', head: true }).eq('member_id', memberId).is('deleted_at', null),
      s.from('planting_cycles').select('id', { count: 'exact', head: true }).eq('member_id', memberId).not('status', 'in', '("harvested","cancelled")'),
    ]).then(([p, c]) => setStats({ plots: p.count ?? 0, activeCycles: c.count ?? 0 }));
  }, [memberId]);
  return (
    <MobileAppShell title="" subtitle="">
      <div className="mobile-stack">
        <div className="home-hero">
          <p className="home-hero__greeting">สวัสดี 👋</p>
          <p className="home-hero__name">{name}</p>
          <span className="home-hero__role">🌾 เกษตรกร</span>
          <div className="home-hero__stats">
            <div className="home-hero__stat">
              <p className="home-hero__stat-val">{stats.plots}</p>
              <p className="home-hero__stat-lbl">แปลงของฉัน</p>
            </div>
            <div className="home-hero__stat">
              <p className="home-hero__stat-val">{stats.activeCycles}</p>
              <p className="home-hero__stat-lbl">รอบปลูกปัจจุบัน</p>
            </div>
          </div>
        </div>

        <div>
          <div className="section-header">
            <h2 className="section-title">เมนูหลัก</h2>
          </div>
          <div className="home-actions">
            {[
              { href: '/plots',                icon: '🌾', label: 'แปลงของฉัน',   desc: 'ดูและจัดการแปลง' },
              { href: '/planting-cycles',      icon: '🌱', label: 'รอบเพาะปลูก', desc: 'บันทึกความคืบหน้า' },
              { href: '/service/reservations', icon: '🫘', label: 'จองเมล็ดพันธุ์', desc: 'เลือกพันธุ์ จองกับ admin', accent: true },
              { href: '/no-burn',              icon: '🔥', label: 'งดเผา',          desc: 'ยื่นคำของดเผา' },
            ].map((item) => (
              <Link key={item.href} href={item.href}
                className={`home-action-card${item.accent ? ' home-action-card--accent' : ''}`}>
                <span className="home-action-card__icon">{item.icon}</span>
                <p className="home-action-card__label">{item.label}</p>
                <p className="home-action-card__desc">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </MobileAppShell>
  );
}

// Truck owner home
function TruckHome({ name }: { name: string }) {
  return (
    <MobileAppShell title="" subtitle="">
      <div className="mobile-stack">
        <div className="home-hero">
          <p className="home-hero__greeting">สวัสดี 👋</p>
          <p className="home-hero__name">{name}</p>
          <span className="home-hero__role">🚛 ทีมบริการ</span>
        </div>
        <div className="home-actions">
          {[
            { href: '/service',  icon: '🚛', label: 'งานของฉัน',    desc: 'ดูงานที่ได้รับมอบหมาย' },
            { href: '/profile',  icon: '👤', label: 'ข้อมูลรถ',     desc: 'จัดการรถและทะเบียน' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="home-action-card">
              <span className="home-action-card__icon">{item.icon}</span>
              <p className="home-action-card__label">{item.label}</p>
              <p className="home-action-card__desc">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </MobileAppShell>
  );
}

// Inspector/Staff home
function StaffHome({ name, role }: { name: string; role: string }) {
  return (
    <MobileAppShell title="" subtitle="">
      <div className="mobile-stack">
        <div className="home-hero">
          <p className="home-hero__greeting">สวัสดี 👋</p>
          <p className="home-hero__name">{name}</p>
          <span className="home-hero__role">{ROLE_TH[role] ?? role}</span>
        </div>
        <div className="home-actions">
          {[
            { href: '/inspection/tasks', icon: '🔍', label: 'งานตรวจ',      desc: 'รายการงานตรวจแปลง' },
            { href: '/field',            icon: '📋', label: 'ภาคสนาม',      desc: 'จัดการทีมภาคสนาม' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="home-action-card">
              <span className="home-action-card__icon">{item.icon}</span>
              <p className="home-action-card__label">{item.label}</p>
              <p className="home-action-card__desc">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </MobileAppShell>
  );
}

// Pending screen
function PendingScreen() {
  return (
    <MobileAppShell title="" subtitle="">
      <div className="mobile-stack" style={{ textAlign: 'center', padding: '32px 0' }}>
        <div style={{ fontSize: 64 }}>🌱</div>
        <div>
          <h2 style={{ margin: '8px 0 4px', fontSize: 20, fontWeight: 800 }}>รอการอนุมัติ</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>
            คำขอสมัครของคุณอยู่ระหว่างตรวจสอบ
          </p>
        </div>
        <div className="kaona-card" style={{ textAlign: 'left' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>ขั้นตอนถัดไป</p>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <li>เจ้าหน้าที่รับข้อมูลและตรวจสอบ</li>
            <li>แจ้งผลทาง LINE ภายใน 1-3 วันทำการ</li>
            <li>เมื่ออนุมัติแล้ว เปิด Mini App เข้าใช้ได้ทันที</li>
          </ul>
        </div>
      </div>
    </MobileAppShell>
  );
}

export default function HomePage() {
  const { status }     = useAuth();
  const member         = useCurrentMember();
  const effectiveRole  = useEffectiveRole();
  const router         = useRouter();

  useEffect(() => {
    if (['unauthenticated','no_member','access_denied','error'].includes(status)) {
      router.replace('/register');
    }
  }, [status, router]);

  if (status === 'loading') return <LoadingState label="กำลังโหลด…" />;
  if (['unauthenticated','no_member','access_denied','error'].includes(status))
    return <LoadingState label="กำลังนำทาง…" />;
  if (['pending_approval','pending'].includes(status)) return <PendingScreen />;

  if (status === 'rejected') return (
    <MobileAppShell title="" subtitle="">
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 56 }}>❌</div>
        <h2 style={{ margin: '12px 0 4px' }}>ไม่ผ่านการอนุมัติ</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>ติดต่อเจ้าหน้าที่ผ่าน LINE OA ของ KaonA</p>
      </div>
    </MobileAppShell>
  );

  if (status === 'suspended') return (
    <MobileAppShell title="" subtitle="">
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 56 }}>⚠️</div>
        <h2 style={{ margin: '12px 0 4px' }}>บัญชีถูกระงับ</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>ติดต่อเจ้าหน้าที่เพื่อขอความช่วยเหลือ</p>
      </div>
    </MobileAppShell>
  );

  const name = member?.full_name ?? 'สมาชิก';

  if (effectiveRole === 'truck_owner') return <TruckHome name={name} />;
  if (effectiveRole === 'inspector' || effectiveRole === 'staff')
    return <StaffHome name={name} role={effectiveRole} />;
  if (effectiveRole === 'farmer' || effectiveRole === 'leader')
    return <FarmerHome name={name} memberId={member?.member_id ?? ''} />;

  return <FarmerHome name={name} memberId={member?.member_id ?? ''} />;
}

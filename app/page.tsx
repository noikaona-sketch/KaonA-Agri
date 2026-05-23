'use client';

import Link                                        from 'next/link';
import { useEffect, useState }                     from 'react';
import { useRouter }                               from 'next/navigation';
import { useAuth, useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import { createSupabaseBrowserClient }             from '@/lib/supabase/client';
import { LoadingState }                            from '@/shared/components/loading-state';
import { MobileAppShell }                          from '@/shared/components/mobile-app-shell';
import type { AppRole }                            from '@/shared/auth/auth-types';
import { MemberDashboardFeed }                     from '@/features/engagement/member-dashboard-feed';
import { OnboardingChecklist }                     from '@/features/farmer-onboarding/onboarding-checklist';

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────
const ROLE_TH: Record<AppRole, string> = {
  farmer:     '🌽 เกษตรกร',
  staff:      '👷 เจ้าหน้าที่',
  inspector:  '🔍 ผู้ตรวจสอบ',
  leader:     '👥 หัวหน้ากลุ่ม',
  truck_owner:'🚛 ทีมบริการ',
  admin:      '⚙️ แอดมิน',
};

const ROLE_COLOR: Record<AppRole, { bg: string; text: string }> = {
  farmer:     { bg: '#EAF3DE', text: '#3B6D11' },
  staff:      { bg: '#E6F1FB', text: '#185FA5' },
  inspector:  { bg: '#EEEDFE', text: '#534AB7' },
  leader:     { bg: '#EEEDFE', text: '#534AB7' },
  truck_owner:{ bg: '#FFF8E1', text: '#B45309' },
  admin:      { bg: '#FCE8F3', text: '#9D174D' },
};

// ─────────────────────────────────────────────────────────────────────
// MenuCard — clean flat style matching mockup
// ─────────────────────────────────────────────────────────────────────
function MenuCard({ href, icon, label, desc, accent }: {
  href: string; icon: string; label: string; desc: string; accent?: boolean;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--color-background-primary,#fff)',
        borderRadius: 14, padding: '14px 10px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, border: accent ? '1.5px solid #639922' : '0.5px solid #e4ede4',
        minHeight: 90, textAlign: 'center',
        transition: 'transform 0.1s',
      }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
        onMouseUp={(e)   => (e.currentTarget.style.transform = 'scale(1)')}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f0faf0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          {icon}
        </div>
        <p style={{ margin: 0, fontWeight: 500, fontSize: 13, color: 'var(--color-text-primary,#111)', lineHeight: 1.2 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary,#666)', lineHeight: 1.3 }}>{desc}</p>
      </div>
    </Link>
  );
}

// Secondary role entry card (blue border)
function RoleCard({ href, icon, label, desc }: { href: string; icon: string; label: string; desc: string }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: '14px', display: 'flex', alignItems: 'center', gap: 12, border: '1.5px solid #B5D4F4' }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: '#111' }}>{label}</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{desc}</p>
        </div>
        <span style={{ color: '#185FA5', fontSize: 20 }}>›</span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hero card — shared across all roles
// ─────────────────────────────────────────────────────────────────────
function HeroCard({
  name, memberId, primaryRole, allRoles, plots, price, quota = null,
}: {
  name: string; memberId: string; primaryRole: AppRole;
  allRoles: AppRole[]; plots: number; price: number | null; quota?: number | null;
}) {
  const memberNo = `KF${memberId.slice(-6).toUpperCase()}`;
  const pr = ROLE_COLOR[primaryRole];
  return (
    <div style={{ background: '#f9fafb', borderRadius: 18, padding: '16px', border: '0.5px solid #e4ede4' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: pr.bg, border: `2px solid ${pr.text}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 500, color: pr.text }}>
            {name[0]}
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 17, color: '#111' }}>{name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{memberNo}</p>
            {/* role chips */}
            <div style={{ display: 'flex', gap: 4, marginTop: 5, flexWrap: 'wrap' }}>
              {allRoles.map((r) => (
                <span key={r} style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: ROLE_COLOR[r]?.bg ?? '#f0f0f0', color: ROLE_COLOR[r]?.text ?? '#333' }}>
                  {ROLE_TH[r]}
                </span>
              ))}
            </div>
          </div>
        </div>
        {/* stats */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {plots > 0 && <div><p style={{ margin: 0, fontSize: 18, fontWeight: 500, color: '#111' }}>{plots}</p><p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>แปลง</p></div>}
          {quota !== null && <div style={{ marginTop: plots > 0 ? 6 : 0 }}><p style={{ margin: 0, fontSize: 18, fontWeight: 500, color: '#3B6D11' }}>{quota.toLocaleString()}</p><p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>ตัน (โควต้า)</p></div>}
          {price !== null && <div style={{ marginTop: 6 }}><p style={{ margin: 0, fontSize: 15, fontWeight: 500, color: '#1565c0' }}>{Number(price).toLocaleString()}</p><p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>บ./กก.</p></div>}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SECONDARY ROLE CARDS — shown at bottom of any home
// ─────────────────────────────────────────────────────────────────────
const SECONDARY_ROLE_CARDS: Partial<Record<AppRole, { icon: string; label: string; desc: string; href: string }>> = {
  staff:      { icon: '👷', label: 'ทีมภาคสนาม',    desc: 'จองให้สมาชิก · งานตรวจ',         href: '/field#reservation' },
  inspector:  { icon: '🔍', label: 'งานตรวจสอบ',    desc: 'รายการงานตรวจ · บันทึกผล',        href: '/inspection/tasks' },
  leader:     { icon: '👥', label: 'หัวหน้าทีม',     desc: 'ลูกทีม · สรุปพื้นที่ · ติดตาม',   href: '/team' },
  truck_owner:{ icon: '🚛', label: 'ทีมบริการรถ',   desc: 'งานรถ · ตารางว่าง',               href: '/truck' },
  admin:      { icon: '⚙️', label: 'แผงแอดมิน',     desc: 'จัดการระบบ',                      href: '/admin/sales' },
};

function SecondaryRoleCards({ primaryRole, allRoles }: { primaryRole: AppRole; allRoles: AppRole[] }) {
  const secondary = allRoles.filter((r) => r !== primaryRole && SECONDARY_ROLE_CARDS[r]);
  if (secondary.length === 0) return null;
  return (
    <div>
      <p style={{ margin: '0 0 10px', fontWeight: 500, fontSize: 14, color: 'var(--color-text-secondary,#666)' }}>บทบาทอื่นของฉัน</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {secondary.map((r) => {
          const card = SECONDARY_ROLE_CARDS[r]!;
          return <RoleCard key={r} {...card} />;
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// FARMER HOME
// ─────────────────────────────────────────────────────────────────────
function FarmerHome({ name, memberId, allRoles }: { name: string; memberId: string; allRoles: AppRole[] }) {
  const [plots, setPlots] = useState(0);
  const [quota, setQuota] = useState<number | null>(null);

  useEffect(() => {
    // plots count — browser client, RLS controls access by auth.uid()
    // quota fetch is handled in PR #205 (feat/quota-display)
    const s = createSupabaseBrowserClient();
    void (async () => {
      // ดึง session token และ plots พร้อมกัน
      const [sessionRes, plotsRes] = await Promise.all([
        s.auth.getSession(),
        s.from('plots').select('id', { count: 'exact', head: true })
          .eq('member_id', memberId).eq('status', 'active'),
      ]);
      setPlots(plotsRes.count ?? 0);

      // ดึง quota ถ้ามี session (ใช้ token ที่ได้จากด้านบน)
      const accessToken = sessionRes.data.session?.access_token;
      if (accessToken) {
        void fetch('/api/member/quota', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json())
          .then((q: { quota_ton?: number | null }) => {
            if (q.quota_ton !== null && q.quota_ton !== undefined) setQuota(q.quota_ton);
          }).catch(() => null); // quota ไม่ critical — ล้มเหลวก็ไม่เป็นไร
      }
    })();
  }, [memberId]);

  const FARMER_MENU = [
    { href: '/service/reservations', icon: '🌽', label: 'จองเมล็ดพันธุ์',   desc: 'จองข้าวโพด', accent: true },
    { href: '/planting-cycles/new', icon: '🌱',  label: 'แจ้งปลูก',          desc: 'บันทึกรอบปลูก' },
    { href: '/plots',               icon: '📅',  label: 'จองคิวขาย',         desc: 'นัดวันขาย' },
    { href: '/no-burn',             icon: '📸',  label: 'ส่งรูปแปลง',        desc: 'รูปแปลง/ไม่เผา' },
    { href: '/no-burn',             icon: '🌿',  label: 'โครงการไม่เผา',     desc: 'สมัครโครงการ' },
    { href: '/planting-cycles',     icon: '📊',  label: 'ประวัติรอบปลูก',     desc: 'ประวัติและยอดขาย' },
    { href: '/harvest/calculator',  icon: '💧',  label: 'คำนวณ ชื้น/บาท',    desc: 'ขายเลย vs รอให้แห้ง' },
    { href: '/harvest/book',        icon: '🚜',  label: 'แจ้งวันเกี่ยว',      desc: 'จองคิวรับซื้อ/เข้าอบ' },
  ];

  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <HeroCard name={name} memberId={memberId} primaryRole="farmer" allRoles={allRoles} plots={plots} price={null} quota={quota} />

        {/* onboarding checklist — ซ่อนเองเมื่อทำครบ 4 ขั้น */}
        <OnboardingChecklist memberId={memberId} />

        {/* P1.5 engagement feed — status + season + no-burn + announcement + price */}
        <MemberDashboardFeed memberId={memberId} />

        {/* main menus */}
        <div>
          <p style={{ margin: '0 0 10px', fontWeight: 500, fontSize: 14, color: 'var(--color-text-secondary,#666)' }}>เมนูหลัก</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {FARMER_MENU.map((item) => <MenuCard key={item.href + item.label} {...item} />)}
          </div>
        </div>

        {/* bonus banner */}
        <div style={{ background: '#FFF8DB', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center', border: '0.5px solid #F9C74F' }}>
          <span style={{ fontSize: 26, flexShrink: 0 }}>🎁</span>
          <div>
            <p style={{ margin: 0, fontWeight: 500, fontSize: 14, color: '#92400E' }}>สิทธิพิเศษสำหรับสมาชิก</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#B45309' }}>รับโบนัส +100 บาท/ตัน สำหรับสมาชิกไม่เผาตอซัง</p>
          </div>
        </div>

        <SecondaryRoleCards primaryRole="farmer" allRoles={allRoles} />
      </div>
    </MobileAppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STAFF / LEADER / INSPECTOR HOME
// ─────────────────────────────────────────────────────────────────────
function StaffHome({ name, memberId, primaryRole, allRoles }: { name: string; memberId: string; primaryRole: AppRole; allRoles: AppRole[] }) {
  const [plots, setPlots] = useState(0);
  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s.from('plots').select('id', { count: 'exact', head: true })
      .eq('member_id', memberId).eq('status', 'active')
      .then((p) => setPlots(p.count ?? 0));
  }, [memberId]);

  const STAFF_MENU = [
    { href: '/harvest/intake',    icon: '⚖️', label: 'บันทึกรับซื้อ',  desc: 'กรอกน้ำหนัก/ความชื้น', accent: true },
    { href: '/field#reservation', icon: '🌽', label: 'จองเมล็ด',       desc: 'จองให้สมาชิก' },
    { href: '/inspection/tasks',  icon: '🔍', label: 'งานตรวจ',        desc: 'รายการงาน' },
    { href: '/field',             icon: '🗺️', label: 'แผนที่',         desc: 'สมาชิกในพื้นที่' },
    { href: '/admin/sales',       icon: '📋', label: 'คิวจอง',         desc: 'อนุมัติการจอง' },
  ];

  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <HeroCard name={name} memberId={memberId} primaryRole={primaryRole} allRoles={allRoles} plots={plots} price={null} />
        <div>
          <p style={{ margin: '0 0 10px', fontWeight: 500, fontSize: 14, color: 'var(--color-text-secondary,#666)' }}>เมนูหลัก</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
            {STAFF_MENU.map((item) => <MenuCard key={item.href + item.label} {...item} />)}
          </div>
        </div>
        <SecondaryRoleCards primaryRole={primaryRole} allRoles={allRoles} />
      </div>
    </MobileAppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TRUCK HOME
// ─────────────────────────────────────────────────────────────────────
function TruckHome({ name, memberId, allRoles }: { name: string; memberId: string; allRoles: AppRole[] }) {
  const TRUCK_MENU = [
    { href: '/truck',   icon: '🚜', label: 'งานรถ',   desc: 'งานที่ได้รับ' },
    { href: '/no-burn', icon: '🔥', label: 'งดเผา',   desc: 'คำของดเผา'    },
  ];
  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <HeroCard name={name} memberId={memberId} primaryRole="truck_owner" allRoles={allRoles} plots={0} price={null} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
          {TRUCK_MENU.map((item) => <MenuCard key={item.href} {...item} />)}
        </div>
        <SecondaryRoleCards primaryRole="truck_owner" allRoles={allRoles} />
      </div>
    </MobileAppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// PENDING SCREEN
// ─────────────────────────────────────────────────────────────────────
function PendingScreen() {
  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ textAlign: 'center', padding: '32px 0 16px' }}>
          <div style={{ fontSize: 56 }}>🌱</div>
          <h2 style={{ margin: '12px 0 4px', fontSize: 20, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>รอการอนุมัติ</h2>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary,#666)' }}>คำขอสมัครของคุณอยู่ระหว่างตรวจสอบ</p>
        </div>
        <div style={{ background: '#f9fafb', borderRadius: 14, padding: '16px', border: '0.5px solid #e4ede4' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 500, fontSize: 14 }}>ขั้นตอนถัดไป</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, color: 'var(--color-text-secondary,#666)', lineHeight: 2 }}>
            <li>เจ้าหน้าที่รับข้อมูลและตรวจสอบ</li>
            <li>แจ้งผลทาง LINE ภายใน 1-3 วันทำการ</li>
            <li>เมื่ออนุมัติแล้ว เปิด Mini App เข้าใช้ได้ทันที</li>
          </ul>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href="/register?tab=edit" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e4ede4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>📋</span>
                <div><p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>แก้ไขข้อมูลที่สมัคร</p><p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>แก้ไขข้อมูลการสมัครสมาชิก</p></div>
              </div>
              <span style={{ color: '#6b7280', fontSize: 20 }}>›</span>
            </div>
          </Link>
          <Link href="/contact" style={{ textDecoration: 'none' }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', border: '0.5px solid #e4ede4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>📞</span>
                <div><p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>ติดต่อบริษัท</p><p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>สอบถามสถานะหรือขอความช่วยเหลือ</p></div>
              </div>
              <span style={{ color: '#6b7280', fontSize: 20 }}>›</span>
            </div>
          </Link>
        </div>
      </div>
    </MobileAppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { status } = useAuth();
  const member     = useCurrentMember();
  const effectiveRole = useEffectiveRole();
  const router     = useRouter();

  useEffect(() => {
    if (['unauthenticated','no_member','access_denied','error'].includes(status)) {
      router.replace('/register');
    }
  }, [status, router]);

  if (status === 'loading') return <LoadingState label="กำลังโหลด…" />;
  if (['unauthenticated','no_member','access_denied','error'].includes(status)) return <LoadingState label="กำลังนำทาง…" />;
  if (['pending_approval','pending'].includes(status)) return <PendingScreen />;

  if (status === 'rejected') return (
    <MobileAppShell title="" subtitle="">
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 56 }}>❌</div>
        <h2 style={{ margin: '12px 0 4px', fontSize: 20, fontWeight: 500 }}>ไม่ผ่านการอนุมัติ</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary,#666)' }}>ติดต่อเจ้าหน้าที่ผ่าน LINE OA ของ KaonA</p>
      </div>
    </MobileAppShell>
  );

  if (status === 'suspended') return (
    <MobileAppShell title="" subtitle="">
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 56 }}>⚠️</div>
        <h2 style={{ margin: '12px 0 4px', fontSize: 20, fontWeight: 500 }}>บัญชีถูกระงับ</h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary,#666)' }}>ติดต่อเจ้าหน้าที่เพื่อขอความช่วยเหลือ</p>
      </div>
    </MobileAppShell>
  );

  const name       = member?.full_name ?? 'สมาชิก';
  const memberId   = member?.member_id ?? '';
  const allRoles   = (member?.roles ?? []) as AppRole[];
  // primaryRole = effectiveRole (admin-set is_primary) fallback to first role
  const primaryRole: AppRole = (effectiveRole ?? allRoles[0] ?? 'farmer') as AppRole;

  if (primaryRole === 'truck_owner') return <TruckHome name={name} memberId={memberId} allRoles={allRoles} />;
  if (['staff','inspector','leader'].includes(primaryRole)) return <StaffHome name={name} memberId={memberId} primaryRole={primaryRole} allRoles={allRoles} />;
  return <FarmerHome name={name} memberId={memberId} allRoles={allRoles} />;
}

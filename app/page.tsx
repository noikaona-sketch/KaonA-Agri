'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';

// ── Menu card ───────────────────────────────────────────────────────
function MenuCard({ href, icon, label, desc, bg, iconBg }: {
  href: string; icon: string; label: string; desc: string; bg?: string; iconBg?: string;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ background: bg ?? '#fff', borderRadius: 16, padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px solid #e8ede8', minHeight: 100, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'transform 0.1s' }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: iconBg ?? '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
          {icon}
        </div>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: '#1a2e1a', lineHeight: 1.2 }}>{label}</p>
        <p style={{ margin: 0, fontSize: 11, color: '#7a8c7a', lineHeight: 1.4 }}>{desc}</p>
      </div>
    </Link>
  );
}

// ── Farmer home ─────────────────────────────────────────────────────
function FarmerHome({ name, memberId }: { name: string; memberId: string }) {
  const [stats, setStats]   = useState({ plots: 0, activeCycles: 0, quota: 0 });
  const [price, setPrice]   = useState<number | null>(null);
  const [memberNo, setMemberNo] = useState('');
  const [tier, setTier]     = useState('บรอนซ์');

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void Promise.all([
      s.from('plots').select('id', { count: 'exact', head: true }).eq('member_id', memberId).is('deleted_at', null),
      s.from('planting_cycles').select('id,quota_kg', { count: 'exact' }).eq('member_id', memberId).not('status', 'in', '(harvested,cancelled)'),
      s.from('market_prices').select('price_per_kg').eq('is_active', true).ilike('crop_type', '%ข้าวโพด%').order('effective_date', { ascending: false }).limit(1).maybeSingle(),
      s.from('members').select('id').eq('id', memberId).single(),
    ]).then(([p, c, pr, m]) => {
      setStats({
        plots:        p.count ?? 0,
        activeCycles: c.count ?? 0,
        quota:        (c.data ?? []).reduce((s: number, r: Record<string,unknown>) => s + (Number(r.quota_kg) || 0), 0),
      });
      if (pr.data) setPrice(pr.data.price_per_kg);
      if (m.data) setMemberNo(`KF${m.data.id.slice(-6).toUpperCase()}`);
    });
  }, [memberId]);

  const FARMER_MENU = [
    { href: '/register?tab=edit',      icon: '📋', label: 'สมัครสมาชิก',   desc: 'ลงทะเบียน/แก้ข้อมูล',   bg: '#f0faf0', iconBg: '#c8e6c9' },
    { href: '/',                       icon: '⏳', label: 'สถานะ',           desc: 'ความคืบหน้าการสมัคร',  bg: '#fffde7', iconBg: '#fff9c4' },
    { href: '/plots',                  icon: '📍', label: 'ปักหมุด',          desc: 'แจ้งตั้งแปลง',          bg: '#e3f2fd', iconBg: '#bbdefb' },
    { href: '/planting-cycles/new',    icon: '🌱', label: 'แจ้งปลูก',         desc: 'บันทึกรอบการปลูก',     bg: '#f1f8e9', iconBg: '#dcedc8' },
    { href: '/varieties',              icon: '🌿', label: 'พันธุ์',            desc: 'ข้อมูลเมล็ด+พี่เลี้ยง', bg: '#e8f5e9', iconBg: '#a5d6a7' },
    { href: '/service/reservations',   icon: '🫘', label: 'จองเมล็ด',         desc: 'จองเมล็ดพันธุ์',        bg: '#fff8e1', iconBg: '#ffe082' },
    { href: '/planting-cycles',        icon: '📅', label: 'จองคิว',           desc: 'นัดวันขาย',             bg: '#fce4ec', iconBg: '#f8bbd0' },
    { href: '/planting-cycles',        icon: '💲', label: 'ราคา',             desc: 'ราคาตามพันธุ์',          bg: '#e8eaf6', iconBg: '#c5cae9' },
    { href: '/profile',                icon: '🖼️', label: 'ส่งรูป',           desc: 'รูปแปลง/ไม่เผา',        bg: '#fce4ec', iconBg: '#f48fb1' },
    { href: '/profile',                icon: '👑', label: 'ระดับ',            desc: 'สิทธิ์สมาชิก',          bg: '#fff8e1', iconBg: '#ffd54f' },
  ];

  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Hero card ── */}
        <div style={{ background: 'linear-gradient(135deg,#1b5e20 0%,#2e7d32 60%,#388e3c 100%)', borderRadius: 20, padding: '20px 18px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          {/* decorative circles */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 40, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            {/* avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 900 }}>
                {name[0]}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>{name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, opacity: 0.8, fontFamily: 'monospace' }}>{memberNo}</p>
                <div style={{ marginTop: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '2px 10px', display: 'inline-block', fontSize: 12, fontWeight: 700 }}>
                  🌾 เกษตรกร
                </div>
              </div>
            </div>
            {/* tier badge */}
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '6px 12px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 10, opacity: 0.8 }}>ระดับสมาชิก</p>
              <p style={{ margin: '2px 0 0', fontSize: 14, fontWeight: 900 }}>🏆 {tier}</p>
            </div>
          </div>

          {/* quota + price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 14px' }}>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.8 }}>โควต้าปัจจุบัน</p>
              <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900 }}>{stats.quota > 0 ? `${stats.quota.toLocaleString()}` : stats.plots}</p>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>{stats.quota > 0 ? 'ตัน' : 'แปลง'}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 14px' }}>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.8 }}>ราคาวันนี้ (เกรด A)</p>
              <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900 }}>{price ? price.toLocaleString() : '—'}</p>
              <p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>บ./ตัน</p>
            </div>
          </div>
        </div>

        {/* ── Menu grid 3 cols ── */}
        <div>
          <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 15, color: '#2e7d32' }}>เมนูหลัก</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {FARMER_MENU.map((item) => (
              <MenuCard key={item.href + item.label} {...item} />
            ))}
          </div>
        </div>

        {/* ── bonus banner ── */}
        <div style={{ background: 'linear-gradient(90deg,#f9a825,#ffca28)', borderRadius: 16, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>🎁</span>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#4e3400' }}>สิทธิพิเศษสำหรับสมาชิก</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6d4c00' }}>รับโบนัสพิเศษ +100 บาท/ตัน สำหรับสมาชิกที่ไม่เผาตอซัง</p>
          </div>
        </div>

      </div>
    </MobileAppShell>
  );
}

// ── Truck home ─────────────────────────────────────────────────────
function TruckHome({ name }: { name: string }) {
  const MENU = [
    { href: '/truck',         icon: '🚜', label: 'งานรถเกี่ยว', desc: 'งานที่ได้รับ',      bg: '#e8f5e9', iconBg: '#a5d6a7' },
    { href: '/no-burn',       icon: '🔥', label: 'งดเผา',       desc: 'คำของดเผา',         bg: '#fff8e1', iconBg: '#ffe082' },
    { href: '/notifications', icon: '🔔', label: 'แจ้งเตือน',  desc: 'ข่าวสาร',            bg: '#e3f2fd', iconBg: '#90caf9' },
    { href: '/profile',       icon: '👤', label: 'โปรไฟล์',    desc: 'ข้อมูลรถ',           bg: '#f3e5f5', iconBg: '#ce93d8' },
  ];
  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'linear-gradient(135deg,#1565c0,#1976d2)', borderRadius: 20, padding: '20px 18px', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>สวัสดี 👋</p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900 }}>{name}</p>
          <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 14px', display: 'inline-block', fontSize: 13, fontWeight: 700 }}>🚛 ทีมบริการ</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {MENU.map((item) => <MenuCard key={item.href} {...item} />)}
        </div>
      </div>
    </MobileAppShell>
  );
}

// ── Inspector/Staff home ────────────────────────────────────────────
function StaffHome({ name, role }: { name: string; role: string }) {
  const ROLE_TH: Record<string, string> = {
    inspector: '🔍 ผู้ตรวจ', staff: '👷 เจ้าหน้าที่', leader: '👥 หัวหน้ากลุ่ม',
  };
  const MENU = [
    { href: '/inspection/tasks', icon: '🔍', label: 'งานตรวจ',    desc: 'รายการงานตรวจ',      bg: '#e8f5e9', iconBg: '#a5d6a7' },
    { href: '/field',            icon: '🗺️', label: 'ภาคสนาม',   desc: 'แผนที่+จองเมล็ด',    bg: '#e3f2fd', iconBg: '#90caf9' },
    { href: '/field#reservation',icon: '🌾', label: 'จองเมล็ด',  desc: 'จองให้สมาชิก',        bg: '#fff8e1', iconBg: '#ffe082' },
    { href: '/notifications',    icon: '🔔', label: 'แจ้งเตือน', desc: 'ข่าวสาร',              bg: '#fff8e1', iconBg: '#ffe082' },
    { href: '/profile',          icon: '👤', label: 'โปรไฟล์',   desc: 'ข้อมูลและสิทธิ์',     bg: '#f3e5f5', iconBg: '#ce93d8' },
  ];
  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ background: 'linear-gradient(135deg,#4a148c,#6a1b9a)', borderRadius: 20, padding: '20px 18px', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>สวัสดี 👋</p>
          <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 900 }}>{name}</p>
          <div style={{ marginTop: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '4px 14px', display: 'inline-block', fontSize: 13, fontWeight: 700 }}>{ROLE_TH[role] ?? role}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {MENU.map((item) => <MenuCard key={item.href + item.label} {...item} />)}
        </div>
      </div>
    </MobileAppShell>
  );
}

// ── Pending ─────────────────────────────────────────────────────────
function PendingScreen() {
  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div style={{ fontSize: 64 }}>🌱</div>
        <h2 style={{ margin: '12px 0 4px', fontSize: 20, fontWeight: 800 }}>รอการอนุมัติ</h2>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>คำขอสมัครของคุณอยู่ระหว่างตรวจสอบ</p>
        <div className="kaona-card" style={{ textAlign: 'left', marginTop: 20 }}>
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

// ── Main ─────────────────────────────────────────────────────────────
export default function HomePage() {
  const { status }    = useAuth();
  const member        = useCurrentMember();
  const effectiveRole = useEffectiveRole();
  const router        = useRouter();

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

  const name  = member?.full_name ?? 'สมาชิก';
  const roles = member?.roles ?? [];
  const isStaff = ['inspector','staff','leader','admin'].some((r) => roles.includes(r as never));

  if (effectiveRole === 'truck_owner') return <TruckHome name={name} />;
  if (effectiveRole === 'inspector' || effectiveRole === 'staff' || effectiveRole === 'leader' || (isStaff && effectiveRole === 'farmer'))
    return <StaffHome name={name} role={effectiveRole === 'farmer' ? (roles.find((r) => ['inspector','staff','leader'].includes(r as string)) ?? 'staff') as string : effectiveRole} />;
  return <FarmerHome name={name} memberId={member?.member_id ?? ''} />;
}

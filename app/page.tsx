'use client';

import Link                                        from 'next/link';
import { useEffect, useState }                     from 'react';
import { useRouter }                               from 'next/navigation';
import { useAuth, useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import { createSupabaseBrowserClient }             from '@/lib/supabase/client';
import { LoadingState }                            from '@/shared/components/loading-state';
import { MobileAppShell }                          from '@/shared/components/mobile-app-shell';
import type { AppRole }                            from '@/shared/auth/auth-types';

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
type BadgeStyle = { label: string; color: string; bg: string };

function MenuCard({ href, icon, label, desc, accent, badge }: {
  href: string; icon: string; label: string; desc: string; accent?: boolean;
  badge?: BadgeStyle;
}) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        background: 'var(--color-background-primary,#fff)',
        borderRadius: 14, padding: '14px 10px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, border: accent ? '1.5px solid #639922' : '0.5px solid #e4ede4',
        minHeight: 90, textAlign: 'center', position: 'relative',
        transition: 'transform 0.1s',
      }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
        onMouseUp={(e)   => (e.currentTarget.style.transform = 'scale(1)')}>
        {/* Status badge */}
        {badge && (
          <div style={{
            position: 'absolute', top: 7, right: 7,
            fontSize: 9, fontWeight: 800, padding: '2px 6px',
            borderRadius: 99, background: badge.bg, color: badge.color,
            display: 'flex', alignItems: 'center', gap: 3, lineHeight: 1.4,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: badge.color, flexShrink: 0 }} />
            {badge.label}
          </div>
        )}
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
  leader:     { icon: '👥', label: 'หัวหน้าทีม',     desc: 'ลูกทีม · สรุปพื้นที่ · ติดตาม',   href: '/leader/team' },
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
  const [plots,         setPlots]         = useState(0);
  const [quota,         setQuota]         = useState<number | null>(null);
  const [cycleStatus,   setCycleStatus]   = useState<string | null>(null);   // active cycle status
  const [noBurnStatus,  setNoBurnStatus]  = useState<string | null>(null);   // latest no-burn status

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

      // Badge data — cycle + no-burn (silent fail)
      const [cycleRes, noBurnRes] = await Promise.all([
        s.from('planting_cycles')
          .select('status').eq('member_id', memberId)
          .in('status', ['pending','active','confirmed','growing','flowering','maturing','ready'])
          .order('created_at', { ascending: false }).limit(1).maybeSingle(),
        s.from('no_burn_requests')
          .select('status').eq('member_id', memberId)
          .is('deleted_at', null)
          .order('submitted_at', { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (cycleRes.data?.status)  setCycleStatus(cycleRes.data.status);
      if (noBurnRes.data?.status) setNoBurnStatus(noBurnRes.data.status);

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


  // ── Badge helpers ──────────────────────────────────────────────────────────
  const CYCLE_STATUS_TH: Record<string, string> = {
    pending: 'วางแผน', active: 'กำลังปลูก', confirmed: 'ยืนยันแล้ว',
    growing: 'กำลังโต', flowering: 'ออกดอก', maturing: 'กำลังแก่', ready: 'พร้อมเก็บ',
  };
  const NO_BURN_STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
    submitted:           { label: 'รอตรวจสอบ',   color: '#633806', bg: '#FAEEDA' },
    under_review:        { label: 'กำลังตรวจ',    color: '#0C447C', bg: '#E6F1FB' },
    inspection_required: { label: 'นัดตรวจแปลง',  color: '#3C3489', bg: '#EEEDFE' },
    approved:            { label: '✓ อนุมัติแล้ว', color: '#27500A', bg: '#EAF3DE' },
    completed:           { label: '✓ เสร็จสิ้น',   color: '#27500A', bg: '#EAF3DE' },
    rejected:            { label: 'ไม่ผ่าน',       color: '#444441', bg: '#F1EFE8' },
  };

  const cycleBadge: BadgeStyle | undefined = cycleStatus
    ? { label: CYCLE_STATUS_TH[cycleStatus] ?? cycleStatus, color: '#27500A', bg: '#EAF3DE' }
    : undefined;

  const noBurnBadge: BadgeStyle | undefined = noBurnStatus
    ? (NO_BURN_STATUS_TH[noBurnStatus] ?? { label: noBurnStatus, color: '#633806', bg: '#FAEEDA' })
    : { label: 'ยังไม่สมัคร', color: '#854F0B', bg: '#FAEEDA' };

  const FARMER_MENU_GROUPS = [
    {
      group: '🌱 การปลูก',
      accentColor: '#2e7d32',
      items: [
        { href: '/service/reservations', icon: '🌽', label: 'จองเมล็ดพันธุ์', desc: 'สั่งข้าวโพด', accent: true },
        { href: '/planting-cycles/new',  icon: '🌱', label: 'แจ้งปลูกใหม่',   desc: 'เปิดรอบปลูก' },
        { href: '/planting-cycles',      icon: '🌾', label: 'ไร่ของฉัน',        desc: 'ติดตาม+บันทึก', badge: cycleBadge },
        { href: '/plots',                icon: '🗺️', label: 'แปลงของฉัน',     desc: 'ข้อมูลแปลง' },
      ],
    },
    {
      group: '💰 ขายผลผลิต',
      accentColor: '#1565c0',
      items: [
        { href: '/harvest/book',       icon: '🚜', label: 'แจ้งวันเกี่ยว',   desc: 'จองคิวรับซื้อ' },
        { href: '/plots',              icon: '📅', label: 'นัดวันขาย',        desc: 'จองคิวขาย' },
        { href: '/harvest/calculator', icon: '💧', label: 'คำนวณชื้น/บาท',   desc: 'ขายเลย vs รอแห้ง' },
        { href: '/planting-cycles',    icon: '📊', label: 'ประวัติยอดขาย',   desc: 'สรุปรายได้' },
      ],
    },
    {
      group: '🌿 โครงการไม่เผา',
      accentColor: '#e65100',
      items: [
        { href: '/no-burn', icon: '🌿', label: 'ลงทะเบียนงดเผา', desc: 'สมัคร+ติดตามสถานะ', badge: noBurnBadge },
        { href: '/no-burn', icon: '📸', label: 'ส่งรูปหลักฐาน',  desc: 'รูปแปลงงดเผา' },
      ],
    },
  ];

  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <HeroCard name={name} memberId={memberId} primaryRole="farmer" allRoles={allRoles} plots={plots} price={null} quota={quota} />

        {/* เมนูแยกกลุ่ม */}
        {FARMER_MENU_GROUPS.map((grp) => (
          <div key={grp.group}>
            {/* Group header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ height: 3, width: 20, borderRadius: 99, background: grp.accentColor }} />
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: grp.accentColor, letterSpacing: '0.02em' }}>
                {grp.group}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8 }}>
              {grp.items.map((item) => <MenuCard key={item.href + item.label} {...item} />)}
            </div>
            {/* No-burn status widget — only for the no-burn group */}

          </div>
        ))}


        <SecondaryRoleCards primaryRole="farmer" allRoles={allRoles} />
      </div>
    </MobileAppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// STAFF / LEADER / INSPECTOR HOME
// ─────────────────────────────────────────────────────────────────────
type GroupSummary = { total: number; approved: number; pending: number };

function useLeaderGroup(memberId: string, isLeader: boolean) {
  const [summary, setSummary] = useState<GroupSummary | null>(null);
  const [groupName, setGroupName] = useState('');
  useEffect(() => {
    if (!isLeader) return;
    const s = createSupabaseBrowserClient();
    void (async () => {
      const { data: mg } = await s.from('member_group_members')
        .select('group_id, member_groups(name)').eq('member_id', memberId).maybeSingle();
      if (!mg) return;
      setGroupName((mg.member_groups as unknown as { name: string } | null)?.name ?? '');
      const { data: members } = await s.from('member_group_members')
        .select('member_id, members!member_group_members_member_id_fkey(status)')
        .eq('group_id', mg.group_id);
      const rows = (members ?? []) as unknown as { members: { status: string } | null }[];
      setSummary({
        total:    rows.length,
        approved: rows.filter(r => (r.members as { status: string } | null)?.status === 'approved').length,
        pending:  rows.filter(r => (r.members as { status: string } | null)?.status === 'pending').length,
      });
    })();
  }, [memberId, isLeader]);
  return { summary, groupName };
}

function StaffHome({ name, memberId, primaryRole, allRoles }: { name: string; memberId: string; primaryRole: AppRole; allRoles: AppRole[] }) {
  const [plots, setPlots] = useState(0);
  const isLeader   = primaryRole === 'leader' || allRoles.includes('leader');
  const isInspector = primaryRole === 'inspector' || allRoles.includes('inspector');
  const { summary: leaderSummary, groupName } = useLeaderGroup(memberId, isLeader);

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s.from('plots').select('id', { count: 'exact', head: true })
      .eq('member_id', memberId).eq('status', 'active')
      .then((p) => setPlots(p.count ?? 0));
  }, [memberId]);

  const STAFF_MENU = [
    { href: '/harvest/intake',    icon: '⚖️', label: 'บันทึกรับซื้อ',  desc: 'กรอกน้ำหนัก/ความชื้น', accent: true },
    { href: '/field#reservation', icon: '🌽', label: 'จองเมล็ด',       desc: 'จองให้สมาชิก' },
    { href: '/inspection/tasks',  icon: '🔍', label: 'งานตรวจ',        desc: isInspector ? 'งานของคุณ' : 'รายการงาน' },
    { href: '/field',             icon: '🗺️', label: 'แผนที่',         desc: 'สมาชิกในพื้นที่' },
    { href: '/admin/sales',       icon: '📋', label: 'คิวจอง',         desc: 'อนุมัติการจอง' },
  ];

  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <HeroCard name={name} memberId={memberId} primaryRole={primaryRole} allRoles={allRoles} plots={plots} price={null} />

        {/* Leader: สรุปกลุ่มสมาชิก */}
        {isLeader && leaderSummary && (
          <div className="kaona-card" style={{ background:'#EAF3DE', border:'1px solid #b7e4c7' }}>
            <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:13, color:'#1b5e20' }}>
              👥 กลุ่ม{groupName ? `: ${groupName}` : ''}
            </p>
            <div style={{ display:'flex', gap:12 }}>
              {[
                { label:'สมาชิกทั้งหมด', value:leaderSummary.total,    color:'#1b5e20' },
                { label:'อนุมัติแล้ว',   value:leaderSummary.approved, color:'#059669' },
                { label:'รอดำเนินการ',   value:leaderSummary.pending,  color: leaderSummary.pending > 0 ? '#d97706' : '#9ca3af' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ flex:1, textAlign:'center' }}>
                  <p style={{ margin:'0 0 2px', fontSize:20, fontWeight:700, color }}>{value}</p>
                  <p style={{ margin:0, fontSize:10, color:'#6b7280' }}>{label}</p>
                </div>
              ))}
            </div>
            {leaderSummary.pending > 0 && (
              <p style={{ margin:'8px 0 0', fontSize:11, color:'#d97706', fontWeight:500 }}>
                ⏳ มีสมาชิก {leaderSummary.pending} คน รอการอนุมัติ
              </p>
            )}
          </div>
        )}

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
  const [reapplySubmitting, setReapplySubmitting] = useState(false);
  const [reapplyError, setReapplyError] = useState<string | null>(null);

  useEffect(() => {
    if (['unauthenticated','no_member','pending','access_denied','error'].includes(status)) {
      router.replace('/register');
    }
  }, [status, router]);

  if (status === 'loading') return <LoadingState label="กำลังโหลด…" />;
  if (['unauthenticated','no_member','pending','access_denied','error'].includes(status)) return <LoadingState label="กำลังนำทาง…" />;
  if (status === 'pending_approval') return <PendingScreen />;

  if (status === 'rejected') {
    const isCancelled = member?.rejection_reason === 'cancelled_by_admin';
    return (
      <MobileAppShell title="" subtitle="">
        <div style={{ textAlign:'center', padding:'48px 24px' }}>
          <div style={{ fontSize:56 }}>{isCancelled ? '🔄' : '❌'}</div>
          <h2 style={{ margin:'12px 0 4px', fontSize:20, fontWeight:700 }}>
            {isCancelled ? 'ยกเลิกการสมัครแล้ว' : 'ไม่ผ่านการอนุมัติ'}
          </h2>
          <p style={{ fontSize:14, color:'var(--color-text-secondary,#666)', marginBottom:24 }}>
            {isCancelled
              ? 'บัญชีของคุณถูกยกเลิก กรุณาสมัครสมาชิกใหม่อีกครั้ง'
              : 'ติดต่อเจ้าหน้าที่ผ่าน LINE OA ของ KaonA'}
          </p>
          {isCancelled && member?.member_id && (
            <button
              onClick={async () => {
                if (reapplySubmitting) return;
                setReapplySubmitting(true);
                setReapplyError(null);
                try {
                  const res = await fetch('/api/member/reset-registration', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ member_id: member.member_id }),
                  });
                  if (!res.ok) {
                    setReapplyError('ไม่สามารถเปิดให้สมัครใหม่ได้ กรุณาลองอีกครั้ง');
                    setReapplySubmitting(false);
                    return;
                  }
                } catch {
                  setReapplyError('ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองอีกครั้ง');
                  setReapplySubmitting(false);
                  return;
                }
                window.location.href = '/member/register?reapply=1';
                window.setTimeout(() => {
                  setReapplyError('ไม่สามารถเปิดหน้าสมัครใหม่อัตโนมัติได้ กรุณาลองอีกครั้ง');
                  setReapplySubmitting(false);
                }, 4500);
              }}
              disabled={reapplySubmitting}
              style={{ background:'#2D6A4F', color:'#fff', padding:'14px 32px', borderRadius:12, fontSize:16, fontWeight:700, border:'none', cursor: reapplySubmitting ? 'not-allowed' : 'pointer', opacity: reapplySubmitting ? 0.7 : 1 }}>
              {reapplySubmitting ? 'กำลังเปิดหน้าสมัครใหม่...' : '🌽 กลับไปสมัครใหม่'}
            </button>
          )}
          {reapplyError && (
            <p style={{ marginTop: 10, color: '#c62828', fontSize: 13 }}>{reapplyError}</p>
          )}
        </div>
      </MobileAppShell>
    );
  }

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

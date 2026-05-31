'use client';

import Link                                        from 'next/link';
import { useEffect, useState }                     from 'react';
import { useRouter }                               from 'next/navigation';
import { useAuth, useCurrentMember, useEffectiveRole } from '@/providers/auth-provider';
import { createSupabaseBrowserClient }             from '@/lib/supabase/client';
import { FarmerSmartDashboard }                    from '@/features/farmer-dashboard/farmer-smart-dashboard';
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
type FarmerCardTone = { border: string; bg: string; iconBg: string; iconText: string; shadow: string };

const FARMER_CARD_TONES = {
  field: { border: '#7AC46B', bg: 'linear-gradient(145deg, #F2FBEF 0%, #FFFFFF 100%)', iconBg: '#DFF4D8', iconText: '#236B1F', shadow: 'rgba(46, 125, 50, 0.14)' },
  cycle: { border: '#F2C94C', bg: 'linear-gradient(145deg, #FFF8D9 0%, #FFFFFF 100%)', iconBg: '#FFECA6', iconText: '#8A5A00', shadow: 'rgba(217, 119, 6, 0.16)' },
  seed: { border: '#F6A35A', bg: 'linear-gradient(145deg, #FFF1E6 0%, #FFFFFF 100%)', iconBg: '#FFD9B8', iconText: '#B45309', shadow: 'rgba(234, 88, 12, 0.16)' },
  noBurn: { border: '#B99AF4', bg: 'linear-gradient(145deg, #F4EEFF 0%, #FFFFFF 100%)', iconBg: '#E6DAFF', iconText: '#6D28D9', shadow: 'rgba(109, 40, 217, 0.16)' },
  sale: { border: '#8BC2FF', bg: 'linear-gradient(145deg, #EAF5FF 0%, #FFFFFF 100%)', iconBg: '#D9ECFF', iconText: '#1D4ED8', shadow: 'rgba(37, 99, 235, 0.14)' },
} satisfies Record<string, FarmerCardTone>;

function MenuCard({ href, icon, label, desc, accent, badge, tone }: {
  href: string; icon: string; label: string; desc: string; accent?: boolean;
  badge?: BadgeStyle; tone?: FarmerCardTone;
}) {
  const isFarmerTone = Boolean(tone);
  const cardTone = tone ?? FARMER_CARD_TONES.field;
  return (
    <Link href={href} style={{ textDecoration: 'none', WebkitTapHighlightColor: 'transparent' }}>
      <div style={{
        background: isFarmerTone ? cardTone.bg : 'var(--color-background-primary,#fff)',
        borderRadius: isFarmerTone ? 20 : 14,
        padding: isFarmerTone ? '18px 12px 16px' : '14px 10px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: isFarmerTone ? 8 : 6,
        border: isFarmerTone
          ? (accent ? `2px solid ${cardTone.border}` : `1.5px solid ${cardTone.border}`)
          : (accent ? '1.5px solid #639922' : '0.5px solid #e4ede4'),
        minHeight: isFarmerTone ? 132 : 90, textAlign: 'center', position: 'relative',
        transition: 'transform 0.1s, box-shadow 0.15s',
        boxShadow: isFarmerTone ? `0 8px 22px ${cardTone.shadow}` : 'none',
      }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
        onMouseUp={(e)   => (e.currentTarget.style.transform = 'scale(1)')}>
        {/* Status badge */}
        {badge && (
          <div style={{
            position: isFarmerTone ? 'static' : 'absolute', top: 8, right: 8,
            alignSelf: isFarmerTone ? 'flex-end' : undefined,
            marginBottom: isFarmerTone ? 2 : undefined,
            fontSize: isFarmerTone ? 11 : 9, fontWeight: 800, padding: isFarmerTone ? '4px 8px' : '2px 6px',
            borderRadius: 99, background: badge.bg, color: badge.color,
            display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1.35,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}>
            {badge.label}
          </div>
        )}
        <div style={{
          width: isFarmerTone ? 58 : 44, height: isFarmerTone ? 58 : 44,
          borderRadius: isFarmerTone ? 18 : 12, background: isFarmerTone ? cardTone.iconBg : '#f0faf0', color: cardTone.iconText,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isFarmerTone ? 32 : 24,
          boxShadow: isFarmerTone ? 'inset 0 0 0 1px rgba(255,255,255,0.65)' : 'none',
        }}>
          {icon}
        </div>
        <p style={{ margin: isFarmerTone ? '2px 0 0' : 0, fontWeight: isFarmerTone ? 800 : 500, fontSize: isFarmerTone ? 16 : 13, color: 'var(--color-text-primary,#111)', lineHeight: isFarmerTone ? 1.25 : 1.2 }}>{label}</p>
        <p style={{ margin: 0, fontSize: isFarmerTone ? 13 : 11, fontWeight: isFarmerTone ? 600 : 400, color: 'var(--color-text-secondary,#5f6b5f)', lineHeight: isFarmerTone ? 1.35 : 1.3 }}>{desc}</p>
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
  name, memberId, primaryRole, allRoles, plots, price, quota = null, pictureUrl = null,
}: {
  name: string; memberId: string; primaryRole: AppRole;
  allRoles: AppRole[]; plots: number; price: number | null; quota?: number | null;
  pictureUrl?: string | null;
}) {
  const memberNo = `KF${memberId.slice(-6).toUpperCase()}`;
  const pr = ROLE_COLOR[primaryRole];
  return (
    <div style={{ background: '#f9fafb', borderRadius: 18, padding: '16px', border: '0.5px solid #e4ede4' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {/* avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: pr.bg, border: `2px solid ${pr.text}40`, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: pr.text }}>
            {pictureUrl
              ? <img src={pictureUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} referrerPolicy="no-referrer" />
              : name[0]
            }
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
  const member = useCurrentMember();
  const [plots,         setPlots]         = useState(0);
  const [quota,         setQuota]         = useState<number | null>(null);
  const [cycleStatus,   setCycleStatus]   = useState<string | null>(null);   // active cycle status
  const [noBurnStatus,  setNoBurnStatus]  = useState<string | null>(null);   // latest no-burn status
  const [summary,       setSummary]       = useState<{
    plotCount: number; activeCycle: boolean; noBurnOk: boolean; quotaKg: number | null;
  } | null>(null);

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

      // Summary numbers
      const { data: quotaData } = await s.from('planting_cycles')
        .select('quota_kg').eq('member_id', memberId)
        .not('status','in','(harvested,cancelled)').limit(1).maybeSingle();
      setSummary({
        plotCount:   plots,
        activeCycle: !!cycleRes.data,
        noBurnOk:    ['approved','completed'].includes(noBurnRes.data?.status ?? ''),
        quotaKg:     quotaData?.quota_kg ?? null,
      });

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
    approved:            { label: '✅ ลงทะเบียนแล้ว', color: '#27500A', bg: '#EAF3DE' },
    completed:           { label: '✅ เสร็จสิ้น',   color: '#27500A', bg: '#EAF3DE' },
    rejected:            { label: 'ไม่ผ่าน',       color: '#444441', bg: '#F1EFE8' },
  };

  const plotBadge: BadgeStyle = plots > 0
    ? { label: '✅ ลงทะเบียนแล้ว', color: '#27500A', bg: '#EAF3DE' }
    : { label: '⚠️ เพิ่มแปลง', color: '#854F0B', bg: '#FFF4D6' };

  const cycleBadge: BadgeStyle = cycleStatus
    ? { label: `✅ ${CYCLE_STATUS_TH[cycleStatus] ?? cycleStatus}`, color: '#27500A', bg: '#EAF3DE' }
    : { label: '⚠️ ยังไม่สร้างรอบปลูก', color: '#8A5A00', bg: '#FFF4D6' };

  const noBurnBadge: BadgeStyle = noBurnStatus
    ? (NO_BURN_STATUS_TH[noBurnStatus] ?? { label: noBurnStatus, color: '#633806', bg: '#FAEEDA' })
    : { label: '🔥 สมัครไม่เผาได้', color: '#6D28D9', bg: '#F4EEFF' };

  const saleBadge: BadgeStyle = { label: '📅 มีนัดขาย', color: '#1D4ED8', bg: '#EAF5FF' };

  const FARMER_MENU_GROUPS = [
    {
      group: '🌱 การปลูก',
      accentColor: '#2e7d32',
      items: [
        { href: '/plots',                icon: '🗺️', label: 'แปลงของฉัน',     desc: plots > 0 ? `${plots} แปลง` : 'ดูข้อมูลแปลงและพิกัด', badge: plotBadge, tone: FARMER_CARD_TONES.field },
        { href: '/planting-cycles',      icon: '🌽', label: 'ฤดูปลูก',         desc: 'ติดตามรอบปลูกล่าสุด', badge: cycleBadge, tone: FARMER_CARD_TONES.cycle },
        { href: '/service/reservations', icon: '🌱', label: 'จองเมล็ดพันธุ์', desc: 'เลือกพันธุ์และจำนวนถุง', accent: true, tone: FARMER_CARD_TONES.seed },
        { href: '/planting-cycles/new',  icon: '➕', label: 'แจ้งปลูกใหม่',   desc: 'สร้างรอบปลูกได้ทันที', tone: FARMER_CARD_TONES.cycle },
      ],
    },
    {
      group: '💰 ขายผลผลิต',
      accentColor: '#1565c0',
      items: [
        { href: '/harvest/book',       icon: '🚜', label: 'แจ้งวันเกี่ยว',   desc: 'จองคิวรับซื้อผลผลิต', badge: saleBadge, tone: FARMER_CARD_TONES.sale },
        { href: '/plots',              icon: '📅', label: 'นัดวันขาย',        desc: 'ดูรอบนัดหมายขาย', tone: FARMER_CARD_TONES.sale },
        { href: '/harvest/calculator', icon: '💧', label: 'คำนวณชื้น/บาท',   desc: 'อ่านง่ายกลางแจ้ง', tone: FARMER_CARD_TONES.sale },
        { href: '/planting-cycles',    icon: '📊', label: 'ประวัติยอดขาย',   desc: 'สรุปรายได้จากฤดูปลูก', tone: FARMER_CARD_TONES.sale },
      ],
    },
    {
      group: '🌿 โครงการไม่เผา',
      accentColor: '#6D28D9',
      items: [
        { href: '/no-burn', icon: '🔥', label: 'ไม่เผา', desc: 'สมัครและติดตามสถานะ', badge: noBurnBadge, tone: FARMER_CARD_TONES.noBurn },
        { href: '/no-burn', icon: '📸', label: 'ส่งรูปหลักฐาน',  desc: 'อัปโหลดรูปแปลงงดเผา', tone: FARMER_CARD_TONES.noBurn },
      ],
    },
  ];

  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <HeroCard name={name} memberId={memberId} primaryRole="farmer" allRoles={allRoles} plots={plots} price={null} quota={quota} pictureUrl={member?.picture_url ?? null} />

        {/* ── Smart dashboard: greeting + todos + plot cards ── */}
        <FarmerSmartDashboard name={name} memberId={memberId} />



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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <HeroCard name={name} memberId={memberId} primaryRole="truck_owner" allRoles={allRoles} plots={0} price={null} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
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

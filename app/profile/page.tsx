'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCurrentMember, useCurrentRoles, useEffectiveRole } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { MemberAnnouncementsList } from '@/features/member-announcements/member-announcements-list';

const ROLE_TH: Record<string, string> = {
  farmer: '🌽 เกษตรกร', truck_owner: '🚛 ทีมบริการ',
  inspector: '🔍 ผู้ตรวจสอบ', staff: '👷 เจ้าหน้าที่',
  leader: '👥 หัวหน้ากลุ่ม', admin: '⚙️ แอดมิน',
};
const ROLE_COLOR: Record<string, { bg: string; text: string }> = {
  farmer:     { bg: '#EAF3DE', text: '#3B6D11' },
  staff:      { bg: '#E6F1FB', text: '#185FA5' },
  inspector:  { bg: '#EEEDFE', text: '#534AB7' },
  leader:     { bg: '#EEEDFE', text: '#534AB7' },
  truck_owner:{ bg: '#FFF8DB', text: '#B45309' },
  admin:      { bg: '#FCE8F3', text: '#9D174D' },
};
const STATUS_CFG: Record<string, { label: string; color: string }> = {
  approved:         { label: '✅ อนุมัติแล้ว',    color: '#3B6D11' },
  pending_approval: { label: '⏳ รออนุมัติ',       color: '#B45309' },
  rejected:         { label: '❌ ไม่ผ่านการอนุมัติ', color: '#991B1B' },
  suspended:        { label: '⚠️ ถูกระงับ',         color: '#991B1B' },
};

type MemberData = {
  full_name: string; phone: string | null; address: string | null;
  citizen_id_masked: string | null; status: string;
  bank_name: string | null; bank_account_number: string | null; bank_account_name: string | null;
};
type PlotSummary  = { id: string; name: string; area_rai: number; lat: number; lng: number; status: string };
type CreditAccount= { balance: number; debit_balance: number; total_spent: number };
type DocRow       = { doc_type: string; verified: boolean; file_url: string | null };
type ProviderRequestRow = {
  id: string;
  request_type: 'service_team' | 'field_team';
  status: 'pending' | 'approved' | 'rejected' | string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};
type MemberLiveSnapshot = {
  activeAnnouncements: number;
  pendingSurveys: number;
  nextHarvestBooking: { scheduled_date: string; status: string } | null;
  activeCycles: number;
  completedCycles: number;
};

const DOC_LABEL: Record<string, string> = {
  thai_id_card: '🪪 บัตรประชาชน',
  farmer_card:  '📗 ทะเบียนเกษตรกร',
  land_doc:     '📄 โฉนด/นส.3',
  vehicle_reg:  '🚜 ทะเบียนรถ',
  other:        '📎 เอกสารอื่น',
};

const S = {
  card: { background: 'var(--color-background-primary,#fff)', borderRadius: 14, border: '0.5px solid var(--color-border-tertiary,#e4ede4)', overflow: 'hidden' as const },
  sectionLabel: { fontSize: 11, color: 'var(--color-text-secondary,#888)', fontWeight: 500 as const, letterSpacing: '.04em', margin: '0 0 8px' },
  row: { display: 'flex' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, padding: '10px 0', borderBottom: '0.5px solid var(--color-border-tertiary,#e4ede4)' },
};

const PROVIDER_STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending: { label: '⏳ รออนุมัติ', color: '#B45309' },
  approved: { label: '✅ อนุมัติแล้ว', color: '#3B6D11' },
  rejected: { label: '❌ ไม่ผ่านการอนุมัติ', color: '#991B1B' },
};

const PROVIDER_ROLE_BY_TYPE: Record<'service_team' | 'field_team', 'truck_owner' | 'inspector'> = {
  service_team: 'truck_owner',
  field_team: 'inspector',
};

const PROVIDER_TYPE_LABEL: Record<'service_team' | 'field_team', string> = {
  service_team: 'ทีมบริการรถ',
  field_team: 'ทีมตรวจแปลง',
};

export default function ProfilePage() {
  const member        = useCurrentMember();
  const roles         = useCurrentRoles();
  const effectiveRole = useEffectiveRole();
  const [data,   setData]   = useState<MemberData | null>(null);
  const [plots,  setPlots]  = useState<PlotSummary[]>([]);
  const [credit, setCredit] = useState<CreditAccount | null>(null);
  const [docs,   setDocs]   = useState<DocRow[]>([]);
  const [providerRequests, setProviderRequests] = useState<ProviderRequestRow[]>([]);
  const [live, setLive] = useState<MemberLiveSnapshot | null>(null);

  useEffect(() => {
    if (!member?.member_id) return;
    const s = createSupabaseBrowserClient();
    let cancelled = false;

    void (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data: { session } } = await s.auth.getSession();
      const authHeaders = session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined;
      const [
        m, p, d, cr, pr,
        announcementRes, surveysRes, responsesRes, nextBookingRes, cyclesRes,
      ] = await Promise.all([
        s.from('members').select('full_name,phone,address,citizen_id_masked,status,bank_name,bank_account_number,bank_account_name').eq('id', member.member_id).maybeSingle(),
        fetch('/api/member/plots', { headers: authHeaders }).then((r) => r.json()),
        s.from('member_documents').select('doc_type,verified,file_url').eq('member_id', member.member_id),
        fetch('/api/member/credit').then((r) => r.json()),
        s.from('provider_requests')
          .select('id,request_type,status,reviewed_by,reviewed_at,created_at')
          .eq('member_id', member.member_id)
          .in('request_type', ['service_team', 'field_team'])
          .order('created_at', { ascending: false }),
        s.from('campaign_announcements').select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .lte('start_date', today)
          .gte('end_date', today),
        fetch('/api/member/surveys').then((r) => r.ok ? r.json() : { surveys: [] }),
        s.from('survey_responses').select('survey_id').eq('member_id', member.member_id),
        s.from('harvest_bookings').select('scheduled_date,status')
          .eq('member_id', member.member_id)
          .in('status', ['pending', 'confirmed'])
          .gte('scheduled_date', today)
          .order('scheduled_date', { ascending: true }).limit(1).maybeSingle(),
        s.from('planting_cycles').select('id,status').eq('member_id', member.member_id).is('deleted_at', null),
      ]);
      if (cancelled) return;
      setData((m.data as MemberData | null));
      setPlots(((p as { plots?: PlotSummary[] }).plots ?? []));
      setDocs((d.data as DocRow[] | null) ?? []);
      setCredit((cr as { account?: CreditAccount }).account ?? null);
      setProviderRequests(((pr.data as ProviderRequestRow[] | null) ?? []));
      const surveys = ((surveysRes as { surveys?: Array<{ id: string }> }).surveys ?? []);
      const completedSurveyIds = new Set(
        ((responsesRes.data as Array<{ survey_id: string }> | null) ?? []).map((row) => row.survey_id),
      );
      const pendingSurveys = surveys.filter((survey) => !completedSurveyIds.has(survey.id)).length;
      const cycles = (cyclesRes.data as Array<{ status: string }> | null) ?? [];
      setLive({
        activeAnnouncements: announcementRes.count ?? 0,
        pendingSurveys,
        nextHarvestBooking: (nextBookingRes.data as { scheduled_date: string; status: string } | null) ?? null,
        activeCycles: cycles.filter((cycle) => cycle.status !== 'completed').length,
        completedCycles: cycles.filter((cycle) => cycle.status === 'completed').length,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [member?.member_id]);

  if (!member || !data) return <LoadingState label="กำลังโหลด…" />;

  const memberId  = member.member_id;
  const initials  = data.full_name.trim().split(' ').map((w) => w[0]).slice(0, 2).join('');
  const pr        = ROLE_COLOR[effectiveRole ?? 'farmer'] ?? ROLE_COLOR.farmer;
  const statusCfg = STATUS_CFG[data.status] ?? { label: data.status, color: '#888' };
  const latestProviderByType = (['service_team', 'field_team'] as const)
    .map((requestType) => providerRequests.find((item) => item.request_type === requestType))
    .filter(Boolean) as ProviderRequestRow[];

  return (
    <ProtectedRoute allowPending>
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 16 }}>

        <MemberAnnouncementsList />
        {live && (
          <div style={{ ...S.card, padding: 14, display: 'grid', gap: 10 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>สรุปข้อมูลล่าสุดของคุณ</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div style={{ background: '#f8fafc', borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>ประกาศที่ยังใช้งาน</p>
                <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700 }}>{live.activeAnnouncements} รายการ</p>
              </div>
              <div style={{ background: live.pendingSurveys > 0 ? '#fff7ed' : '#f8fafc', borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>แบบสำรวจที่รอตอบ</p>
                <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 700 }}>{live.pendingSurveys} รายการ</p>
              </div>
            </div>
            <div style={{ borderTop: '0.5px solid var(--color-border-tertiary,#e4ede4)', paddingTop: 10 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>สถานะเก็บเกี่ยว / รอบปลูก</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#111827' }}>
                {live.nextHarvestBooking
                  ? `นัดเก็บเกี่ยวถัดไป ${new Date(live.nextHarvestBooking.scheduled_date).toLocaleDateString('th-TH')} (${live.nextHarvestBooking.status})`
                  : 'ยังไม่มีนัดเก็บเกี่ยวที่รอดำเนินการ'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#111827' }}>
                รอบปลูกที่กำลังเดินงาน {live.activeCycles} รอบ · เสร็จสิ้นแล้ว {live.completedCycles} รอบ
              </p>
            </div>
            {live.pendingSurveys > 0 ? (
              <Link href="/member/surveys" style={{ fontSize: 13, color: '#185FA5', textDecoration: 'none', fontWeight: 600 }}>
                ไปตอบแบบสำรวจล่าสุด →
              </Link>
            ) : (
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>ตอนนี้ไม่มีแบบสำรวจค้างตอบ</p>
            )}
          </div>
        )}

        {/* ── Hero ── */}
        <div style={{ ...S.card, padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: pr.bg, border: `2px solid ${pr.text}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 500, color: pr.text, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>{data.full_name}</p>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-text-secondary,#888)', fontFamily: 'monospace' }}>KF{memberId.slice(-6).toUpperCase()}</p>
              <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                {(roles as string[]).map((r) => (
                  <span key={r} style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: ROLE_COLOR[r]?.bg ?? '#f0f0f0', color: ROLE_COLOR[r]?.text ?? '#333' }}>
                    {ROLE_TH[r] ?? r}
                  </span>
                ))}
              </div>
            </div>
            <Link href="/profile/edit" style={{ background: 'var(--color-background-secondary,#f9fafb)', border: '0.5px solid var(--color-border-tertiary,#e4ede4)', borderRadius: 10, padding: '8px 12px', color: 'var(--color-text-primary,#111)', fontSize: 13, fontWeight: 500, textDecoration: 'none', flexShrink: 0 }}>
              ✏️ แก้ไข
            </Link>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTop: '0.5px solid var(--color-border-tertiary,#e4ede4)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>สถานะสมาชิก</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: statusCfg.color }}>{statusCfg.label}</span>
          </div>
        </div>

        {/* ── สถานะผู้ให้บริการ ── */}
        {latestProviderByType.length > 0 && (
          <div>
            <p style={S.sectionLabel}>สถานะผู้ให้บริการ</p>
            <div style={{ ...S.card, padding: '0 14px' }}>
              {latestProviderByType.map((item, i) => {
                const cfg = PROVIDER_STATUS_CFG[item.status] ?? { label: item.status, color: '#666' };
                const grantedRole = item.status === 'approved' ? PROVIDER_ROLE_BY_TYPE[item.request_type] : null;
                return (
                  <div key={item.id} style={{ ...S.row, alignItems: 'flex-start', flexDirection: 'column', gap: 4, borderBottom: i < latestProviderByType.length - 1 ? undefined : 'none' }}>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-primary,#111)' }}>{PROVIDER_TYPE_LABEL[item.request_type]}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    {grantedRole && (
                      <div style={{ fontSize: 12, color: '#444' }}>Role ที่ได้รับ: <span style={{ fontFamily: 'monospace' }}>{grantedRole}</span></div>
                    )}
                    {item.reviewed_by && (
                      <div style={{ fontSize: 12, color: '#666' }}>Reviewed by: {item.reviewed_by}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── แปลงของฉัน ── */}
        <div>
          <p style={S.sectionLabel}>แปลงของฉัน</p>
          <div style={{ ...S.card }}>
            <div style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>🌽</span>
                <div>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 15, color: 'var(--color-text-primary,#111)' }}>{plots.length} แปลง</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary,#888)' }}>
                    {plots.length > 0
                      ? `รวม ${plots.reduce((s, p) => s + (p.area_rai ?? 0), 0).toLocaleString()} ไร่`
                      : 'ยังไม่มีแปลง'}
                  </p>
                </div>
              </div>
              <Link href="/plots/add" style={{ background: '#EAF3DE', border: '0.5px solid #A3C78A', borderRadius: 10, padding: '7px 14px', color: '#3B6D11', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                + เพิ่มแปลง
              </Link>
            </div>
            {plots.length > 0 && (
              <div style={{ borderTop: '0.5px solid var(--color-border-tertiary,#e4ede4)' }}>
                {plots.slice(0, 3).map((pl, i) => {
                  const stLabel: Record<string, string> = { active: '', pending_review: '⏳', rejected: '❌', inactive: '⏸' };
                  return (
                    <div key={pl.id} style={{ padding: '9px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: i < Math.min(plots.length, 3) - 1 ? '0.5px solid var(--color-border-tertiary,#e4ede4)' : 'none' }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-primary,#111)' }}>📍 {pl.name} {stLabel[pl.status] ?? ''}</span>
                      <span style={{ fontSize: 13, color: 'var(--color-text-secondary,#888)' }}>{pl.area_rai} ไร่</span>
                    </div>
                  );
                })}
                {plots.length > 3 && (
                  <Link href="/plots" style={{ display: 'block', padding: '9px 14px', textAlign: 'center', fontSize: 13, color: '#185FA5', textDecoration: 'none' }}>
                    ดูทั้งหมด {plots.length} แปลง ›
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── ข้อมูลส่วนตัว ── */}
        <div>
          <p style={S.sectionLabel}>ข้อมูลส่วนตัว</p>
          <div style={{ ...S.card, padding: '0 14px' }}>
            {[
              ['📞 เบอร์โทร',     data.phone          ?? '—'],
              ['🪪 เลขบัตร',      data.citizen_id_masked ?? '—'],
              ['📍 ที่อยู่',      data.address         ?? '—'],
            ].map(([label, value], i, arr) => (
              <div key={label} style={{ ...S.row, borderBottom: i < arr.length - 1 ? undefined : 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary,#888)' }}>{label}</span>
                <span style={{ fontSize: 13, color: 'var(--color-text-primary,#111)', fontWeight: 500, maxWidth: '60%', textAlign: 'right', overflowWrap: 'anywhere', lineHeight: 1.45 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── บัญชีธนาคาร ── */}
        <div>
          <p style={S.sectionLabel}>บัญชีธนาคาร</p>
          <div style={{ ...S.card, padding: '0 14px' }}>
            {data.bank_name || data.bank_account_number ? (
              <>
                {[
                  ['🏦 ธนาคาร',   data.bank_name           ?? '—'],
                  ['💳 เลขบัญชี', data.bank_account_number  ?? '—'],
                  ['👤 ชื่อบัญชี', data.bank_account_name   ?? '—'],
                ].map(([label, value], i, arr) => (
                  <div key={label} style={{ ...S.row, borderBottom: i < arr.length - 1 ? undefined : 'none' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary,#888)' }}>{label}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-primary,#111)', fontWeight: 500, overflowWrap: 'anywhere', textAlign: 'right', maxWidth: '60%', lineHeight: 1.45 }}>{value}</span>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ padding: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary,#888)' }}>ยังไม่มีข้อมูลบัญชี</span>
                <Link href="/profile/edit" style={{ fontSize: 13, color: '#185FA5', textDecoration: 'none', fontWeight: 500 }}>+ เพิ่ม</Link>
              </div>
            )}
          </div>
        </div>

        {/* ── เอกสาร ── */}
        <div>
          <p style={S.sectionLabel}>เอกสารประกอบ</p>
          <div style={{ ...S.card, padding: '0 14px' }}>
            {docs.length === 0 ? (
              <div style={{ padding: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary,#888)' }}>ยังไม่มีเอกสาร</span>
                <Link href="/profile/edit" style={{ fontSize: 13, color: '#185FA5', textDecoration: 'none', fontWeight: 500 }}>+ อัปโหลด</Link>
              </div>
            ) : (
              docs.map((d, i) => (
                <div key={d.doc_type + i} style={{ ...S.row, borderBottom: i < docs.length - 1 ? undefined : 'none' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary,#111)' }}>{DOC_LABEL[d.doc_type] ?? d.doc_type}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: d.verified ? '#3B6D11' : '#B45309' }}>
                    {d.verified ? '✅ ยืนยันแล้ว' : '⏳ รอตรวจสอบ'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── เครดิต ── */}
        {credit && (credit.debit_balance > 0 || credit.balance > 0) && (
          <div>
            <p style={S.sectionLabel}>ยอดบัญชี</p>
            <div style={{ ...S.card, padding: '0 14px' }}>
              {credit.debit_balance > 0 && (
                <div style={{ ...S.row }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary,#888)' }}>💳 ค้างชำระ</span>
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#991B1B' }}>{credit.debit_balance.toLocaleString()} บาท</span>
                </div>
              )}
              {credit.balance > 0 && (
                <div style={{ ...S.row }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary,#888)' }}>💰 เครดิตคงเหลือ</span>
                  <span style={{ fontSize: 15, fontWeight: 500, color: '#3B6D11' }}>{credit.balance.toLocaleString()} บาท</span>
                </div>
              )}
              <div style={{ ...S.row, borderBottom: 'none' }}>
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary,#888)' }}>📊 รวมซื้อทั้งหมด</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>{credit.total_spent.toLocaleString()} บาท</span>
              </div>
            </div>
          </div>
        )}

        {/* ── เมนูเพิ่มเติม ── */}
        <div>
          <p style={S.sectionLabel}>เมนู</p>
          <div style={{ ...S.card, padding: '0' }}>
            {[
              { href: '/planting-cycles', icon: '🌱', label: 'รอบเพาะปลูก', show: ['farmer','leader'] },
              { href: '/no-burn',         icon: '🌿', label: 'ประวัติไม่เผา', show: ['farmer','leader'] },
              { href: '/truck',           icon: '🚛', label: 'งานรถ',          show: ['truck_owner'] },
            ].filter((item) => !effectiveRole || item.show.includes(effectiveRole))
             .map((item, i, arr) => (
              <Link key={item.href} href={item.href}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: i < arr.length - 1 ? '0.5px solid var(--color-border-tertiary,#e4ede4)' : 'none', textDecoration: 'none', color: 'var(--color-text-primary,#111)' }}>
                <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{item.label}</span>
                <span style={{ color: 'var(--color-text-secondary,#888)', fontSize: 18 }}>›</span>
              </Link>
            ))}
            <button onClick={() => { if (window.confirm('ออกจากระบบ?')) window.location.reload(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', width: '100%', background: 'none', border: 'none', borderTop: '0.5px solid var(--color-border-tertiary,#e4ede4)', cursor: 'pointer', color: '#991B1B', textAlign: 'left' }}>
              <span style={{ fontSize: 20, width: 28, textAlign: 'center' }}>🚪</span>
              <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>ออกจากระบบ</span>
            </button>
          </div>
        </div>

      </div>
    </MobileAppShell>
    </ProtectedRoute>
  );
}

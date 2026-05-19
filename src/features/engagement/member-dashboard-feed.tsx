'use client';

// ─────────────────────────────────────────────────────────────────────────────
// MemberDashboardFeed — P1.5 Engagement MVP
//
// Five read-only status widgets for the farmer home screen.
// Reuses existing tables only — no new APIs, no migration, no auth changes.
//
// Widgets:
//   1. MemberStatusCard      — member approval status
//   2. CropSeasonWidget      — latest active planting cycle
//   3. NoBurnStatusWidget    — latest no-burn request status
//   4. AnnouncementCard      — static notice (no announcements table yet)
//   5. PriceNoticeCard       — latest market_price for primary crop
//
// All queries: browser Supabase client, read-only, RLS-controlled.
// Bundle impact: minimal — 5 small cards, no heavy deps.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember }            from '@/providers/auth-provider';
import Link                            from 'next/link';

// ─────────────────────────────────────────────────────────────────────────────
// 1. MemberStatusCard
// ─────────────────────────────────────────────────────────────────────────────
const MEMBER_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  approved:  { bg: '#f0fdf4', color: '#2e7d32', label: '✅ อนุมัติแล้ว' },
  pending:   { bg: '#fffbeb', color: '#b45309', label: '⏳ รอการอนุมัติ' },
  rejected:  { bg: '#fef2f2', color: '#dc2626', label: '⛔ ไม่ผ่านการอนุมัติ' },
  suspended: { bg: '#f5f5f5', color: '#6b7280', label: '🔒 ระงับการใช้งาน' },
};

export function MemberStatusCard() {
  const member = useCurrentMember();
  if (!member) return null;

  const st = MEMBER_STATUS_STYLE[member.status] ?? { bg: '#f9fafb', color: '#6b7280', label: member.status };

  return (
    <div style={{
      background: st.bg, borderRadius: 12,
      padding: '12px 14px', border: `1px solid ${st.color}33`,
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>สถานะสมาชิก</p>
        <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 14, color: st.color }}>
          {st.label}
        </p>
      </div>
      {member.status === 'pending' && (
        <Link href="/profile" style={{ fontSize: 12, color: '#1565c0', fontWeight: 600 }}>
          ดูรายละเอียด →
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CropSeasonWidget — latest active planting cycle
// ─────────────────────────────────────────────────────────────────────────────
const CYCLE_STATUS_TH: Record<string, string> = {
  planned:   '📋 วางแผน',
  planted:   '🌱 ปลูกแล้ว',
  growing:   '🌿 กำลังโต',
  flowering: '🌸 ออกดอก',
  maturing:  '🌽 กำลังแก่',
  ready:     '✅ พร้อมเก็บ',
  harvested: '🏁 เก็บเกี่ยวแล้ว',
  cancelled: '⛔ ยกเลิก',
};

type CycleRow = {
  id: string; crop_name: string; season_year: number; status: string;
  area_planted_rai: number | null; expected_harvest_at: string | null;
};

export function CropSeasonWidget({ memberId }: { memberId: string }) {
  const [cycle,   setCycle]   = useState<CycleRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s
        .from('planting_cycles')
        .select('id,crop_name,season_year,status,area_planted_rai,expected_harvest_at')
        .eq('member_id', memberId)
        .not('status', 'in', '("harvested","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setCycle(data as CycleRow | null);
      setLoading(false);
    })();
  }, [memberId]);

  if (loading || !cycle) return null;

  const daysLeft = cycle.expected_harvest_at
    ? Math.round((new Date(cycle.expected_harvest_at).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <Link href={`/planting-cycles/${cycle.id}`} style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#f0fdf4', borderRadius: 12,
        padding: '12px 14px', border: '1px solid #bbf7d0',
      }}>
        <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>ฤดูกาลปัจจุบัน</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#14532d' }}>
              {cycle.crop_name} {cycle.season_year}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#166534' }}>
              {CYCLE_STATUS_TH[cycle.status] ?? cycle.status}
              {cycle.area_planted_rai ? ` · ${cycle.area_planted_rai} ไร่` : ''}
            </p>
            {daysLeft !== null && daysLeft > 0 && (
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
                เก็บเกี่ยวใน {daysLeft} วัน
              </p>
            )}
          </div>
          <span style={{ fontSize: 20, color: '#86efac' }}>›</span>
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. NoBurnStatusWidget — latest no-burn request
// ─────────────────────────────────────────────────────────────────────────────
const NO_BURN_STATUS_TH: Record<string, string> = {
  submitted:           '⏳ รอตรวจสอบ',
  under_review:        '🔍 กำลังตรวจสอบ',
  inspection_required: '📋 ต้องตรวจแปลง',
  approved:            '✅ อนุมัติแล้ว',
  rejected:            '⛔ ไม่ผ่าน',
  completed:           '🏁 เสร็จสิ้น',
  anomaly:             '⚠️ พบเหตุผิดปกติ',
  seeking_support:     '🤝 รับคำแนะนำ',
};

const NO_BURN_COLOR: Record<string, string> = {
  approved: '#2e7d32', completed: '#1b5e20',
  rejected: '#9e9e9e', anomaly: '#b45309', seeking_support: '#0369a1',
};

type NoBurnRow = { id: string; status: string; submitted_at: string };

export function NoBurnStatusWidget({ memberId }: { memberId: string }) {
  const [req,     setReq]     = useState<NoBurnRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s
        .from('no_burn_requests')
        .select('id,status,submitted_at')
        .eq('member_id', memberId)
        .is('deleted_at', null)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setReq(data as NoBurnRow | null);
      setLoading(false);
    })();
  }, [memberId]);

  if (loading) return null;

  if (!req) {
    return (
      <Link href="/no-burn" style={{ textDecoration: 'none' }}>
        <div style={{
          background: '#f9fafb', borderRadius: 12,
          padding: '12px 14px', border: '1px dashed #d1d5db',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>โครงการไม่เผา</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#374151', fontWeight: 600 }}>
              ยังไม่ได้สมัคร
            </p>
          </div>
          <span style={{ fontSize: 13, color: '#2e7d32', fontWeight: 700 }}>สมัครเลย →</span>
        </div>
      </Link>
    );
  }

  const color = NO_BURN_COLOR[req.status] ?? '#e65100';
  return (
    <Link href="/no-burn" style={{ textDecoration: 'none' }}>
      <div style={{
        background: '#f0fdf4', borderRadius: 12,
        padding: '12px 14px', border: `1px solid ${color}33`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>โครงการไม่เผา</p>
          <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 14, color }}>
            {NO_BURN_STATUS_TH[req.status] ?? req.status}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
            ยื่น {new Date(req.submitted_at).toLocaleDateString('th-TH', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </p>
        </div>
        <span style={{ fontSize: 20, color: '#86efac' }}>›</span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. AnnouncementCard — static notice (no announcements table yet)
//    Replace content here when announcements table is ready.
// ─────────────────────────────────────────────────────────────────────────────
const STATIC_ANNOUNCEMENT = {
  title: '📢 เปิดรับจองเมล็ดพันธุ์',
  body:  'สมาชิกที่สนใจจองเมล็ดพันธุ์ข้าวโพดฤดูกาลใหม่ สามารถสั่งจองได้แล้ววันนี้',
  href:  '/service/booking',
  cta:   'ดูรายละเอียด →',
};

export function AnnouncementCard() {
  return (
    <div style={{
      background: '#eff6ff', borderRadius: 12,
      padding: '12px 14px', border: '1px solid #bfdbfe',
    }}>
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#1e40af' }}>
        {STATIC_ANNOUNCEMENT.title}
      </p>
      <p style={{ margin: '0 0 8px', fontSize: 13, color: '#1e3a8a', lineHeight: 1.5 }}>
        {STATIC_ANNOUNCEMENT.body}
      </p>
      <Link href={STATIC_ANNOUNCEMENT.href}
        style={{ fontSize: 13, fontWeight: 700, color: '#1d4ed8' }}>
        {STATIC_ANNOUNCEMENT.cta}
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. PriceNoticeCard — latest market_price for primary crop
// ─────────────────────────────────────────────────────────────────────────────
type PriceRow = {
  crop_type: string; price_per_kg: number; effective_date: string; note: string | null;
};

export function PriceNoticeCard({ primaryCrop = 'ข้าวโพด' }: { primaryCrop?: string }) {
  const [price,   setPrice]   = useState<PriceRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s
        .from('market_prices')
        .select('crop_type,price_per_kg,effective_date,note')
        .eq('crop_type', primaryCrop)
        .eq('is_active', true)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      setPrice(data as PriceRow | null);
      setLoading(false);
    })();
  }, [primaryCrop]);

  if (loading || !price) return null;

  return (
    <div style={{
      background: '#fefce8', borderRadius: 12,
      padding: '12px 14px', border: '1px solid #fde047',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>ราคารับซื้อ{price.crop_type}</p>
        <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 20, color: '#713f12' }}>
          {Number(price.price_per_kg).toFixed(2)}{' '}
          <span style={{ fontSize: 12, fontWeight: 400, color: '#92400e' }}>บาท/กก.</span>
        </p>
        {price.note && (
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#92400e' }}>{price.note}</p>
        )}
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>
          {new Date(price.effective_date).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'short',
          })}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MemberDashboardFeed — compose all 5 widgets
// ─────────────────────────────────────────────────────────────────────────────
export function MemberDashboardFeed({ memberId }: { memberId: string }) {
  const member = useCurrentMember();
  if (!member?.is_approved) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <MemberStatusCard />
      <CropSeasonWidget memberId={memberId} />
      <NoBurnStatusWidget memberId={memberId} />
      <AnnouncementCard />
      <PriceNoticeCard />
    </div>
  );
}

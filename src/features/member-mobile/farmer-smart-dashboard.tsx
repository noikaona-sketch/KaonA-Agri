'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { buildFarmerReminders, ReminderSection, type FarmerReminder } from './farmer-reminders';
import {
  PlotProgressCards,
  type FarmerCycleSummary,
  type FarmerHarvestBookingSummary,
  type FarmerNoBurnSummary,
  type FarmerPlotSummary,
} from './plot-progress-cards';

const ACTIVE_CYCLE_STATUSES = ['planned','pending','active','confirmed','planted','growing','flowering','maturing','fruiting','ready'];
const ACTIVE_NO_BURN_STATUSES = ['submitted','under_review','inspection_required','approved','completed'];
const ACTIVE_BOOKING_STATUSES = ['pending','confirmed'];

export type FarmerDashboardData = {
  plotsCount: number;
  plotCards: FarmerPlotSummary[];
  cycles: FarmerCycleSummary[];
  noBurnRequests: FarmerNoBurnSummary[];
  bookings: FarmerHarvestBookingSummary[];
  hasSeedReservation: boolean;
  quota: number | null;
  cycleStatus: string | null;
  noBurnStatus: string | null;
  reminders: FarmerReminder[];
};

const INITIAL_DASHBOARD_DATA: FarmerDashboardData = {
  plotsCount: 0,
  plotCards: [],
  cycles: [],
  noBurnRequests: [],
  bookings: [],
  hasSeedReservation: false,
  quota: null,
  cycleStatus: null,
  noBurnStatus: null,
  reminders: [],
};

function useFarmerDashboardData(memberId: string) {
  const [data, setData] = useState<FarmerDashboardData>(INITIAL_DASHBOARD_DATA);

  useEffect(() => {
    if (!memberId) return;
    const s = createSupabaseBrowserClient();
    void (async () => {
      const sessionRes = await s.auth.getSession();
      const accessToken = sessionRes.data.session?.access_token;
      const today = new Date().toISOString().slice(0, 10);
      const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;

      const plotsPromise = accessToken
        ? fetch('/api/member/plots', { headers: authHeaders }).then((r) => r.ok ? r.json() : { plots: [] })
        : s.from('plots').select('id,name,area_rai,status').eq('member_id', memberId).is('deleted_at', null).order('created_at', { ascending: false });

      const [plotsRes, cycleRes, noBurnRes, bookingRes, seedRes] = await Promise.all([
        plotsPromise,
        s.from('planting_cycles')
          .select('id,plot_id,status,expected_harvest_at,crop_name')
          .eq('member_id', memberId)
          .in('status', ACTIVE_CYCLE_STATUSES)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(20),
        s.from('no_burn_requests')
          .select('id,plot_id,status')
          .eq('member_id', memberId)
          .in('status', ACTIVE_NO_BURN_STATUSES)
          .is('deleted_at', null)
          .order('submitted_at', { ascending: false })
          .limit(20),
        s.from('harvest_bookings')
          .select('id,plot_id,planting_cycle_id,scheduled_date,status')
          .eq('member_id', memberId)
          .in('status', ACTIVE_BOOKING_STATUSES)
          .gte('scheduled_date', today)
          .order('scheduled_date', { ascending: true })
          .limit(10),
        s.from('seed_reservations')
          .select('id', { count: 'exact', head: true })
          .eq('member_id', memberId)
          .in('status', ACTIVE_BOOKING_STATUSES),
      ]);

      const plotList = Array.isArray((plotsRes as { plots?: FarmerPlotSummary[] }).plots)
        ? ((plotsRes as { plots: FarmerPlotSummary[] }).plots)
        : (((plotsRes as { data?: FarmerPlotSummary[] }).data) ?? []);
      const activePlots = plotList.filter((plot) => plot.status !== 'deleted');
      const cycles = ((cycleRes.data ?? []) as FarmerCycleSummary[]);
      const noBurnRequests = ((noBurnRes.data ?? []) as FarmerNoBurnSummary[]);
      const bookings = ((bookingRes.data ?? []) as FarmerHarvestBookingSummary[]);
      const hasSeedReservation = (seedRes.count ?? 0) > 0;

      setData((current) => ({
        ...current,
        plotsCount: activePlots.length,
        plotCards: activePlots,
        cycles,
        noBurnRequests,
        bookings,
        hasSeedReservation,
        cycleStatus: cycles[0]?.status ?? null,
        noBurnStatus: noBurnRequests[0]?.status ?? null,
        reminders: buildFarmerReminders({ plotCards: activePlots, cycles, noBurnRequests, bookings, hasSeedReservation }),
      }));

      // ดึง quota ถ้ามี session (ใช้ token ที่ได้จากด้านบน)
      if (accessToken) {
        void fetch('/api/member/quota', {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => r.json())
          .then((q: { quota_ton?: number | null }) => {
            if (q.quota_ton !== null && q.quota_ton !== undefined) {
              setData((current) => ({ ...current, quota: q.quota_ton ?? null }));
            }
          }).catch(() => null); // quota ไม่ critical — ล้มเหลวก็ไม่เป็นไร
      }
    })();
  }, [memberId]);

  return data;
}

function FarmerGreetingSummary({ name, data }: { name: string; data: FarmerDashboardData }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #F2FBEF 0%, #FFFFFF 62%, #FFF8D9 100%)',
      border: '1px solid #D9EAD1', borderRadius: 24, padding: '18px 16px',
      boxShadow: '0 10px 28px rgba(46, 125, 50, 0.10)',
    }}>
      <p style={{ margin: 0, fontSize: 22, fontWeight: 950, color: '#173B16', lineHeight: 1.25 }}>สวัสดี {name} 🌽</p>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: '#5f6b5f', lineHeight: 1.45 }}>
        วันนี้มี {data.reminders.length} รายการที่ควรติดตาม · แปลงลงทะเบียน {data.plotsCount} แปลง
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
        <div style={{ background: '#fff', borderRadius: 14, padding: '10px 8px', textAlign: 'center', border: '1px solid #E1EBDD' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#236B1F' }}>{data.plotsCount}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>แปลง</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: '10px 8px', textAlign: 'center', border: '1px solid #E1EBDD' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#8A5A00' }}>{data.cycles.length}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>รอบปลูก</p>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, padding: '10px 8px', textAlign: 'center', border: '1px solid #E1EBDD' }}>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#1D4ED8' }}>{data.bookings.length}</p>
          <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>นัดขาย</p>
        </div>
      </div>
    </div>
  );
}

export function FarmerSmartDashboard({ name, memberId, renderHero, renderMenu, footer }: {
  name: string;
  memberId: string;
  renderHero: (data: FarmerDashboardData) => ReactNode;
  renderMenu: (data: FarmerDashboardData) => ReactNode;
  footer?: ReactNode;
}) {
  const data = useFarmerDashboardData(memberId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FarmerGreetingSummary name={name} data={data} />
      {renderHero(data)}
      <ReminderSection reminders={data.reminders} />
      <PlotProgressCards plots={data.plotCards} cycles={data.cycles} noBurnRequests={data.noBurnRequests} bookings={data.bookings} />
      {renderMenu(data)}
      {footer}
    </div>
  );
}

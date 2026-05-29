'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export type FarmerPlotSummary = { id: string; name: string | null; area_rai: number | null; status: string | null };
export type FarmerCycleSummary = {
  id: string; plot_id: string | null; status: string; expected_harvest_at: string | null; crop_name: string | null;
};
export type FarmerNoBurnSummary = { id: string; plot_id: string | null; status: string };
export type FarmerHarvestBookingSummary = {
  id: string; plot_id: string | null; planting_cycle_id: string | null; scheduled_date: string | null; status: string;
};
export type FarmerReminderTone = 'warn' | 'seed' | 'fire' | 'sale' | 'info';

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export function plotScopedHref(path: string, plotId?: string | null) {
  return plotId ? `${path}?plot_id=${encodeURIComponent(plotId)}` : path;
}

function formatRai(area: number | null) {
  if (area === null || area === undefined) return 'ไม่ระบุไร่';
  return `${Number(area).toLocaleString('th-TH')} ไร่`;
}

export function reminderToneStyle(tone: FarmerReminderTone) {
  return {
    warn: { bg: '#FFF8E1', border: '#F2C94C', text: '#7A4A00' },
    seed: { bg: '#FFF1E6', border: '#F6A35A', text: '#9A4A00' },
    fire: { bg: '#F4EEFF', border: '#B99AF4', text: '#5B21B6' },
    sale: { bg: '#EAF5FF', border: '#8BC2FF', text: '#1D4ED8' },
    info: { bg: '#EAF3DE', border: '#A3C78A', text: '#27500A' },
  }[tone];
}

function QuickActionPill({ href, children, tone }: { href: string; children: ReactNode; tone: FarmerReminderTone }) {
  const st = reminderToneStyle(tone);
  return (
    <Link href={href} style={{ textDecoration: 'none', color: st.text, background: st.bg, border: `1px solid ${st.border}`, borderRadius: 999, padding: '9px 12px', fontSize: 12, fontWeight: 800, textAlign: 'center', whiteSpace: 'nowrap' }}>
      {children}
    </Link>
  );
}

export function PlotProgressCards({ plots, cycles, noBurnRequests, bookings }: {
  plots: FarmerPlotSummary[]; cycles: FarmerCycleSummary[]; noBurnRequests: FarmerNoBurnSummary[]; bookings: FarmerHarvestBookingSummary[];
}) {
  if (plots.length === 0) return null;
  const cyclesByPlot = new Map<string, FarmerCycleSummary>();
  cycles.forEach((cycle) => { if (cycle.plot_id && !cyclesByPlot.has(cycle.plot_id)) cyclesByPlot.set(cycle.plot_id, cycle); });
  const noBurnByPlot = new Map<string, FarmerNoBurnSummary>();
  noBurnRequests.forEach((req) => { if (req.plot_id && !noBurnByPlot.has(req.plot_id)) noBurnByPlot.set(req.plot_id, req); });
  const bookingsByPlot = new Map<string, FarmerHarvestBookingSummary>();
  bookings.forEach((booking) => { if (booking.plot_id && !bookingsByPlot.has(booking.plot_id)) bookingsByPlot.set(booking.plot_id, booking); });

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#173B16' }}>ความคืบหน้าแปลง</p>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>สถานะสำคัญแยกตามแปลง</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {plots.slice(0, 4).map((plot) => {
          const cycle = cyclesByPlot.get(plot.id);
          const noBurn = noBurnByPlot.get(plot.id);
          const booking = bookingsByPlot.get(plot.id) ?? bookings.find((b) => b.planting_cycle_id && b.planting_cycle_id === cycle?.id);
          return (
            <div key={plot.id} style={{ background: '#fff', border: '1px solid #E1EBDD', borderRadius: 18, padding: 14, boxShadow: '0 8px 22px rgba(46, 125, 50, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#173B16' }}>{plot.name || 'แปลงไม่มีชื่อ'} {formatRai(plot.area_rai)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>✅ ลงทะเบียนแล้ว</p>
                </div>
                <Link href="/plots" style={{ color: '#3B6D11', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>รายละเอียด</Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6, marginTop: 10, fontSize: 13, fontWeight: 700 }}>
                <span style={{ color: cycle ? '#2e7d32' : '#8A5A00' }}>{cycle ? `✅ รอบปลูก${cycle.crop_name ? ` ${cycle.crop_name}` : ''}` : '⚠️ ยังไม่สร้างรอบปลูก'}</span>
                <span style={{ color: noBurn ? '#2e7d32' : '#6D28D9' }}>{noBurn ? '✅ สมัครไม่เผาแล้ว' : '🔥 ยังไม่สมัครไม่เผา'}</span>
                <span style={{ color: booking ? '#1D4ED8' : '#6b7280' }}>{booking ? '📅 มีนัดขายแล้ว' : '📅 ยังไม่มีนัดขาย'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 12, paddingBottom: 2 }}>
                {!cycle && <QuickActionPill href={plotScopedHref('/planting-cycles/new', plot.id)} tone="warn">สร้างรอบปลูก</QuickActionPill>}
                <QuickActionPill href={plotScopedHref('/service/reservations', plot.id)} tone="seed">จองเมล็ดพันธุ์</QuickActionPill>
                {!noBurn && <QuickActionPill href={plotScopedHref('/no-burn', plot.id)} tone="fire">สมัครไม่เผา</QuickActionPill>}
                <QuickActionPill href="/plots" tone="info">ดูรายละเอียดแปลง</QuickActionPill>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

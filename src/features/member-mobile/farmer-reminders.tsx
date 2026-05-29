'use client';

import Link from 'next/link';
import {
  daysUntil,
  plotScopedHref,
  reminderToneStyle,
  type FarmerCycleSummary,
  type FarmerHarvestBookingSummary,
  type FarmerNoBurnSummary,
  type FarmerPlotSummary,
  type FarmerReminderTone,
} from './plot-progress-cards';

export type FarmerReminder = {
  id: string; priority: number; icon: string; title: string; desc: string; href: string; cta: string; tone: FarmerReminderTone;
};

export function buildFarmerReminders({ plotCards, cycles, noBurnRequests, bookings, hasSeedReservation }: {
  plotCards: FarmerPlotSummary[];
  cycles: FarmerCycleSummary[];
  noBurnRequests: FarmerNoBurnSummary[];
  bookings: FarmerHarvestBookingSummary[];
  hasSeedReservation: boolean;
}) {
  const plotIdsWithCycles = new Set(cycles.map((cycle) => cycle.plot_id).filter(Boolean));
  const plotIdsWithNoBurn = new Set(noBurnRequests.map((req) => req.plot_id).filter(Boolean));
  const plotsWithoutCycles = plotCards.filter((plot) => !plotIdsWithCycles.has(plot.id));
  const plotsWithoutNoBurn = plotCards.filter((plot) => !plotIdsWithNoBurn.has(plot.id));
  const firstPlot = plotCards[0];
  const firstPlotWithoutCycle = plotsWithoutCycles[0];
  const firstPlotWithoutNoBurn = plotsWithoutNoBurn[0];
  const nextBooking = bookings.find((booking) => daysUntil(booking.scheduled_date) !== null && (daysUntil(booking.scheduled_date) ?? 999) >= 0);
  const nextBookingDays = daysUntil(nextBooking?.scheduled_date ?? null);
  const harvestSoonCycle = cycles.find((cycle) => {
    const days = daysUntil(cycle.expected_harvest_at);
    return days !== null && days >= 0 && days <= 30;
  });
  const harvestSoonDays = daysUntil(harvestSoonCycle?.expected_harvest_at ?? null);

  return [
    ...(plotsWithoutCycles.length > 0 ? [{
      id: 'missing-cycle', priority: 10, icon: '⚠️', title: `ยังไม่สร้างรอบปลูก ${plotsWithoutCycles.length} แปลง`,
      desc: 'สร้างรอบปลูกเพื่อเริ่มติดตามฤดูปลูกและวันเก็บเกี่ยว', href: plotScopedHref('/planting-cycles/new', firstPlotWithoutCycle?.id), cta: 'สร้าง', tone: 'warn' as const,
    }] : []),
    ...(plotsWithoutNoBurn.length > 0 ? [{
      id: 'missing-no-burn', priority: 20, icon: '🔥', title: `สมัครไม่เผาได้ ${plotsWithoutNoBurn.length} แปลง`,
      desc: 'ยื่นคำขอโครงการไม่เผาจากแปลงที่ลงทะเบียนแล้ว', href: plotScopedHref('/no-burn', firstPlotWithoutNoBurn?.id), cta: 'สมัคร', tone: 'fire' as const,
    }] : []),
    ...(nextBooking && nextBookingDays !== null && nextBookingDays <= 30 ? [{
      id: 'upcoming-sale', priority: 30, icon: '📅', title: `นัดขายอีก ${Math.max(0, nextBookingDays)} วัน`,
      desc: 'ตรวจสอบวันนัด รถเกี่ยว และข้อมูลรับซื้อให้พร้อม', href: '/planting-cycles', cta: 'ดูนัด', tone: 'sale' as const,
    }] : []),
    ...(plotCards.length > 0 && !hasSeedReservation ? [{
      id: 'seed-eligible', priority: 40, icon: '🌽', title: 'มีสิทธิ์จองเมล็ดพันธุ์',
      desc: 'เลือกพันธุ์ข้าวโพดและจำนวนถุงสำหรับฤดูปลูกถัดไป', href: plotScopedHref('/service/reservations', firstPlot?.id), cta: 'จอง', tone: 'seed' as const,
    }] : []),
    ...(harvestSoonCycle && harvestSoonDays !== null ? [{
      id: 'harvest-soon', priority: 50, icon: '⏳', title: 'รอบปลูกใกล้เก็บเกี่ยว',
      desc: harvestSoonDays <= 0 ? 'ถึงกำหนดเก็บเกี่ยวแล้ว กรุณาแจ้งวันเกี่ยว' : `เหลือประมาณ ${harvestSoonDays} วันถึงวันเก็บเกี่ยว`,
      href: '/harvest/book', cta: 'แจ้งวัน', tone: 'info' as const,
    }] : []),
  ].sort((a, b) => a.priority - b.priority).slice(0, 5);
}

function SmartReminderCard({ reminder }: { reminder: FarmerReminder }) {
  const tone = reminderToneStyle(reminder.tone);
  return (
    <Link href={reminder.href} style={{ textDecoration: 'none', WebkitTapHighlightColor: 'transparent' }}>
      <div style={{
        display: 'flex', gap: 10, alignItems: 'center', padding: '12px 12px', borderRadius: 16,
        background: tone.bg, border: `1px solid ${tone.border}`, boxShadow: '0 6px 16px rgba(22, 64, 28, 0.06)',
      }}>
        <div style={{ fontSize: 24, width: 34, height: 34, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {reminder.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, color: tone.text, fontSize: 14, fontWeight: 800, lineHeight: 1.3 }}>{reminder.title}</p>
          <p style={{ margin: '2px 0 0', color: '#5f6b5f', fontSize: 12, lineHeight: 1.35 }}>{reminder.desc}</p>
        </div>
        <span style={{ color: tone.text, fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>{reminder.cta}</span>
      </div>
    </Link>
  );
}

export function ReminderSection({ reminders }: { reminders: FarmerReminder[] }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#173B16' }}>สิ่งที่ต้องทำ</p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>เรียงตามงานที่สำคัญที่สุดก่อน</p>
        </div>
        <Link href="/notifications" style={{ color: '#3B6D11', fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>ดูทั้งหมด</Link>
      </div>
      {reminders.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {reminders.map((r) => <SmartReminderCard key={r.id} reminder={r} />)}
        </div>
      ) : (
        <div style={{ borderRadius: 16, padding: '14px 12px', background: '#F4FAF0', border: '1px solid #D9EAD1', color: '#3B6D11', fontSize: 14, fontWeight: 700 }}>
          ✅ วันนี้ยังไม่มีงานด่วน แปลงของคุณพร้อมติดตามแล้ว
        </div>
      )}
    </section>
  );
}

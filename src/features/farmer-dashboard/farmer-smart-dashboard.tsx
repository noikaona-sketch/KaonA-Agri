'use client';

import Link      from 'next/link';
import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { WeatherTodayStrip }           from '@/features/weather/weather-widget';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type PlotData = {
  id: string; name: string; area_rai: number;
  lat: number | null; lng: number | null;
  hasCycle:    boolean;
  cycleStatus: string | null;
  cycleId:     string | null;
  daysToHarvest: number | null;
  hasNoBurn:   boolean;
  noBurnStatus: string | null;
  hasSaleAppt: boolean;
  saleDaysLeft: number | null;
};

type TodoItem = {
  id:       string;
  priority: number;        // lower = higher priority
  icon:     string;
  text:     string;
  href:     string;
  cta:      string;
  color:    string;
  bg:       string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function daysFromNow(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Build todo list from plot data
// ─────────────────────────────────────────────────────────────────────────────
function buildTodos(plots: PlotData[], canReserve: boolean): TodoItem[] {
  const todos: TodoItem[] = [];

  // A: แปลงที่ไม่มีรอบปลูก
  const noCtcPlots = plots.filter(p => !p.hasCycle);
  if (noCtcPlots.length > 0) {
    todos.push({
      id: 'no-cycle',
      priority: 10,
      icon: '⚠️',
      text: noCtcPlots.length === 1
        ? `ยังไม่สร้างรอบปลูก — ${noCtcPlots[0].name}`
        : `ยังไม่สร้างรอบปลูก ${noCtcPlots.length} แปลง`,
      href: noCtcPlots.length === 1
        ? `/planting-cycles/new?plot_id=${noCtcPlots[0].id}`
        : '/plots',
      cta:   'สร้างรอบปลูก',
      color: '#633806', bg: '#FAEEDA',
    });
  }

  // B: แปลงที่ยังไม่สมัครงดเผา
  const noNoBurnPlots = plots.filter(p => p.hasCycle && !p.hasNoBurn);
  if (noNoBurnPlots.length > 0) {
    todos.push({
      id: 'no-burn',
      priority: 20,
      icon: '🔥',
      text: noNoBurnPlots.length === 1
        ? `สมัครไม่เผาได้ — ${noNoBurnPlots[0].name}`
        : `สมัครไม่เผาได้ ${noNoBurnPlots.length} แปลง`,
      href: '/no-burn',
      cta: 'สมัครงดเผา',
      color: '#7b1fa2', bg: '#f3e5f5',
    });
  }

  // C: จองเมล็ดพันธุ์
  if (canReserve) {
    todos.push({
      id: 'reserve-seed',
      priority: 25,
      icon: '🌽',
      text: 'เปิดรับจองเมล็ดพันธุ์แล้ว',
      href: '/service/reservations',
      cta: 'จองเมล็ด',
      color: '#e65100', bg: '#fff3e0',
    });
  }

  // D: ใกล้เก็บเกี่ยว
  const readyPlots = plots.filter(p => p.daysToHarvest !== null && p.daysToHarvest <= 30 && p.daysToHarvest >= 0);
  for (const p of readyPlots) {
    todos.push({
      id: `harvest-${p.id}`,
      priority: 30 + (p.daysToHarvest ?? 30),
      icon: p.daysToHarvest! <= 7 ? '🚜' : '⏳',
      text: p.daysToHarvest === 0
        ? `${p.name} — เก็บเกี่ยวได้วันนี้!`
        : `${p.name} — เก็บเกี่ยวใน ${p.daysToHarvest} วัน`,
      href: p.cycleId ? `/planting-cycles/${p.cycleId}` : '/planting-cycles',
      cta: 'แจ้งวันเกี่ยว',
      color: '#c62828', bg: '#ffebee',
    });
  }

  // E: มีนัดขาย
  const saleApptPlots = plots.filter(p => p.hasSaleAppt && p.saleDaysLeft !== null);
  for (const p of saleApptPlots) {
    todos.push({
      id: `sale-${p.id}`,
      priority: 40,
      icon: '📅',
      text: p.saleDaysLeft === 0
        ? `${p.name} — นัดขายวันนี้!`
        : `${p.name} — นัดขายอีก ${p.saleDaysLeft} วัน`,
      href: '/planting-cycles',
      cta: 'ดูนัดขาย',
      color: '#1565c0', bg: '#e3f2fd',
    });
  }

  return todos.sort((a, b) => a.priority - b.priority);
}

// ─────────────────────────────────────────────────────────────────────────────
// Greeting
// ─────────────────────────────────────────────────────────────────────────────
function greet(name: string): string {
  const h = new Date().getHours();
  if (h < 12) return `สวัสดีตอนเช้า ${name} 🌅`;
  if (h < 17) return `สวัสดีตอนบ่าย ${name} 🌽`;
  return `สวัสดีตอนเย็น ${name} 🌙`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plot progress card
// ─────────────────────────────────────────────────────────────────────────────
const CYCLE_STAGE: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'วางแผน',    color: '#6b7280', bg: '#f3f4f6' },
  active:    { label: 'กำลังปลูก', color: '#1565c0', bg: '#e3f2fd' },
  confirmed: { label: 'ยืนยัน',    color: '#2e7d32', bg: '#e8f5e9' },
  growing:   { label: 'กำลังโต',   color: '#2e7d32', bg: '#e8f5e9' },
  flowering: { label: 'ออกดอก',    color: '#7b1fa2', bg: '#f3e5f5' },
  maturing:  { label: 'กำลังแก่',  color: '#e65100', bg: '#fff3e0' },
  ready:     { label: 'พร้อมเก็บ', color: '#c62828', bg: '#ffebee' },
  harvested: { label: 'เก็บเกี่ยวแล้ว', color: '#6b7280', bg: '#f5f5f5' },
};

function PlotProgressCard({ p }: { p: PlotData }) {
  const st = p.cycleStatus ? (CYCLE_STAGE[p.cycleStatus] ?? CYCLE_STAGE.active) : null;

  const items = [
    { ok: true,          icon: '✅', text: `ลงทะเบียนแล้ว · ${p.area_rai} ไร่` },
    {
      ok: p.hasCycle,
      icon: p.hasCycle ? '✅' : '⚠️',
      text: p.hasCycle
        ? `รอบปลูก${st ? ` · ${st.label}` : ''}`
        : 'ยังไม่สร้างรอบปลูก',
    },
    {
      ok: p.hasNoBurn,
      icon: p.hasNoBurn ? '✅' : '🔥',
      text: p.hasNoBurn
        ? `งดเผา · ${['approved','completed'].includes(p.noBurnStatus ?? '') ? 'อนุมัติแล้ว' : 'รอตรวจสอบ'}`
        : 'ยังไม่สมัครงดเผา',
    },
    {
      ok: p.hasSaleAppt,
      icon: p.hasSaleAppt ? '📅' : null,
      text: p.hasSaleAppt && p.saleDaysLeft !== null
        ? `มีนัดขาย${p.saleDaysLeft === 0 ? 'วันนี้' : `อีก ${p.saleDaysLeft} วัน`}`
        : null,
    },
    {
      ok: p.daysToHarvest !== null && p.daysToHarvest <= 30,
      icon: p.daysToHarvest !== null && p.daysToHarvest <= 7 ? '🚜' : null,
      text: p.daysToHarvest !== null && p.daysToHarvest <= 30
        ? `เก็บเกี่ยว${p.daysToHarvest === 0 ? 'วันนี้!' : `ใน ${p.daysToHarvest} วัน`}`
        : null,
    },
  ].filter(item => item.icon !== null && item.text !== null) as { ok: boolean; icon: string; text: string }[];

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #e8ede8',
      padding: '12px 14px', minWidth: 180, flexShrink: 0,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 13, color: '#111' }}>{p.name}</p>
          <p style={{ margin: '1px 0 0', fontSize: 11, color: '#9ca3af' }}>{p.area_rai} ไร่</p>
        </div>
        {st && (
          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: st.bg, color: st.color, flexShrink: 0 }}>
            {st.label}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, flexShrink: 0 }}>{item.icon}</span>
            <span style={{ fontSize: 11, color: item.ok ? '#374151' : '#854F0B', fontWeight: item.ok ? 400 : 600 }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
      <Link href={`/plots`}
        style={{ display: 'block', marginTop: 8, fontSize: 11, color: '#2e7d32', fontWeight: 700, textDecoration: 'none' }}>
        ดูรายละเอียด →
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function FarmerSmartDashboard({ name, memberId }: { name: string; memberId: string }) {
  const [plots,      setPlots]      = useState<PlotData[]>([]);
  const [todos,      setTodos]      = useState<TodoItem[]>([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    if (!memberId) return;
    void (async () => {
      const s = createSupabaseBrowserClient();

      // Parallel fetch: plots + cycles + no-burn + sale appointments
      const [plotsRes, cyclesRes, noBurnRes, saleRes, reserveRes] = await Promise.all([
        s.from('plots').select('id,name,area_rai,lat,lng,province').eq('member_id', memberId).is('deleted_at', null),
        s.from('planting_cycles')
          .select('id,plot_id,status,expected_harvest_at')
          .eq('member_id', memberId)
          .not('status', 'in', '(harvested,cancelled)'),
        s.from('no_burn_requests')
          .select('plot_id,status')
          .eq('member_id', memberId)
          .is('deleted_at', null)
          .not('status', 'in', '(rejected)'),
        s.from('appointments')
          .select('plot_id,appointment_date')
          .eq('member_id', memberId)
          .gte('appointment_date', new Date().toISOString().split('T')[0])
          .order('appointment_date').limit(10),
        // Check if seed reservation is open
        s.from('campaigns')
          .select('id').eq('type', 'seed_reservation').eq('status', 'active').limit(1),
      ]);

      const rawPlots  = (plotsRes.data  ?? []) as { id: string; name: string; area_rai: number; lat: number | null; lng: number | null; province: string | null }[];
      const rawCycles = (cyclesRes.data ?? []) as { id: string; plot_id: string | null; status: string; expected_harvest_at: string | null }[];
      const rawNoBurn = (noBurnRes.data ?? []) as { plot_id: string; status: string }[];
      const rawSales  = (saleRes.data   ?? []) as { plot_id: string | null; appointment_date: string }[];
      const canReserve = (reserveRes.data ?? []).length > 0;

      // Build per-plot data
      const plotDataList: PlotData[] = rawPlots.map((plot) => {
        const cycle      = rawCycles.find(c => c.plot_id === plot.id) ?? null;
        const noBurn     = rawNoBurn.find(n => n.plot_id === plot.id) ?? null;
        const saleAppt   = rawSales.find(s => s.plot_id === plot.id) ?? null;
        const harvestDay = daysFromNow(cycle?.expected_harvest_at ?? null);
        const saleDays   = daysFromNow(saleAppt?.appointment_date ? `${saleAppt.appointment_date}T00:00:00` : null);

        return {
          id:             plot.id,
          name:           plot.name,
          area_rai:       plot.area_rai,
          lat:            plot.lat ?? null,
          lng:            plot.lng ?? null,
          hasCycle:       !!cycle,
          cycleStatus:    cycle?.status ?? null,
          cycleId:        cycle?.id ?? null,
          daysToHarvest:  harvestDay,
          hasNoBurn:      !!noBurn,
          noBurnStatus:   noBurn?.status ?? null,
          hasSaleAppt:    !!saleAppt,
          saleDaysLeft:   saleDays !== null && saleDays >= 0 ? saleDays : null,
        };
      });

      setPlots(plotDataList);
      setTodos(buildTodos(plotDataList, canReserve));
      setLoading(false);
    })();
  }, [memberId]);

  if (loading || (plots.length === 0 && todos.length === 0)) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Greeting ── */}
      <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1b5e20' }}>
        {greet(name)}
      </p>

      {/* Weather today — use first plot's coordinates */}
      {plots[0]?.lat && plots[0]?.lng && (
        <WeatherTodayStrip
          lat={plots[0].lat}
          lng={plots[0].lng}
          location={plots[0].name}
        />
      )}

      {/* ── สิ่งที่ต้องทำ ── */}
      {todos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#374151', letterSpacing: '.04em' }}>
            📌 สิ่งที่ต้องทำ
          </p>
          {todos.slice(0, 4).map((todo) => (
            <Link key={todo.id} href={todo.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px', borderRadius: 12,
                background: todo.bg, border: `1px solid ${todo.color}33`,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{todo.icon}</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: todo.color, flex: 1 }}>{todo.text}</p>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px',
                  borderRadius: 99, background: todo.color, color: '#fff',
                  flexShrink: 0, whiteSpace: 'nowrap',
                }}>
                  {todo.cta}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Plot progress cards (horizontal scroll) ── */}
      {plots.length > 0 && (
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: '#374151', letterSpacing: '.04em' }}>
            🌾 สถานะแปลง
          </p>
          <div style={{
            display: 'flex', gap: 10,
            overflowX: 'auto', paddingBottom: 4,
            scrollbarWidth: 'none',
            // @ts-ignore
            WebkitOverflowScrolling: 'touch',
          }}>
            {plots.map(p => <PlotProgressCard key={p.id} p={p} />)}
          </div>
        </div>
      )}
    </div>
  );
}

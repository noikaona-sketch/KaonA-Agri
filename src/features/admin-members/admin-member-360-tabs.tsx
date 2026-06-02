'use client';

// AdminMember360Tabs — แสดงประวัติครบวงจรต่อสมาชิก 1 คน
// Planting | Harvest | No-burn | Inspection | Seed

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlantingRow = {
  id: string; crop_name: string; season_year: number;
  planted_at: string | null; expected_harvest_at: string | null;
  status: string;
  plots: { name: string } | null;
};

type HarvestRow = {
  id: string; scheduled_date: string; status: string;
  estimated_tonnage: number | null; actual_received_kg: number | null;
  actual_moisture_pct: number | null; quality_grade: string | null;
};

type NoBurnRow = {
  id: string; status: string; timing: string | null;
  submitted_at: string; bonus_type: string | null;
  bonus_value: number | null; bonus_amount: number | null;
  plots: { name: string } | null;
  planting_seasons: { name: string } | null;
};

type InspectionRow = {
  id: string; result_status: string; assigned_at: string | null;
  visited_at: string | null; result_note: string | null;
  cert_agency: string | null; lab_submitted: boolean;
  plots: { name: string } | null;
};

type SeedRow = {
  id: string; reservation_no: string; status: string; created_at: string;
  qty_reserved: number | null; qty_received: number | null;
  seed_varieties: { variety_name: string } | null;
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  tabBar: {
    display: 'flex', gap: 4, background: '#f3f4f6',
    borderRadius: 10, padding: 4, margin: '20px 0 14px',
  } as React.CSSProperties,
  tab: (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '8px 4px', borderRadius: 7, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: active ? 700 : 500,
    background: active ? '#fff' : 'transparent',
    color: active ? '#14532d' : '#6b7280',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
    whiteSpace: 'nowrap' as const,
  }),
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '10px 14px', borderBottom: '1px solid #f3f4f6', gap: 8,
  } as React.CSSProperties,
  badge: (color: string, bg: string): React.CSSProperties => ({
    fontSize: 11, padding: '2px 8px', borderRadius: 20,
    background: bg, color, fontWeight: 600, whiteSpace: 'nowrap' as const,
  }),
  empty: {
    textAlign: 'center' as const, padding: '28px 0', color: '#9ca3af', fontSize: 13,
  },
};

const STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
  approved:    { label: '✅ อนุมัติ',    color: '#14532d', bg: '#f0fdf4' },
  completed:   { label: '✅ เสร็จ',      color: '#14532d', bg: '#f0fdf4' },
  passed:      { label: '✅ ผ่าน',       color: '#14532d', bg: '#f0fdf4' },
  confirmed:   { label: '✅ ยืนยัน',    color: '#14532d', bg: '#f0fdf4' },
  pending:     { label: '⏳ รอ',         color: '#92400e', bg: '#fffbeb' },
  submitted:   { label: '📤 ยื่นแล้ว',  color: '#1d4ed8', bg: '#eff6ff' },
  planned:     { label: '📅 แผน',        color: '#374151', bg: '#f9fafb' },
  active:      { label: '🌱 ดำเนินการ',  color: '#065f46', bg: '#ecfdf5' },
  failed:      { label: '❌ ไม่ผ่าน',   color: '#991b1b', bg: '#fef2f2' },
  rejected:    { label: '❌ ปฏิเสธ',    color: '#991b1b', bg: '#fef2f2' },
  cancelled:   { label: '⛔ ยกเลิก',    color: '#6b7280', bg: '#f3f4f6' },
  needs_update:{ label: '📋 ต้องแก้',   color: '#d97706', bg: '#fffbeb' },
};

function statusBadge(s: string) {
  const cfg = STATUS_TH[s] ?? { label: s, color: '#374151', bg: '#f3f4f6' };
  return <span style={S.badge(cfg.color, cfg.bg)}>{cfg.label}</span>;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function PlantingPanel({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<PlantingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s.from('planting_cycles')
      .select('id,crop_name,season_year,planted_at,expected_harvest_at,status,plots(name)')
      .eq('member_id', memberId).order('season_year', { ascending: false }).limit(20)
      .then(({ data }) => { setRows((data as unknown as PlantingRow[]) ?? []); setLoading(false); });
  }, [memberId]);

  if (loading) return <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>กำลังโหลด…</p>;
  if (!rows.length) return <div style={S.empty}>ยังไม่มีบันทึกการปลูก</div>;

  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} style={S.row}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>{r.crop_name} — {r.season_year}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
              {r.plots?.name ?? '—'} · ปลูก {fmtDate(r.planted_at)} · เกี่ยว {fmtDate(r.expected_harvest_at)}
            </p>
          </div>
          {statusBadge(r.status)}
        </div>
      ))}
    </div>
  );
}

function HarvestPanel({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<HarvestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s.from('harvest_bookings')
      .select('id,scheduled_date,status,estimated_tonnage,actual_received_kg,actual_moisture_pct,quality_grade')
      .eq('member_id', memberId).order('scheduled_date', { ascending: false }).limit(20)
      .then(({ data }) => { setRows((data as unknown as HarvestRow[]) ?? []); setLoading(false); });
  }, [memberId]);

  if (loading) return <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>กำลังโหลด…</p>;
  if (!rows.length) return <div style={S.empty}>ยังไม่มีบันทึกการเก็บเกี่ยว</div>;

  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} style={S.row}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>📅 {fmtDate(r.scheduled_date)}</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
              {r.actual_received_kg
                ? `⚖️ ${(r.actual_received_kg/1000).toFixed(2)} ตัน · ชื้น ${r.actual_moisture_pct ?? '—'}% · เกรด ${r.quality_grade ?? '—'}`
                : r.estimated_tonnage ? `ประมาณ ${r.estimated_tonnage} ตัน` : '—'}
            </p>
          </div>
          {statusBadge(r.status)}
        </div>
      ))}
      {/* Summary */}
      {rows.filter(r => r.actual_received_kg).length > 0 && (
        <div style={{ padding: '10px 14px', background: '#f0fdf4', borderTop: '1px solid #bbf7d0' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#14532d', fontWeight: 700 }}>
            รวม: {(rows.reduce((s,r) => s + (r.actual_received_kg ?? 0), 0) / 1000).toFixed(2)} ตัน
            · {rows.filter(r => r.status === 'completed').length} ครั้ง
          </p>
        </div>
      )}
    </div>
  );
}

function NoBurnPanel({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<NoBurnRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s.from('no_burn_requests')
      .select('id,status,timing,submitted_at,bonus_type,bonus_value,bonus_amount,plots(name),planting_seasons(name)')
      .eq('member_id', memberId).order('submitted_at', { ascending: false }).limit(20)
      .then(({ data }) => { setRows((data as unknown as NoBurnRow[]) ?? []); setLoading(false); });
  }, [memberId]);

  if (loading) return <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>กำลังโหลด…</p>;
  if (!rows.length) return <div style={S.empty}>ยังไม่เคยสมัครโครงการไม่เผา</div>;

  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} style={S.row}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
              {r.plots?.name ?? '—'}
              {r.planting_seasons?.name ? ` · ${r.planting_seasons.name}` : ''}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
              ยื่น {fmtDate(r.submitted_at)}
              {r.bonus_amount
                ? ` · 💰 ${r.bonus_amount.toLocaleString()} บาท`
                : r.bonus_value
                ? ` · 💰 ${r.bonus_value} บาท/${r.bonus_type === 'per_ton' ? 'ตัน' : 'ไร่'}`
                : ''}
            </p>
          </div>
          {statusBadge(r.status)}
        </div>
      ))}
    </div>
  );
}

function InspectionPanel({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s.from('inspections')
      .select('id,result_status,assigned_at,visited_at,result_note,cert_agency,lab_submitted,plots(name)')
      .eq('member_id', memberId).order('assigned_at', { ascending: false }).limit(20)
      .then(({ data }) => { setRows((data as unknown as InspectionRow[]) ?? []); setLoading(false); });
  }, [memberId]);

  if (loading) return <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>กำลังโหลด…</p>;
  if (!rows.length) return <div style={S.empty}>ยังไม่มีบันทึกการตรวจแปลง</div>;

  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} style={S.row}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
              {r.plots?.name ?? '—'}
              {r.cert_agency ? ` · 🏛️ ${r.cert_agency}` : ''}
              {r.lab_submitted ? ' · 🧪 ส่งแล็บ' : ''}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
              มอบหมาย {fmtDate(r.assigned_at)}
              {r.visited_at ? ` · ตรวจ ${fmtDate(r.visited_at)}` : ''}
            </p>
            {r.result_note && (
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>📝 {r.result_note.slice(0, 60)}{r.result_note.length > 60 ? '…' : ''}</p>
            )}
          </div>
          {statusBadge(r.result_status)}
        </div>
      ))}
    </div>
  );
}

function SeedPanel({ memberId }: { memberId: string }) {
  const [rows, setRows] = useState<SeedRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s.from('seed_reservations')
      .select('id,reservation_no,status,created_at,qty_reserved,qty_received,seed_varieties(variety_name)')
      .eq('member_id', memberId).order('created_at', { ascending: false }).limit(20)
      .then(({ data }) => { setRows((data as unknown as SeedRow[]) ?? []); setLoading(false); });
  }, [memberId]);

  if (loading) return <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>กำลังโหลด…</p>;
  if (!rows.length) return <div style={S.empty}>ยังไม่มีการจองเมล็ดพันธุ์</div>;

  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} style={S.row}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
              {r.seed_varieties?.variety_name ?? '—'} · {r.reservation_no}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
              {fmtDate(r.created_at)}
              {r.qty_reserved ? ` · จอง ${r.qty_reserved} กก.` : ''}
              {r.qty_received  ? ` · รับ ${r.qty_received} กก.` : ''}
            </p>
          </div>
          {statusBadge(r.status)}
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab360 = 'planting' | 'harvest' | 'noburn' | 'inspection' | 'seed';

const TABS: { key: Tab360; label: string }[] = [
  { key: 'planting',   label: '🌱 ปลูก'    },
  { key: 'harvest',    label: '🌾 เกี่ยว'  },
  { key: 'noburn',     label: '🌿 ไม่เผา' },
  { key: 'inspection', label: '🔍 ตรวจ'   },
  { key: 'seed',       label: '🛒 เมล็ด'  },
];

export function AdminMember360Tabs({ memberId }: { memberId: string }) {
  const [tab, setTab] = useState<Tab360>('harvest');

  return (
    <div style={{ marginTop: 24 }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: '#6b7280', letterSpacing: 1 }}>
        ประวัติครบวงจร
      </p>
      <div style={S.tabBar}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} style={S.tab(tab === t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
        {tab === 'planting'   && <PlantingPanel   memberId={memberId} />}
        {tab === 'harvest'    && <HarvestPanel    memberId={memberId} />}
        {tab === 'noburn'     && <NoBurnPanel     memberId={memberId} />}
        {tab === 'inspection' && <InspectionPanel memberId={memberId} />}
        {tab === 'seed'       && <SeedPanel       memberId={memberId} />}
      </div>
    </div>
  );
}

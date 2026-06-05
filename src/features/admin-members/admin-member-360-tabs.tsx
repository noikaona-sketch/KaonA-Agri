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

type VisitRow = {
  id: string; visit_purpose: string; visit_purpose_note: string | null;
  note: string | null; follow_up: string | null; visited_at: string;
  staff: { full_name: string } | null;
  plots: { name: string } | null;
};

const PURPOSE_TH: Record<string, string> = {
  follow_up: '🌱 ติดตามปลูก', no_burn_advice: '🌿 แนะนำไม่เผา',
  soil_check: '🪱 ตรวจดิน', pest_advice: '🐛 ศัตรูพืช',
  registration: '📋 ลงทะเบียน', problem_solve: '🔧 แก้ปัญหา', other: '💬 อื่นๆ',
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


const EVIDENCE_BUCKET_VP = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

const PURPOSE_EDIT_VALUES = Object.keys(PURPOSE_TH);

type PhotoVP  = { id: string; storage_path: string };
type VisitRow = {
  id: string;
  visit_purpose: string; visit_purpose_note: string | null;
  note: string | null; follow_up: string | null;
  visited_at: string; updated_at: string | null;
  staff: { id: string; full_name: string } | null;
  plots: { id: string; name: string } | null;
  photos: PhotoVP[];
};

function fmtDateVP(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}

function PhotoStrip({ photos }: { photos: PhotoVP[] }) {
  const sb = createSupabaseBrowserClient();
  if (!photos.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
      {photos.map((p) => {
        const { data } = sb.storage.from(EVIDENCE_BUCKET_VP).getPublicUrl(p.storage_path);
        return (
          <a key={p.id} href={data.publicUrl} target="_blank" rel="noreferrer"
            style={{ width: 64, height: 64, borderRadius: 8, overflow: 'hidden', display: 'block', flexShrink: 0, border: '1px solid #e5e7eb' }}>
            <img src={data.publicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </a>
        );
      })}
    </div>
  );
}

function EditVisitForm({ log, token, onSaved, onCancel }: {
  log: VisitRow; token: string;
  onSaved: (updated: Partial<VisitRow>) => void;
  onCancel: () => void;
}) {
  const [purpose,     setPurpose]     = useState(log.visit_purpose);
  const [purposeNote, setPurposeNote] = useState(log.visit_purpose_note ?? '');
  const [note,        setNote]        = useState(log.note        ?? '');
  const [followUp,    setFollowUp]    = useState(log.follow_up   ?? '');
  const [visitedAt,   setVisitedAt]   = useState(log.visited_at.slice(0, 10));
  const [saving,      setSaving]      = useState(false);
  const [editErr,     setEditErr]     = useState<string | null>(null);

  const INP2 = { padding: '8px 11px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' };

  async function save() {
    setSaving(true); setEditErr(null);
    const res = await fetch('/api/field/visit-log', {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        log_id: log.id, visit_purpose: purpose,
        visit_purpose_note: purposeNote || null,
        note: note || null, follow_up: followUp || null,
        visited_at: new Date(visitedAt).toISOString(),
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setEditErr(d.error ?? 'บันทึกไม่สำเร็จ'); return; }
    onSaved({ visit_purpose: purpose, visit_purpose_note: purposeNote || null, note: note || null, follow_up: followUp || null, visited_at: new Date(visitedAt).toISOString(), updated_at: new Date().toISOString() });
  }

  return (
    <div style={{ marginTop: 10, padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1.5px solid #e0e7ef', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {editErr && <div style={{ padding: '7px 11px', borderRadius: 7, background: '#fee2e2', color: '#991b1b', fontSize: 12 }}>{editErr}</div>}
      <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' }}>วัตถุประสงค์
        <select style={INP2} value={purpose} onChange={e => setPurpose(e.target.value)}>
          {PURPOSE_EDIT_VALUES.map(k => <option key={k} value={k}>{PURPOSE_TH[k]}</option>)}
        </select>
      </label>
      {purpose === 'other' && <input style={INP2} placeholder="ระบุวัตถุประสงค์" value={purposeNote} onChange={e => setPurposeNote(e.target.value)} />}
      <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' }}>วันที่เยี่ยม
        <input style={INP2} type="date" value={visitedAt} onChange={e => setVisitedAt(e.target.value)} />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' }}>บันทึก
        <textarea style={{ ...INP2, resize: 'vertical' }} rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="สิ่งที่พูดคุย…" />
      </label>
      <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: '#d97706' }}>⚡ สิ่งที่ต้องติดตาม
        <textarea style={{ ...INP2, resize: 'vertical' }} rows={2} value={followUp} onChange={e => setFollowUp(e.target.value)} placeholder="งานค้าง…" />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
        <button onClick={onCancel} disabled={saving} style={{ padding: '8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 13, cursor: 'pointer' }}>ยกเลิก</button>
        <button onClick={save} disabled={saving} style={{ padding: '8px', borderRadius: 8, border: 'none', background: saving ? '#d1fae5' : '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'กำลังบันทึก…' : '💾 บันทึก'}</button>
      </div>
    </div>
  );
}

function VisitPanel({ memberId }: { memberId: string }) {
  const [rows,    setRows]    = useState<VisitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [token,   setToken]   = useState<string | null>(null);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    void sb.auth.getSession().then(r => setToken(r.data.session?.access_token ?? null));
  }, []);

  useEffect(() => {
    const sb = createSupabaseBrowserClient();
    void sb.from('field_visit_logs')
      .select('id,visit_purpose,visit_purpose_note,note,follow_up,visited_at,updated_at,staff:staff_member_id(id,full_name),plots(id,name),photos!field_visit_log_id(id,storage_path)')
      .eq('member_id', memberId).order('visited_at', { ascending: false }).limit(30)
      .then(({ data }) => { setRows((data as unknown as VisitRow[]) ?? []); setLoading(false); });
  }, [memberId]);

  if (loading) return <p style={{ padding: 16, color: '#9ca3af', fontSize: 13 }}>กำลังโหลด…</p>;
  if (!rows.length) return <div style={{ textAlign: 'center', padding: '28px 0', color: '#9ca3af', fontSize: 13 }}>ยังไม่มีบันทึกการเยี่ยม</div>;

  return (
    <div>
      {rows.map((r) => (
        <div key={r.id} style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>
                {PURPOSE_TH[r.visit_purpose] ?? r.visit_purpose}
                {r.visit_purpose_note ? ` — ${r.visit_purpose_note}` : ''}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                📅 {fmtDateVP(r.visited_at)} · 👤 {r.staff?.full_name ?? '—'}
                {r.plots?.name ? ` · 🌱 ${r.plots.name}` : ''}
                {r.updated_at ? <span style={{ color: '#9ca3af' }}> · แก้ไข {fmtDateVP(r.updated_at)}</span> : null}
              </p>
            </div>
            {token && editId !== r.id && (
              <button onClick={() => setEditId(r.id)}
                style={{ padding: '4px 10px', borderRadius: 7, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#374151', flexShrink: 0 }}>
                ✏️ แก้ไข
              </button>
            )}
          </div>
          {r.note && <p style={{ margin: '6px 0 0', fontSize: 13, color: '#374151', lineHeight: 1.5 }}>📝 {r.note}</p>}
          {r.follow_up && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#92400e', background: '#fffbeb', padding: '4px 10px', borderRadius: 7 }}>⚡ ติดตาม: {r.follow_up}</p>}
          {r.photos?.length > 0 && <PhotoStrip photos={r.photos} />}
          {editId === r.id && token && (
            <EditVisitForm
              log={r} token={token}
              onSaved={(updated) => { setRows(prev => prev.map(x => x.id === r.id ? { ...x, ...updated } : x)); setEditId(null); }}
              onCancel={() => setEditId(null)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type Tab360 = 'planting' | 'harvest' | 'noburn' | 'inspection' | 'seed' | 'visit';

const TABS: { key: Tab360; label: string }[] = [
  { key: 'planting',   label: '🌱 ปลูก'    },
  { key: 'harvest',    label: '🌾 เกี่ยว'  },
  { key: 'noburn',     label: '🌿 ไม่เผา' },
  { key: 'inspection', label: '🔍 ตรวจ'   },
  { key: 'seed',       label: '🛒 เมล็ด'  },
  { key: 'visit',      label: '🤝 เยี่ยม'  },
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
        {tab === 'visit'      && <VisitPanel      memberId={memberId} />}
      </div>
    </div>
  );
}


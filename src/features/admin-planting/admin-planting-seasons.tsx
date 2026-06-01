'use client';

import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Stats = {
  planting_count: number; planting_rai: number;
  noburn_count: number;   noburn_rai: number;   noburn_approved: number;
  seed_kg: number;        seed_quota_used_pct: number | null;
  harvest_ton: number;    harvest_count: number;
};

type Season = {
  id: string; name: string; season_year: number; crop_type: string;
  planting_start: string; planting_end: string;
  harvest_start: string | null; harvest_end: string | null;
  registration_opens: string | null; registration_closes: string | null;
  noburn_bonus_type: 'per_ton' | 'per_rai'; noburn_bonus_value: number;
  seed_quota_kg: number | null; is_active: boolean; note: string | null;
  stats?: Stats;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CROP_OPTS = [
  { v: 'corn',      l: '🌽 ข้าวโพด',       bonus: 'per_ton' },
  { v: 'cassava',   l: '🥔 มันสำปะหลัง',   bonus: 'per_rai' },
  { v: 'sugarcane', l: '🎋 อ้อย',          bonus: 'per_rai' },
  { v: 'rice',      l: '🌾 ข้าว',          bonus: 'per_rai' },
  { v: 'other',     l: '🌿 อื่นๆ',         bonus: 'per_rai' },
];

const CROP_ICON: Record<string, string> = {
  corn: '🌽', cassava: '🥔', sugarcane: '🎋', rice: '🌾', other: '🌿',
};

const S = {
  label: { display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  input: { padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, width: '100%', background: '#fff' } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 14, overflow: 'hidden' } as React.CSSProperties,
  statBox: (color: string): React.CSSProperties => ({
    background: color + '14', border: `1px solid ${color}33`,
    borderRadius: 10, padding: '10px 12px', textAlign: 'center' as const,
  }),
};

const initForm = {
  name: '', season_year: new Date().getFullYear() + 543,
  crop_type: 'corn', planting_start: '', planting_end: '',
  harvest_start: '', harvest_end: '',
  registration_opens: '', registration_closes: '',
  noburn_bonus_value: '', seed_quota_kg: '', is_active: true, note: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminPlantingSeasons() {
  const [seasons,  setSeasons]  = useState<Season[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId,   setEditId]   = useState<string | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [notice,   setNotice]   = useState<{ ok: boolean; msg: string } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [form,     setForm]     = useState(initForm);

  const setF = (k: string, v: string | boolean | number) =>
    setForm((p) => ({ ...p, [k]: v }));

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/planting-seasons?with_stats=true', { credentials: 'include' });
    const d   = (await res.json()) as { seasons?: Season[] };
    setSeasons(d.seasons ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openNew() {
    setEditId(null); setForm(initForm); setShowForm(true);
  }

  function openEdit(s: Season) {
    setEditId(s.id);
    setForm({
      name: s.name, season_year: s.season_year, crop_type: s.crop_type,
      planting_start: s.planting_start, planting_end: s.planting_end,
      harvest_start: s.harvest_start ?? '', harvest_end: s.harvest_end ?? '',
      registration_opens:  s.registration_opens  ?? '',
      registration_closes: s.registration_closes ?? '',
      noburn_bonus_value: String(s.noburn_bonus_value),
      seed_quota_kg: s.seed_quota_kg != null ? String(s.seed_quota_kg) : '',
      is_active: s.is_active, note: s.note ?? '',
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.name.trim() || !form.crop_type || !form.planting_start || !form.planting_end) {
      setNotice({ ok: false, msg: 'กรุณากรอก ชื่อ / ประเภทสินค้า / วันปลูก' }); return;
    }
    setSaving(true); setNotice(null);
    const res = await fetch('/api/admin/planting-seasons', {
      method: editId ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editId,
        name: form.name.trim(), season_year: Number(form.season_year),
        crop_type: form.crop_type,
        planting_start: form.planting_start, planting_end: form.planting_end,
        harvest_start:  form.harvest_start  || null,
        harvest_end:    form.harvest_end    || null,
        registration_opens:  form.registration_opens  || null,
        registration_closes: form.registration_closes || null,
        noburn_bonus_value: Number(form.noburn_bonus_value) || 0,
        seed_quota_kg: form.seed_quota_kg ? Number(form.seed_quota_kg) : null,
        is_active: form.is_active,
        note: form.note.trim() || null,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok || !data.ok) { setNotice({ ok: false, msg: data.error ?? 'บันทึกไม่สำเร็จ' }); return; }
    setNotice({ ok: true, msg: editId ? '✅ แก้ไขรอบแล้ว' : '✅ สร้างรอบใหม่แล้ว' });
    setShowForm(false);
    void load();
  }

  const bonusTypeAuto = CROP_OPTS.find((o) => o.v === form.crop_type)?.bonus ?? 'per_rai';

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>📅 รอบการปลูก</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
            สมาชิกเลือกรอบเมื่อแจ้งปลูก / สมัครไม่เผา / จองเมล็ด / จองขาย
          </p>
        </div>
        <button onClick={openNew}
          style={{ padding: '9px 16px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + สร้างรอบ
        </button>
      </div>

      {/* Notice */}
      {notice && (
        <div style={{ padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
          background: notice.ok ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notice.ok ? '#86efac' : '#fca5a5'}`,
          color: notice.ok ? '#14532d' : '#991b1b',
          display: 'flex', justifyContent: 'space-between' }}>
          <span>{notice.msg}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div style={{ background: '#fff', border: '2px solid #2e7d32', borderRadius: 14, padding: '16px', display: 'grid', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{editId ? '✏️ แก้ไขรอบ' : '+ สร้างรอบการปลูก'}</p>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 18 }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <label style={S.label}>
              ชื่อรอบ <span style={{ color: '#dc2626' }}>*</span>
              <input style={S.input} value={form.name} onChange={(e) => setF('name', e.target.value)}
                placeholder="เช่น ข้าวโพดรอบ 1/2569" />
            </label>
            <label style={S.label}>
              ปี พ.ศ.
              <input style={S.input} type="number" value={form.season_year}
                onChange={(e) => setF('season_year', Number(e.target.value))} />
            </label>
          </div>

          <label style={S.label}>
            ประเภทสินค้า <span style={{ color: '#dc2626' }}>*</span>
            <select style={S.input} value={form.crop_type} onChange={(e) => setF('crop_type', e.target.value)}>
              {CROP_OPTS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
            <span style={{ fontSize: 11, color: '#059669', fontWeight: 400 }}>
              → โบนัสไม่เผาอัตโนมัติ: {bonusTypeAuto === 'per_ton' ? 'บาท/ตัน' : 'บาท/ไร่'}
              {form.crop_type !== 'corn' ? ' (ไม่มียอดขายตัน)' : ' (มียอดขายตัน)'}
            </span>
          </label>

          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#374151' }}>ช่วงเวลา</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={S.label}>เปิดรับลงทะเบียน<input style={S.input} type="date" value={form.registration_opens} onChange={(e) => setF('registration_opens', e.target.value)} /></label>
            <label style={S.label}>ปิดรับลงทะเบียน<input style={S.input} type="date" value={form.registration_closes} onChange={(e) => setF('registration_closes', e.target.value)} /></label>
            <label style={S.label}>เริ่มลงแปลง <span style={{ color: '#dc2626' }}>*</span><input style={S.input} type="date" value={form.planting_start} onChange={(e) => setF('planting_start', e.target.value)} /></label>
            <label style={S.label}>สิ้นสุดลงแปลง <span style={{ color: '#dc2626' }}>*</span><input style={S.input} type="date" value={form.planting_end} onChange={(e) => setF('planting_end', e.target.value)} /></label>
            <label style={S.label}>คาดเก็บเกี่ยวเริ่ม<input style={S.input} type="date" value={form.harvest_start} onChange={(e) => setF('harvest_start', e.target.value)} /></label>
            <label style={S.label}>คาดเก็บเกี่ยวสิ้นสุด<input style={S.input} type="date" value={form.harvest_end} onChange={(e) => setF('harvest_end', e.target.value)} /></label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={S.label}>
              โบนัสไม่เผา ({bonusTypeAuto === 'per_ton' ? 'บาท/ตัน' : 'บาท/ไร่'})
              <input style={S.input} type="number" min="0" step="0.01"
                value={form.noburn_bonus_value}
                onChange={(e) => setF('noburn_bonus_value', e.target.value)}
                placeholder={form.crop_type === 'corn' ? 'เช่น 100' : 'เช่น 200'} />
            </label>
            <label style={S.label}>
              โควต้าเมล็ด (กก.) — ว่างถ้าไม่จำกัด
              <input style={S.input} type="number" min="0"
                value={form.seed_quota_kg}
                onChange={(e) => setF('seed_quota_kg', e.target.value)}
                placeholder="เช่น 5000" />
            </label>
          </div>

          <label style={S.label}>
            หมายเหตุ (admin)
            <input style={S.input} value={form.note} onChange={(e) => setF('note', e.target.value)}
              placeholder="เงื่อนไขพิเศษ หมายเหตุรอบนี้" />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => setF('is_active', e.target.checked)} />
            เปิดให้สมาชิกเลือกรอบนี้
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(false)}
              style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 14, cursor: 'pointer' }}>ยกเลิก</button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? '⏳ กำลังบันทึก…' : editId ? '💾 บันทึก' : '+ สร้างรอบ'}
            </button>
          </div>
        </div>
      )}

      {/* Seasons list */}
      {loading && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>กำลังโหลด…</p>}
      {!loading && seasons.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: 32, margin: '0 0 8px' }}>📅</p>
          <p style={{ fontSize: 14, margin: 0 }}>ยังไม่มีรอบการปลูก — กด "สร้างรอบ"</p>
        </div>
      )}

      {seasons.map((s) => {
        const isOpen   = expanded === s.id;
        const st       = s.stats;
        const noburnPct = st && st.planting_count > 0
          ? Math.round((st.noburn_count / st.planting_count) * 100)
          : null;
        const isCorn = s.crop_type === 'corn';

        return (
          <div key={s.id} style={{ ...S.card, opacity: s.is_active ? 1 : 0.65 }}>
            {/* Header row */}
            <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 20 }}>{CROP_ICON[s.crop_type] ?? '🌿'}</span>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{s.name}</p>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: s.is_active ? '#f0fdf4' : '#f3f4f6', color: s.is_active ? '#14532d' : '#6b7280', border: `1px solid ${s.is_active ? '#86efac' : '#e5e7eb'}`, fontWeight: 600 }}>
                    {s.is_active ? '✅ เปิด' : '⏸ ปิด'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                  🌱 {s.planting_start} → {s.planting_end}
                  {s.harvest_start && ` · 🌾 ${s.harvest_start} → ${s.harvest_end}`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => openEdit(s)} style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>✏️</button>
                <button onClick={() => setExpanded(isOpen ? null : s.id)}
                  style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #2e7d32', background: isOpen ? '#2e7d32' : '#fff', color: isOpen ? '#fff' : '#2e7d32', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  {isOpen ? '▲ ซ่อน' : '📊 สรุป'}
                </button>
              </div>
            </div>

            {/* Bonus strip */}
            <div style={{ margin: '0 16px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{s.noburn_bonus_type === 'per_ton' ? '⚖️' : '🗺️'}</span>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#14532d' }}>
                  +{s.noburn_bonus_value.toLocaleString()} บาท/{s.noburn_bonus_type === 'per_ton' ? 'ตัน' : 'ไร่'}
                </span>
                <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 8 }}>โบนัสไม่เผา</span>
              </div>
              {s.seed_quota_kg && (
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                    เมล็ด {st ? `${st.seed_kg.toLocaleString()}` : '—'}/{s.seed_quota_kg.toLocaleString()} กก.
                  </p>
                  {st?.seed_quota_used_pct != null && (
                    <div style={{ marginTop: 3, height: 4, borderRadius: 2, background: '#e5e7eb', width: 80 }}>
                      <div style={{ height: '100%', borderRadius: 2, width: `${Math.min(st.seed_quota_used_pct, 100)}%`, background: st.seed_quota_used_pct > 90 ? '#dc2626' : '#2e7d32' }} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stats panel */}
            {isOpen && st && (
              <div style={{ padding: '0 16px 16px', display: 'grid', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${isCorn ? 4 : 3}, 1fr)`, gap: 8 }}>
                  {/* แจ้งปลูก */}
                  <div style={S.statBox('#2e7d32')}>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#14532d' }}>{st.planting_count}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>ราย</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: '#14532d' }}>🌱 แจ้งปลูก</p>
                    <p style={{ margin: '1px 0 0', fontSize: 11, color: '#6b7280' }}>{st.planting_rai.toFixed(1)} ไร่</p>
                  </div>
                  {/* ไม่เผา */}
                  <div style={S.statBox('#059669')}>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#065f46' }}>{st.noburn_count}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>ราย ({noburnPct ?? '—'}%)</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: '#065f46' }}>🌿 ไม่เผา</p>
                    <p style={{ margin: '1px 0 0', fontSize: 11, color: '#6b7280' }}>approved {st.noburn_approved} ราย</p>
                  </div>
                  {/* เมล็ด */}
                  <div style={S.statBox('#1d4ed8')}>
                    <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1e40af' }}>{st.seed_kg.toLocaleString()}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>กก.</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: '#1e40af' }}>🌾 เมล็ดรับไป</p>
                    {s.seed_quota_kg && (
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: '#6b7280' }}>quota {st.seed_quota_used_pct ?? 0}%</p>
                    )}
                  </div>
                  {/* ยอดขาย — เฉพาะ corn */}
                  {isCorn && (
                    <div style={S.statBox('#d97706')}>
                      <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#92400e' }}>{st.harvest_ton.toFixed(1)}</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>ตัน</p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700, color: '#92400e' }}>⚖️ ขายแล้ว</p>
                      <p style={{ margin: '1px 0 0', fontSize: 11, color: '#6b7280' }}>{st.harvest_count} ราย</p>
                    </div>
                  )}
                </div>

                {/* No-burn progress bar */}
                {noburnPct !== null && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                      <span>อัตราไม่เผา</span>
                      <span style={{ fontWeight: 700, color: noburnPct >= 70 ? '#059669' : '#d97706' }}>{noburnPct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: '#e5e7eb' }}>
                      <div style={{ height: '100%', borderRadius: 3, width: `${Math.min(noburnPct, 100)}%`, background: noburnPct >= 70 ? '#059669' : '#d97706', transition: 'width .5s' }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

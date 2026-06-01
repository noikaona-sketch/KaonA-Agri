'use client';

import { useEffect, useState } from 'react';

type Season = {
  id: string; name: string; season_year: number;
  starts_at: string; ends_at: string;
  bonus_type: 'per_ton' | 'per_rai'; bonus_value: number;
  is_active: boolean; note: string | null;
};

const S = {
  label: { display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  input: { padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, width: '100%', background: '#fff' } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'grid', gap: 10 } as React.CSSProperties,
};

const BONUS_LABEL: Record<string, string> = {
  per_ton: 'บาท/ตัน — คำนวณเมื่อชั่งน้ำหนัก',
  per_rai: 'บาท/ไร่ — คำนวณจากพื้นที่แปลง',
};

export function AdminNoBurnSeasons() {
  const [seasons,   setSeasons]   = useState<Season[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [notice,    setNotice]    = useState<{ ok: boolean; msg: string } | null>(null);

  // Form state
  const [name,       setName]       = useState('');
  const [year,       setYear]       = useState(String(new Date().getFullYear() + 543));
  const [startsAt,   setStartsAt]   = useState('');
  const [endsAt,     setEndsAt]     = useState('');
  const [bonusType,  setBonusType]  = useState<'per_ton' | 'per_rai'>('per_ton');
  const [bonusValue, setBonusValue] = useState('');
  const [note,       setNote]       = useState('');
  const [isActive,   setIsActive]   = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/no-burn/seasons', { credentials: 'include' });
    const d = (await res.json()) as { seasons?: Season[] };
    setSeasons(d.seasons ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function openNew() {
    setEditId(null);
    setName(''); setYear(String(new Date().getFullYear() + 543));
    setStartsAt(''); setEndsAt('');
    setBonusType('per_ton'); setBonusValue('');
    setNote(''); setIsActive(true);
    setShowForm(true);
  }

  function openEdit(s: Season) {
    setEditId(s.id);
    setName(s.name); setYear(String(s.season_year));
    setStartsAt(s.starts_at); setEndsAt(s.ends_at);
    setBonusType(s.bonus_type); setBonusValue(String(s.bonus_value));
    setNote(s.note ?? ''); setIsActive(s.is_active);
    setShowForm(true);
  }

  async function save() {
    if (!name.trim() || !startsAt || !endsAt || !bonusValue) {
      setNotice({ ok: false, msg: 'กรุณากรอกข้อมูลให้ครบ' }); return;
    }
    if (Number(bonusValue) < 0) {
      setNotice({ ok: false, msg: 'โบนัสต้องไม่ติดลบ' }); return;
    }
    setSaving(true); setNotice(null);

    const res = await fetch('/api/admin/no-burn/seasons', {
      method: editId ? 'PATCH' : 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editId,
        name: name.trim(), season_year: Number(year),
        starts_at: startsAt, ends_at: endsAt,
        bonus_type: bonusType, bonus_value: Number(bonusValue),
        is_active: isActive, note: note.trim() || null,
      }),
    });

    const data = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok || !data.ok) { setNotice({ ok: false, msg: data.error ?? 'บันทึกไม่สำเร็จ' }); return; }
    setNotice({ ok: true, msg: editId ? '✅ แก้ไขรอบแล้ว' : '✅ สร้างรอบใหม่แล้ว' });
    setShowForm(false);
    void load();
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🌿 รอบโครงการไม่เผา</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>ตั้งโบนัสแต่ละรอบ — สมาชิกเลือกรอบตอนลงทะเบียน</p>
        </div>
        <button onClick={openNew}
          style={{ padding: '9px 16px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          + สร้างรอบใหม่
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
        <div style={{ ...S.card, border: '2px solid #2e7d32' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
              {editId ? '✏️ แก้ไขรอบ' : '+ สร้างรอบโครงการใหม่'}
            </p>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 18 }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <label style={S.label}>
              ชื่อรอบ <span style={{ color: '#dc2626' }}>*</span>
              <input style={S.input} value={name} onChange={(e) => setName(e.target.value)}
                placeholder="เช่น ฤดูกาล 2569 รอบ 1" />
            </label>
            <label style={S.label}>
              ปี พ.ศ.
              <input style={S.input} type="number" value={year}
                onChange={(e) => setYear(e.target.value)} />
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label style={S.label}>
              วันเริ่มต้น <span style={{ color: '#dc2626' }}>*</span>
              <input style={S.input} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </label>
            <label style={S.label}>
              วันสิ้นสุด <span style={{ color: '#dc2626' }}>*</span>
              <input style={S.input} type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </label>
          </div>

          {/* Bonus type — radio cards */}
          <div style={{ display: 'grid', gap: 6 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#374151' }}>ประเภทโบนัส <span style={{ color: '#dc2626' }}>*</span></p>
            {(['per_ton', 'per_rai'] as const).map((t) => (
              <button key={t} onClick={() => setBonusType(t)} style={{
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                border: `2px solid ${bonusType === t ? '#2e7d32' : '#e5e7eb'}`,
                background: bonusType === t ? '#f0fdf4' : '#fff',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${bonusType === t ? '#2e7d32' : '#d1d5db'}`,
                  background: bonusType === t ? '#2e7d32' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {bonusType === t && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: bonusType === t ? '#2e7d32' : '#111' }}>
                    {t === 'per_ton' ? '⚖️ บาท/ตัน' : '🗺️ บาท/ไร่'}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>
                    {t === 'per_ton' ? 'คำนวณจากน้ำหนักที่ขายจริง — ยิ่งขายมากยิ่งได้มาก' : 'คำนวณจากพื้นที่แปลง — ได้ทันทีที่ตรวจผ่าน'}
                  </p>
                </div>
              </button>
            ))}
          </div>

          <label style={S.label}>
            จำนวนโบนัส ({bonusType === 'per_ton' ? 'บาท/ตัน' : 'บาท/ไร่'}) <span style={{ color: '#dc2626' }}>*</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input style={{ ...S.input, flex: 1 }} type="number" min="0" step="0.01"
                value={bonusValue} onChange={(e) => setBonusValue(e.target.value)}
                placeholder={bonusType === 'per_ton' ? 'เช่น 100' : 'เช่น 200'} />
              <span style={{ fontSize: 13, color: '#6b7280', whiteSpace: 'nowrap' }}>
                {bonusType === 'per_ton' ? 'บาท/ตัน' : 'บาท/ไร่'}
              </span>
            </div>
            {bonusValue && (
              <p style={{ margin: 0, fontSize: 11, color: '#059669' }}>
                {bonusType === 'per_ton'
                  ? `เกษตรกรขาย 10 ตัน → โบนัส ${(Number(bonusValue) * 10).toLocaleString()} บาท`
                  : `แปลง 5 ไร่ → โบนัส ${(Number(bonusValue) * 5).toLocaleString()} บาท`}
              </p>
            )}
          </label>

          <label style={S.label}>
            หมายเหตุ (admin)
            <input style={S.input} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="เงื่อนไขพิเศษ เหตุผลการตั้งโบนัส ฯลฯ" />
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>เปิดใช้งาน (สมาชิกเห็นและเลือกรอบนี้ได้)</span>
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 14, cursor: 'pointer' }}>
              ยกเลิก
            </button>
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 14, cursor: saving ? 'wait' : 'pointer' }}>
              {saving ? '⏳ กำลังบันทึก…' : editId ? '💾 บันทึกการแก้ไข' : '+ สร้างรอบ'}
            </button>
          </div>
        </div>
      )}

      {/* Seasons list */}
      {loading && <p style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>กำลังโหลด…</p>}
      {!loading && seasons.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <p style={{ fontSize: 32, margin: '0 0 8px' }}>🌿</p>
          <p style={{ fontSize: 14, margin: 0 }}>ยังไม่มีรอบโครงการ — กด "สร้างรอบใหม่" เพื่อเริ่ม</p>
        </div>
      )}
      {seasons.map((s) => (
        <div key={s.id} style={{ ...S.card, opacity: s.is_active ? 1 : 0.6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{s.name}</p>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: s.is_active ? '#f0fdf4' : '#f3f4f6', color: s.is_active ? '#14532d' : '#6b7280', border: `1px solid ${s.is_active ? '#86efac' : '#e5e7eb'}`, fontWeight: 600 }}>
                  {s.is_active ? '✅ เปิดอยู่' : '⏸ ปิด'}
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                {s.starts_at} → {s.ends_at}
              </p>
            </div>
            <button onClick={() => openEdit(s)} style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#374151', whiteSpace: 'nowrap' }}>
              ✏️ แก้ไข
            </button>
          </div>

          {/* Bonus highlight */}
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{s.bonus_type === 'per_ton' ? '⚖️' : '🗺️'}</span>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 18, color: '#14532d' }}>
                +{s.bonus_value.toLocaleString()} บาท/{s.bonus_type === 'per_ton' ? 'ตัน' : 'ไร่'}
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>{BONUS_LABEL[s.bonus_type]}</p>
            </div>
          </div>

          {s.note && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>📝 {s.note}</p>}
        </div>
      ))}
    </div>
  );
}

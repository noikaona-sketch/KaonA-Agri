'use client';

import { useState } from 'react';

type Props = {
  inspectionId  : string;
  labName?      : string | null;
  labSubmittedAt?: string | null;
  currentPh?    : number | null;
  currentOm?    : number | null;
  currentNote?  : string | null;
  onSaved?      : () => void;
};

const S = {
  label: { display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  input: { padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, width: '100%', background: '#fff' } as React.CSSProperties,
};

export function AdminLabResultForm({
  inspectionId, labName, labSubmittedAt, currentPh, currentOm, currentNote, onSaved,
}: Props) {
  const [ph,        setPh]        = useState(currentPh   != null ? String(currentPh)  : '');
  const [om,        setOm]        = useState(currentOm   != null ? String(currentOm)  : '');
  const [note,      setNote]      = useState(currentNote ?? '');
  const [resultAt,  setResultAt]  = useState('');
  const [saving,    setSaving]    = useState(false);
  const [notice,    setNotice]    = useState<{ ok: boolean; msg: string } | null>(null);

  async function save() {
    if (!resultAt) { setNotice({ ok: false, msg: 'กรุณาระบุวันที่ได้รับผล' }); return; }
    setSaving(true); setNotice(null);

    const res = await fetch('/api/admin/inspections/lab-result', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inspection_id: inspectionId,
        lab_result_at: resultAt,
        lab_ph:          ph   ? Number(ph)  : null,
        lab_om_pct:      om   ? Number(om)  : null,
        lab_result_note: note.trim() || null,
      }),
    });

    const data = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok || !data.ok) { setNotice({ ok: false, msg: data.error ?? 'บันทึกไม่สำเร็จ' }); return; }
    setNotice({ ok: true, msg: '✅ บันทึกผลแล็บแล้ว' });
    onSaved?.();
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Lab context */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 14px' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#92400e' }}>🧪 ส่งดินตรวจแล็บ — รอผล</p>
        {labName        && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#92400e' }}>แล็บ: {labName}</p>}
        {labSubmittedAt && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#92400e' }}>ส่งเมื่อ: {labSubmittedAt}</p>}
      </div>

      {notice && (
        <div style={{
          padding: '9px 13px', borderRadius: 9, fontSize: 13, fontWeight: 600,
          background: notice.ok ? '#ecfdf5' : '#fef2f2',
          color:      notice.ok ? '#14532d' : '#991b1b',
          border:    `1px solid ${notice.ok ? '#86efac' : '#fca5a5'}`,
        }}>
          {notice.msg}
        </div>
      )}

      <label style={S.label}>
        วันที่ได้รับผล <span style={{ color: '#dc2626' }}>*</span>
        <input style={S.input} type="date" value={resultAt} onChange={(e) => setResultAt(e.target.value)} />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={S.label}>
          pH ดิน
          <input style={S.input} type="number" step="0.1" min="0" max="14"
            placeholder="เช่น 6.5" value={ph} onChange={(e) => setPh(e.target.value)} />
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>ปกติ 5.5–7.0</span>
        </label>
        <label style={S.label}>
          อินทรียวัตถุ (%)
          <input style={S.input} type="number" step="0.01" min="0" max="100"
            placeholder="เช่น 2.5" value={om} onChange={(e) => setOm(e.target.value)} />
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 400 }}>ดีมาก &gt; 3.5%</span>
        </label>
      </div>

      <label style={S.label}>
        หมายเหตุ / คำแนะนำจากแล็บ
        <textarea style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} rows={3}
          placeholder="เช่น ดินเป็นกรด ควรใส่ปูนขาว, พบธาตุอาหารขาด N/P/K…"
          value={note} onChange={(e) => setNote(e.target.value)} />
      </label>

      <button
        onClick={save} disabled={saving}
        style={{
          padding: '12px 0', borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer',
          background: saving ? '#e5e7eb' : '#1d4ed8', color: saving ? '#9ca3af' : '#fff',
          fontWeight: 700, fontSize: 14,
        }}>
        {saving ? '⏳ กำลังบันทึก…' : '💾 บันทึกผลแล็บ'}
      </button>
    </div>
  );
}

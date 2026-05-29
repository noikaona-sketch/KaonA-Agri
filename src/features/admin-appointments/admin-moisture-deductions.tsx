'use client';

import { useEffect, useState } from 'react';

type Row = {
  id: string; moisture_pct: number;
  weight_deduct_pct: number; price_adjust_per_kg: number;
  drying_days_per_pct: number; note: string | null; is_active: boolean;
};

const EMPTY = { moisture_pct: '', weight_deduct_pct: '0', price_adjust_per_kg: '0', drying_days_per_pct: '1', note: '' };

export function AdminMoistureDeductions() {
  const [rows,    setRows]    = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [notice,  setNotice]  = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const d = (await (await fetch('/api/admin/moisture-deductions', { credentials: 'include' })).json()) as { rows?: Row[] };
    setRows((d.rows ?? []).filter((r) => r.is_active).sort((a, b) => b.moisture_pct - a.moisture_pct));
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function field(k: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  async function save() {
    if (!form.moisture_pct) { setNotice('❌ กรุณากรอกความชื้น'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/moisture-deductions', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moisture_pct:        Number(form.moisture_pct),
        weight_deduct_pct:   Number(form.weight_deduct_pct),
        price_adjust_per_kg: Number(form.price_adjust_per_kg),
        drying_days_per_pct: Number(form.drying_days_per_pct),
        note:                form.note || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice(`✅ บันทึกความชื้น ${form.moisture_pct}% แล้ว`);
    setForm(EMPTY); await load();
  }

  async function remove(id: string, pct: number) {
    if (!confirm(`ลบแถวความชื้น ${pct}% ?`)) return;
    await fetch('/api/admin/moisture-deductions', { credentials: 'include',  method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await load();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828', display: 'flex', justifyContent: 'space-between' }}>
          <span>{notice}</span><button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#9ca3af' }}>✕</button>
        </div>
      )}

      {/* ตารางปัจจุบัน */}
      <div className="kaona-card">
        <p style={{ margin: '0 0 12px', fontWeight: 700 }}>📋 ตารางส่วนลดตามความชื้น (ข้าวโพด)</p>
        {loading ? <p style={{ color: '#9ca3af', fontSize: 13 }}>กำลังโหลด…</p> : rows.length === 0 ? (
          <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>ยังไม่มีข้อมูล — กรอกด้านล่างเพื่อเพิ่ม</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ความชื้น (%)</th>
                  <th>หัก % น้ำหนัก</th>
                  <th>บวกราคา บาท/กก.</th>
                  <th>วันลด 1%</th>
                  <th>หมายเหตุ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><span style={{ fontWeight: 700, fontSize: 16, color: '#1b5e20' }}>{r.moisture_pct}%</span></td>
                    <td style={{ color: '#c62828', fontWeight: 600 }}>{r.weight_deduct_pct > 0 ? `-${r.weight_deduct_pct}%` : '—'}</td>
                    <td style={{ color: '#2e7d32', fontWeight: 600 }}>{r.price_adjust_per_kg > 0 ? `+${Number(r.price_adjust_per_kg).toFixed(2)} ฿` : '—'}</td>
                    <td style={{ color: '#6b7280' }}>{r.drying_days_per_pct} วัน/1%</td>
                    <td style={{ fontSize: 12, color: '#9ca3af' }}>{r.note ?? '—'}</td>
                    <td>
                      <button className="admin-btn admin-btn--danger" style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => remove(r.id, r.moisture_pct)}>ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form เพิ่ม/แก้ไข */}
      <div className="kaona-card">
        <p style={{ margin: '0 0 14px', fontWeight: 700 }}>➕ เพิ่ม / อัปเดตแถว</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
          <label className="reg-label">ความชื้น (%) <span className="reg-required">*</span>
            <input className="reg-input" type="number" step="0.5" min="1" max="50" placeholder="เช่น 25" value={form.moisture_pct} onChange={field('moisture_pct')} />
          </label>
          <label className="reg-label">หัก % น้ำหนัก
            <input className="reg-input" type="number" step="0.1" min="0" placeholder="เช่น 5" value={form.weight_deduct_pct} onChange={field('weight_deduct_pct')} />
            <span className="reg-hint">หักออกจากน้ำหนักที่ชั่ง</span>
          </label>
          <label className="reg-label">บวกราคา บาท/กก. (ยิ่งแห้งยิ่งบวกมาก)
            <input className="reg-input" type="number" step="0.01" min="0" placeholder="เช่น 0.30" value={form.price_adjust_per_kg} onChange={field('price_adjust_per_kg')} />
            <span className="reg-hint">บวกเพิ่มจากราคาฐานเปียก 30%</span>
          </label>
          <label className="reg-label">วันที่ใช้ลดความชื้น 1%
            <input className="reg-input" type="number" step="0.1" min="0.5" placeholder="เช่น 1" value={form.drying_days_per_pct} onChange={field('drying_days_per_pct')} />
            <span className="reg-hint">ใช้ประมาณเวลาก่อนเกี่ยว</span>
          </label>
          <label className="reg-label" style={{ gridColumn: '1/-1' }}>หมายเหตุ
            <input className="reg-input" placeholder="เช่น ชื้นปานกลาง" value={form.note} onChange={field('note')} />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : '💾 บันทึก'}
          </button>
        </div>
      </div>
    </div>
  );
}

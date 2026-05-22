'use client';

import { useEffect, useState } from 'react';

type Promo = {
  id: string; title: string; promo_type: 'flat' | 'moisture_below' | null;
  promo_bonus_per_kg: number | null; moisture_threshold: number | null;
  start_date: string; end_date: string; is_active: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  flat:            '🎁 ทุกสมาชิก (flat)',
  moisture_below:  '💧 ความชื้นต่ำกว่า X%',
};

const EMPTY = {
  title: '', promo_type: 'flat' as 'flat' | 'moisture_below',
  promo_bonus_per_kg: '', moisture_threshold: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date:   new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
};

export function AdminPromoList() {
  const [promos,  setPromos]  = useState<Promo[]>([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [notice,  setNotice]  = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res  = await fetch('/api/admin/promos');
    const data = (await res.json()) as { promos?: Promo[] };
    setPromos(data.promos ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function f(k: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  async function save() {
    if (!form.title || !form.promo_bonus_per_kg) { setNotice('❌ กรุณากรอกชื่อและโบนัส'); return; }
    if (form.promo_type === 'moisture_below' && !form.moisture_threshold)
      { setNotice('❌ กรุณากรอกความชื้น threshold'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/promos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:              form.title,
        promo_type:         form.promo_type,
        promo_bonus_per_kg: Number(form.promo_bonus_per_kg),
        moisture_threshold: form.promo_type === 'moisture_below' ? Number(form.moisture_threshold) : null,
        start_date:         form.start_date,
        end_date:           form.end_date,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ บันทึกโปรโมชั่นแล้ว');
    setForm(EMPTY); await load();
  }

  async function deactivate(id: string) {
    if (!confirm('ปิดโปรโมชั่นนี้?')) return;
    await fetch('/api/admin/promos', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await load();
  }

  const now        = new Date().toISOString().slice(0, 10);
  const active     = promos.filter((p) => p.is_active && p.end_date >= now);
  const inactive   = promos.filter((p) => !p.is_active || p.end_date < now);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border:`1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius:10, padding:'10px 14px', fontWeight:600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828', display:'flex', justifyContent:'space-between' }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#9ca3af' }}>✕</button>
        </div>
      )}

      {/* โปรที่ active */}
      <div className="kaona-card">
        <p style={{ margin:'0 0 12px', fontWeight:700 }}>🎁 โปรโมชั่นที่ใช้งานอยู่</p>
        {loading ? <p style={{ color:'#9ca3af', fontSize:13 }}>กำลังโหลด…</p>
         : active.length === 0 ? <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:'12px 0' }}>ไม่มีโปรที่ active</p>
         : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {active.map((p) => (
              <div key={p.id} style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:10, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
                <div style={{ flex:1 }}>
                  <p style={{ margin:'0 0 3px', fontWeight:600, fontSize:14 }}>{p.title}</p>
                  <p style={{ margin:'0 0 2px', fontSize:12, color:'#166534' }}>
                    {TYPE_LABEL[p.promo_type ?? ''] ?? p.promo_type}
                    {p.promo_type === 'moisture_below' && p.moisture_threshold && ` (ความชื้น < ${p.moisture_threshold}%)`}
                  </p>
                  <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#166534' }}>
                    +{Number(p.promo_bonus_per_kg).toFixed(2)} บาท/กก.
                    <span style={{ fontWeight:400, color:'#6b7280', marginLeft:8, fontSize:11 }}>
                      ถึง {new Date(p.end_date).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' })}
                    </span>
                  </p>
                </div>
                <button className="admin-btn admin-btn--danger" style={{ fontSize:11, padding:'3px 8px', flexShrink:0 }}
                  onClick={() => deactivate(p.id)}>ปิด</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form สร้างโปรใหม่ */}
      <div className="kaona-card">
        <p style={{ margin:'0 0 14px', fontWeight:700 }}>➕ สร้างโปรโมชั่นใหม่</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <label className="reg-label" style={{ gridColumn:'1/-1' }}>ชื่อโปรโมชั่น <span className="reg-required">✱</span>
            <input className="reg-input" placeholder="เช่น โบนัสสมาชิก มิ.ย. 2569" value={form.title} onChange={f('title')} />
          </label>
          <label className="reg-label">ประเภทโปร <span className="reg-required">✱</span>
            <select className="reg-input" value={form.promo_type} onChange={f('promo_type')}>
              <option value="flat">🎁 ทุกสมาชิก (flat)</option>
              <option value="moisture_below">💧 ความชื้นต่ำกว่า X%</option>
            </select>
          </label>
          {form.promo_type === 'moisture_below' && (
            <label className="reg-label">ความชื้นสูงสุด (%) <span className="reg-required">✱</span>
              <input className="reg-input" type="number" step="0.5" placeholder="เช่น 30" value={form.moisture_threshold} onChange={f('moisture_threshold')} />
              <span className="reg-hint">ความชื้น &lt; ค่านี้จึงได้โปร</span>
            </label>
          )}
          <label className="reg-label">โบนัส (บาท/กก.) <span className="reg-required">✱</span>
            <input className="reg-input" type="number" step="0.01" min="0" placeholder="เช่น 0.05" value={form.promo_bonus_per_kg} onChange={f('promo_bonus_per_kg')} />
          </label>
          <label className="reg-label">วันเริ่ม
            <input className="reg-input" type="date" value={form.start_date} onChange={f('start_date')} />
          </label>
          <label className="reg-label">วันสิ้นสุด
            <input className="reg-input" type="date" value={form.end_date} onChange={f('end_date')} />
          </label>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
          <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : '🎁 เพิ่มโปรโมชั่น'}
          </button>
        </div>
      </div>

      {/* โปรที่หมดแล้ว */}
      {inactive.length > 0 && (
        <div className="kaona-card">
          <p style={{ margin:'0 0 12px', fontWeight:700, color:'#9ca3af' }}>⏰ โปรที่สิ้นสุดแล้ว</p>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {inactive.map((p) => (
              <div key={p.id} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid #f0f4f0' }}>
                <span style={{ fontSize:13, color:'#9ca3af' }}>{p.title}</span>
                <span style={{ fontSize:12, color:'#9ca3af' }}>
                  +{Number(p.promo_bonus_per_kg).toFixed(2)} ฿/กก. &nbsp;|&nbsp;
                  ถึง {new Date(p.end_date).toLocaleDateString('th-TH', { day:'numeric', month:'short' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

type Location = {
  id: string; name: string; address: string | null; map_url: string | null; active: boolean;
  accepts_wet: boolean; accepts_dry: boolean;
  dryer_capacity_kg: number | null;
  default_wet_quota_kg: number | null; default_dry_quota_kg: number | null;
  sort_order: number;
};

const fmt = (n: number | null) => n ? (n / 1000).toFixed(0) + ' ต.' : 'ไม่จำกัด';

const EMPTY = {
  name: '', address: '', map_url: '',
  accepts_wet: true, accepts_dry: true,
  dryer_capacity_kg: '', default_wet_quota_kg: '30000', default_dry_quota_kg: '',
};

export function AdminPickupLocations({ onSaved }: { onSaved?: () => void }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [form,      setForm]      = useState(EMPTY);
  const [editing,   setEditing]   = useState<Location | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [notice,    setNotice]    = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/pickup-slots');
    const d   = (await res.json()) as { locations?: Location[] };
    setLocations(d.locations ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    const payload = editing
      ? { id: editing.id, action: 'update_location', name: editing.name, address: editing.address,
          accepts_wet: editing.accepts_wet, accepts_dry: editing.accepts_dry,
          dryer_capacity_kg: editing.dryer_capacity_kg,
          default_wet_quota_kg: editing.default_wet_quota_kg,
          default_dry_quota_kg: editing.default_dry_quota_kg }
      : { action: 'create_location', ...form,
          dryer_capacity_kg:    form.accepts_wet && form.dryer_capacity_kg ? Number(form.dryer_capacity_kg) : null,
          default_wet_quota_kg: form.accepts_wet ? Number(form.default_wet_quota_kg) : null,
          default_dry_quota_kg: form.accepts_dry && form.default_dry_quota_kg ? Number(form.default_dry_quota_kg) : null,
        };
    setSaving(true);
    const res = await fetch('/api/admin/pickup-slots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    const d = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice(editing ? '✅ แก้ไขจุดรับแล้ว' : '✅ เพิ่มจุดรับแล้ว');
    setEditing(null); setForm(EMPTY); await load(); onSaved?.();
  }

  const src = editing ?? null;

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border:`1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius:10, padding:'10px 14px', fontWeight:600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828', display:'flex', justifyContent:'space-between' }}>
          <span>{notice}</span><button onClick={() => setNotice(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#9ca3af' }}>✕</button>
        </div>
      )}

      {/* จุดรับที่มีอยู่ */}
      {!loading && locations.map((loc) => (
        <div key={loc.id} className="kaona-card" style={{ padding:'12px 14px' }}>
          {editing?.id === loc.id ? (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <label className="reg-label">ชื่อจุด <span className="reg-required">✱</span>
                  <input className="reg-input" value={editing.name} onChange={(e) => setEditing((p) => p ? { ...p, name:e.target.value } : p)} />
                </label>
                <label className="reg-label">ที่อยู่
                  <input className="reg-input" value={editing.address ?? ''} onChange={(e) => setEditing((p) => p ? { ...p, address:e.target.value } : p)} />
                </label>
              </div>
              <div style={{ display:'flex', gap:16 }}>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" checked={editing.accepts_wet} onChange={(e) => setEditing((p) => p ? { ...p, accepts_wet:e.target.checked } : p)} />
                  💧 รับเปียก
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
                  <input type="checkbox" checked={editing.accepts_dry} onChange={(e) => setEditing((p) => p ? { ...p, accepts_dry:e.target.checked } : p)} />
                  🌾 รับแห้ง
                </label>
              </div>
              {editing.accepts_wet && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <label className="reg-label">โควต้าเปียก/วัน (กก.)
                    <input className="reg-input" type="number" value={editing.default_wet_quota_kg ?? ''} onChange={(e) => setEditing((p) => p ? { ...p, default_wet_quota_kg: e.target.value ? Number(e.target.value) : null } : p)} placeholder="เช่น 30000" />
                    <span className="reg-hint">null = ไม่จำกัด</span>
                  </label>
                  <label className="reg-label">ความจุเครื่องอบ/วัน (กก.)
                    <input className="reg-input" type="number" value={editing.dryer_capacity_kg ?? ''} onChange={(e) => setEditing((p) => p ? { ...p, dryer_capacity_kg: e.target.value ? Number(e.target.value) : null } : p)} placeholder="ว่าง = ไม่มีเครื่องอบ" />
                  </label>
                </div>
              )}
              <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                <button className="admin-btn admin-btn--secondary" onClick={() => setEditing(null)} style={{ fontSize:12 }}>ยกเลิก</button>
                <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving} style={{ fontSize:12 }}>💾 บันทึก</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:12 }}>
              <div style={{ flex:1 }}>
                <p style={{ margin:'0 0 4px', fontWeight:700, fontSize:14 }}>{loc.name}</p>
                {loc.address && <p style={{ margin:'0 0 6px', fontSize:12, color:'#6b7280' }}>{loc.address}</p>}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                  {loc.accepts_wet && (
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'#E6F1FB', color:'#0C447C' }}>
                      💧 เปียก {fmt(loc.default_wet_quota_kg)}/วัน
                      {loc.dryer_capacity_kg && ` · อบ ${fmt(loc.dryer_capacity_kg)}/วัน`}
                    </span>
                  )}
                  {loc.accepts_dry && (
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:'#EAF3DE', color:'#27500A' }}>
                      🌾 แห้ง {fmt(loc.default_dry_quota_kg)}/วัน
                    </span>
                  )}
                </div>
              </div>
              <button className="admin-btn admin-btn--ghost" onClick={() => setEditing(loc)} style={{ fontSize:12, flexShrink:0 }}>✏️ แก้ไข</button>
            </div>
          )}
        </div>
      ))}

      {/* เพิ่มจุดรับใหม่ */}
      {!editing && (
        <div className="kaona-card">
          <p style={{ margin:'0 0 12px', fontWeight:700 }}>➕ เพิ่มจุดรับใหม่</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <label className="reg-label">ชื่อจุด <span className="reg-required">✱</span>
              <input className="reg-input" value={form.name} placeholder="เช่น จุดรับที่ 2" onChange={(e) => setForm((p) => ({ ...p, name:e.target.value }))} />
            </label>
            <label className="reg-label">ที่อยู่
              <input className="reg-input" value={form.address} placeholder="ที่อยู่หรือจุดสังเกต" onChange={(e) => setForm((p) => ({ ...p, address:e.target.value }))} />
            </label>
          </div>
          <div style={{ display:'flex', gap:16, margin:'10px 0' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
              <input type="checkbox" checked={form.accepts_wet} onChange={(e) => setForm((p) => ({ ...p, accepts_wet:e.target.checked }))} />
              💧 รับเปียก
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
              <input type="checkbox" checked={form.accepts_dry} onChange={(e) => setForm((p) => ({ ...p, accepts_dry:e.target.checked }))} />
              🌾 รับแห้ง
            </label>
          </div>
          {form.accepts_wet && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <label className="reg-label">โควต้าเปียก/วัน (กก.)
                <input className="reg-input" type="number" value={form.default_wet_quota_kg} placeholder="เช่น 20000" onChange={(e) => setForm((p) => ({ ...p, default_wet_quota_kg:e.target.value }))} />
              </label>
              <label className="reg-label">ความจุเครื่องอบ/วัน (กก.)
                <input className="reg-input" type="number" value={form.dryer_capacity_kg} placeholder="ว่าง = ไม่มีเครื่องอบ" onChange={(e) => setForm((p) => ({ ...p, dryer_capacity_kg:e.target.value }))} />
              </label>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:10 }}>
            <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving || !form.name}>
              {saving ? 'กำลังบันทึก…' : '➕ เพิ่มจุดรับ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

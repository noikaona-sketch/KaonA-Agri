'use client';

import { useEffect, useState } from 'react';

type ApiKey = {
  id: string; name: string; location_id: string; is_active: boolean;
  last_used_at: string | null; created_at: string;
  pickup_locations: { name: string } | null;
};
type Location = { id: string; name: string };

const thDate = (s: string | null) => s
  ? new Date(s).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })
  : 'ยังไม่เคยใช้';

export function AdminApiKeyList() {
  const [keys,      setKeys]      = useState<ApiKey[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [form,      setForm]      = useState({ name:'', location_id:'' });
  const [saving,    setSaving]    = useState(false);
  const [newKey,    setNewKey]    = useState<string | null>(null);
  const [notice,    setNotice]    = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [kRes, lRes] = await Promise.all([
      fetch('/api/admin/factory-api-keys').then(r => r.json()) as Promise<{ keys?: ApiKey[] }>,
      fetch('/api/admin/pickup-slots').then(r => r.json()) as Promise<{ locations?: Location[] }>,
    ]);
    setKeys(kRes.keys ?? []);
    setLocations(lRes.locations ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    if (!form.name || !form.location_id) { setNotice('❌ กรุณากรอกชื่อและจุดรับ'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/factory-api-keys', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form),
    });
    setSaving(false);
    const d = (await res.json()) as { ok?: boolean; raw_key?: string; error?: string };
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNewKey(d.raw_key ?? null);
    setForm({ name:'', location_id:'' });
    await load();
  }

  async function deactivate(id: string) {
    if (!confirm('ปิดใช้งาน API key นี้?')) return;
    await fetch('/api/admin/factory-api-keys', {
      method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id }),
    });
    await load();
  }

  const active   = keys.filter(k => k.is_active);
  const inactive = keys.filter(k => !k.is_active);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {notice && (
        <div style={{ background:notice.startsWith('✅')?'#ecfdf5':'#fef2f2', border:`1px solid ${notice.startsWith('✅')?'#86efac':'#fca5a5'}`, borderRadius:10, padding:'10px 14px', fontWeight:600, color:notice.startsWith('✅')?'#14532d':'#991b1b', display:'flex', justifyContent:'space-between' }}>
          <span>{notice}</span>
          <button onClick={()=>setNotice(null)} style={{background:'none',border:'none',cursor:'pointer'}}>✕</button>
        </div>
      )}

      {/* แสดง raw key ครั้งเดียว */}
      {newKey && (
        <div style={{ background:'#fefce8', border:'2px solid #fde047', borderRadius:12, padding:'14px 16px' }}>
          <p style={{ margin:'0 0 6px', fontWeight:700, color:'#854d0e', fontSize:14 }}>
            🔑 API Key ใหม่ — บันทึกไว้ก่อน จะไม่แสดงอีก
          </p>
          <code style={{ display:'block', background:'#fff', padding:'10px 12px', borderRadius:8, fontSize:13, wordBreak:'break-all', border:'1px solid #fde047', marginBottom:8 }}>
            {newKey}
          </code>
          <p style={{ margin:'0 0 8px', fontSize:12, color:'#92400e' }}>
            วิธีใช้: ส่ง Header <code>Authorization: Bearer {'{API_KEY}'}</code> ใน POST /api/intake/factory
          </p>
          <div style={{ display:'flex', gap:8 }}>
            <button className="admin-btn admin-btn--secondary" onClick={() => { void navigator.clipboard.writeText(newKey); setNotice('✅ คัดลอกแล้ว'); }}
              style={{ fontSize:12 }}>📋 คัดลอก</button>
            <button className="admin-btn admin-btn--ghost" onClick={() => setNewKey(null)}
              style={{ fontSize:12 }}>ปิด (ฉันบันทึกแล้ว)</button>
          </div>
        </div>
      )}

      {/* Active keys */}
      <div className="kaona-card">
        <p style={{ margin:'0 0 12px', fontWeight:700 }}>🔑 API Keys ที่ใช้งานอยู่ ({active.length})</p>
        {loading && <p style={{ color:'#9ca3af', fontSize:13 }}>กำลังโหลด…</p>}
        {!loading && active.length === 0 && (
          <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:12 }}>ยังไม่มี API key</p>
        )}
        {active.map(k => (
          <div key={k.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'10px 0', borderBottom:'0.5px solid #f0f4f0', gap:12 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:'0 0 2px', fontWeight:600, fontSize:13 }}>{k.name}</p>
              <p style={{ margin:'0 0 2px', fontSize:11, color:'#6b7280' }}>
                📍 {(k.pickup_locations as { name: string } | null)?.name ?? '—'}
              </p>
              <p style={{ margin:0, fontSize:11, color:'#9ca3af' }}>ใช้ล่าสุด: {thDate(k.last_used_at)}</p>
            </div>
            <button className="admin-btn admin-btn--danger" onClick={() => deactivate(k.id)}
              style={{ fontSize:11, padding:'3px 10px', flexShrink:0 }}>ปิดใช้</button>
          </div>
        ))}
      </div>

      {/* สร้าง key ใหม่ */}
      <div className="kaona-card">
        <p style={{ margin:'0 0 12px', fontWeight:700 }}>➕ สร้าง API Key ใหม่</p>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <label className="reg-label">ชื่อระบบ <span className="reg-required">✱</span>
            <input className="reg-input" placeholder="เช่น ScaleSystem-01"
              value={form.name} onChange={e => setForm(p => ({...p, name:e.target.value}))} />
          </label>
          <label className="reg-label">จุดรับ <span className="reg-required">✱</span>
            <select className="reg-input" value={form.location_id} onChange={e => setForm(p => ({...p, location_id:e.target.value}))}>
              <option value="">— เลือกจุดรับ —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </label>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:12 }}>
          <button className="admin-btn admin-btn--primary" onClick={create} disabled={saving}>
            {saving ? 'กำลังสร้าง…' : '🔑 สร้าง API Key'}
          </button>
        </div>
      </div>

      {inactive.length > 0 && (
        <div className="kaona-card">
          <p style={{ margin:'0 0 8px', fontWeight:700, color:'#9ca3af' }}>⛔ ปิดใช้งานแล้ว ({inactive.length})</p>
          {inactive.map(k => (
            <div key={k.id} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'0.5px solid #f0f4f0' }}>
              <span style={{ fontSize:12, color:'#9ca3af' }}>{k.name}</span>
              <span style={{ fontSize:11, color:'#d1d5db' }}>{(k.pickup_locations as { name: string } | null)?.name ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

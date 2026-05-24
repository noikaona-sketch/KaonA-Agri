'use client';

import { useEffect, useState } from 'react';

type Template = {
  id: string; location_id: string; day_of_week: number; day_label: string;
  default_capacity_kg_dryer: number; default_capacity_kg_dry: number;
  default_time: string; is_active: boolean;
};
type Location = { id: string; name: string };
type SlotDay  = {
  id: string; pickup_date: string; pickup_time: string;
  capacity_kg_dryer: number | null; capacity_kg_dry: number | null;
  booked_kg_dryer: number; booked_kg_dry: number; status: string;
  pickup_locations: { name: string } | null;
};

const fmt = (n: number) => (n / 1000).toFixed(1);

function UtilBar({ booked, cap, color }: { booked: number; cap: number | null; color: string }) {
  if (!cap) return <span style={{ fontSize:11, color:'#9ca3af' }}>ไม่จำกัด</span>;
  const pct = Math.min(100, Math.round((booked / cap) * 100));
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, background:'#e5e7eb', borderRadius:99, height:6, overflow:'hidden', minWidth:60 }}>
        <div style={{ width:`${pct}%`, height:'100%', borderRadius:99, background:
          pct>=90 ? '#c62828' : pct>=70 ? '#854d0e' : color }} />
      </div>
      <span style={{ fontSize:11, color:'#6b7280', whiteSpace:'nowrap' }}>
        {fmt(booked)}/{fmt(cap)} ต.
      </span>
    </div>
  );
}

export function AdminIntakeQuota() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [slots,     setSlots]     = useState<SlotDay[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [notice,    setNotice]    = useState<string | null>(null);
  const [editing,   setEditing]   = useState<Template | null>(null);

  async function load() {
    setLoading(true);
    const [tRes, sRes] = await Promise.all([
      fetch('/api/admin/intake-quota', { credentials: 'include' }).then((r) => r.json()) as Promise<{ templates: Template[]; locations: Location[] }>,
      fetch('/api/admin/pickup-slots', { credentials: 'include' }).then((r) => r.json()) as Promise<{ slots: SlotDay[] }>,
    ]);
    setTemplates(tRes.templates ?? []);
    setLocations(tRes.locations ?? []);
    setSlots((sRes.slots ?? []).filter((s) => s.capacity_kg_dryer !== undefined));
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch('/api/admin/intake-quota', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ บันทึกแล้ว'); setEditing(null); await load();
  }

  async function createSlotFromTemplate(tmpl: Template) {
    const today = new Date();
    // หาวันถัดไปที่ตรงกับ day_of_week
    const daysAhead = (tmpl.day_of_week - today.getDay() + 7) % 7 || 7;
    const date      = new Date(today);
    date.setDate(today.getDate() + daysAhead);
    const dateStr   = date.toISOString().slice(0, 10);
    setSaving(true);
    await fetch('/api/admin/pickup-slots', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location_id:         tmpl.location_id,
        pickup_date:         dateStr,
        pickup_time:         tmpl.default_time,
        capacity_kg_dryer:   tmpl.default_capacity_kg_dryer,
        capacity_kg_dry:     tmpl.default_capacity_kg_dry,
        capacity_qty:        Math.round((tmpl.default_capacity_kg_dryer + tmpl.default_capacity_kg_dry) / 500),
      }),
    });
    setSaving(false);
    setNotice(`✅ สร้าง slot วัน${tmpl.day_label} ${dateStr} แล้ว`);
    await load();
  }

  const locMap = Object.fromEntries(locations.map((l) => [l.id, l.name]));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border:`1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius:10, padding:'10px 14px', fontWeight:600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828', display:'flex', justifyContent:'space-between' }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'#9ca3af' }}>✕</button>
        </div>
      )}

      {/* Slot ที่มีอยู่ — utilization */}
      {slots.length > 0 && (
        <div className="kaona-card">
          <p style={{ margin:'0 0 12px', fontWeight:700 }}>📊 สถานะรับซื้อวันที่เปิด</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>วันที่</th><th>จุด</th><th>เข้าอบ (ตัน)</th><th>ขายแห้ง (ตัน)</th><th>สถานะ</th></tr>
              </thead>
              <tbody>
                {slots.slice(0, 10).map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight:600 }}>{new Date(s.pickup_date).toLocaleDateString('th-TH', { weekday:'short', day:'numeric', month:'short' })}</td>
                    <td style={{ fontSize:12, color:'#6b7280' }}>{s.pickup_locations?.name ?? '—'}</td>
                    <td><UtilBar booked={s.booked_kg_dryer} cap={s.capacity_kg_dryer} color="#1565c0" /></td>
                    <td><UtilBar booked={s.booked_kg_dry}   cap={s.capacity_kg_dry}   color="#2e7d32" /></td>
                    <td><span style={{ fontSize:11, padding:'2px 7px', borderRadius:10, background: s.status==='open' ? '#e8f5e9' : '#f5f5f5', color: s.status==='open' ? '#2e7d32' : '#9e9e9e' }}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Template โควต้ารายวัน */}
      <div className="kaona-card">
        <p style={{ margin:'0 0 4px', fontWeight:700 }}>⚙️ โควต้า default รายวัน</p>
        <p style={{ margin:'0 0 12px', fontSize:12, color:'#9ca3af' }}>กดสร้าง slot ได้ทันทีตาม template — admin แก้ไขได้ก่อนเปิด</p>
        {loading ? <p style={{ color:'#9ca3af', fontSize:13 }}>กำลังโหลด…</p> : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>วัน</th><th>จุด</th><th>เข้าอบ (กก.)</th><th>ขายแห้ง (กก.)</th><th>เวลา</th><th></th></tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    {editing?.id === t.id ? (
                      <>
                        <td style={{ fontWeight:700 }}>{t.day_label}</td>
                        <td style={{ fontSize:12, color:'#6b7280' }}>{locMap[t.location_id] ?? '—'}</td>
                        <td><input className="reg-input" type="number" step="1000" value={editing.default_capacity_kg_dryer}
                          onChange={(e) => setEditing((p) => p ? { ...p, default_capacity_kg_dryer: Number(e.target.value) } : p)}
                          style={{ width:90 }} /></td>
                        <td><input className="reg-input" type="number" step="1000" value={editing.default_capacity_kg_dry}
                          onChange={(e) => setEditing((p) => p ? { ...p, default_capacity_kg_dry: Number(e.target.value) } : p)}
                          style={{ width:90 }} /></td>
                        <td><input className="reg-input" value={editing.default_time}
                          onChange={(e) => setEditing((p) => p ? { ...p, default_time: e.target.value } : p)}
                          style={{ width:110 }} /></td>
                        <td style={{ display:'flex', gap:4 }}>
                          <button className="admin-btn admin-btn--success" onClick={save} disabled={saving} style={{ fontSize:12, minHeight:30, padding:'4px 8px' }}>💾</button>
                          <button className="admin-btn admin-btn--secondary" onClick={() => setEditing(null)} style={{ fontSize:12, minHeight:30, padding:'4px 8px' }}>✕</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ fontWeight:700 }}>{t.day_label}</td>
                        <td style={{ fontSize:12, color:'#6b7280' }}>{locMap[t.location_id] ?? '—'}</td>
                        <td style={{ color:'#1565c0', fontWeight:600 }}>{t.default_capacity_kg_dryer.toLocaleString()} กก.</td>
                        <td style={{ color:'#2e7d32', fontWeight:600 }}>{t.default_capacity_kg_dry.toLocaleString()} กก.</td>
                        <td style={{ fontSize:12, color:'#6b7280' }}>{t.default_time}</td>
                        <td style={{ display:'flex', gap:4 }}>
                          <button className="admin-btn admin-btn--ghost" onClick={() => setEditing(t)} style={{ fontSize:11, minHeight:28, padding:'3px 7px' }}>✏️</button>
                          <button className="admin-btn admin-btn--secondary" onClick={() => createSlotFromTemplate(t)} disabled={saving} style={{ fontSize:11, minHeight:28, padding:'3px 7px' }}>+ slot</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

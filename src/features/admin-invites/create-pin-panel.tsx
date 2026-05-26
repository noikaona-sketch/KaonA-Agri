'use client';

import { useState, useEffect } from 'react';

type Member = { id:string; full_name:string; phone:string|null; status:string };
type PinResult = { member_id:string; name:string; pin:string };

const ROLES    = ['farmer','staff','inspector','leader','truck_owner'];
const TTL_OPTS = [
  { value:24,  label:'24 ชั่วโมง (1 วัน)' },
  { value:72,  label:'72 ชั่วโมง (3 วัน)' },
  { value:168, label:'168 ชั่วโมง (7 วัน)' },
];
const ROLE_LABELS: Record<string,string> = {
  farmer:'🌾 เกษตรกร', staff:'👷 เจ้าหน้าที่', inspector:'🔍 ผู้ตรวจ',
  leader:'👥 หัวหน้ากลุ่ม', truck_owner:'🚛 รถร่วม',
};

export function CreatePinPanel() {
  const [search,    setSearch]    = useState('');
  const [members,   setMembers]   = useState<Member[]>([]);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [role,      setRole]      = useState('farmer');
  const [ttl,       setTtl]       = useState(72);
  const [saving,    setSaving]    = useState(false);
  const [results,   setResults]   = useState<PinResult[]>([]);
  const [error,     setError]     = useState<string|null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!search.trim()) { setMembers([]); return; }
      void fetch(`/api/admin/members?search=${encodeURIComponent(search)}&limit=20`, { credentials:'include' })
        .then(r => r.json())
        .then((d: { members?: Member[] }) => setMembers(d.members ?? []));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  function toggle(id: string) {
    setSelected(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function create() {
    if (!selected.size) { setError('กรุณาเลือกสมาชิกอย่างน้อย 1 คน'); return; }
    setSaving(true); setError(null); setResults([]);
    const res = await fetch('/api/admin/create-pin', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ member_ids:[...selected], role, ttl_hours:ttl }),
    });
    setSaving(false);
    const d = (await res.json()) as { results?: PinResult[]; error?: string };
    if (!res.ok) { setError(d.error ?? 'สร้าง PIN ไม่สำเร็จ'); return; }
    setResults(d.results ?? []);
    setSelected(new Set());
    setSearch('');
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
      {/* Left: ค้นหาและเลือกสมาชิก */}
      <div>
        <p style={{ margin:'0 0 10px', fontWeight:600, fontSize:14, color:'#374151' }}>1. เลือกสมาชิก</p>
        <input className="admin-input" placeholder="ค้นหาชื่อหรือเบอร์โทร…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', marginBottom:10, padding:'9px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }} />

        {/* selected badges */}
        {selected.size > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
            {[...selected].map(id => {
              const m = members.find(x => x.id === id);
              return m ? (
                <span key={id} style={{ fontSize:11, padding:'3px 8px', borderRadius:20, background:'#DBEAFE', color:'#1E40AF', display:'flex', alignItems:'center', gap:4 }}>
                  {m.full_name}
                  <button onClick={() => toggle(id)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#1E40AF', padding:0 }}>✕</button>
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* Search results */}
        <div style={{ border:'1px solid #E5E7EB', borderRadius:8, overflow:'hidden', maxHeight:280, overflowY:'auto' }}>
          {members.length === 0 && search && (
            <p style={{ textAlign:'center', color:'#9CA3AF', fontSize:13, padding:'20px 0' }}>ไม่พบสมาชิก</p>
          )}
          {members.length === 0 && !search && (
            <p style={{ textAlign:'center', color:'#9CA3AF', fontSize:13, padding:'20px 0' }}>พิมพ์เพื่อค้นหาสมาชิก</p>
          )}
          {members.map(m => (
            <div key={m.id} onClick={() => toggle(m.id)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer',
                background: selected.has(m.id) ? '#EFF6FF' : '#fff',
                borderBottom:'1px solid #F3F4F6', transition:'background .1s' }}>
              <input type="checkbox" readOnly checked={selected.has(m.id)}
                style={{ width:15, height:15, accentColor:'#2563EB', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:0, fontWeight:600, fontSize:13, color:'#111' }}>{m.full_name}</p>
                <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{m.phone ?? '—'} · {m.status}</p>
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin:'6px 0 0', fontSize:11, color:'#9CA3AF' }}>
          เลือกแล้ว {selected.size} คน
        </p>
      </div>

      {/* Right: ตั้งค่า + ผลลัพธ์ */}
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div>
          <p style={{ margin:'0 0 10px', fontWeight:600, fontSize:14, color:'#374151' }}>2. ตั้งค่า PIN</p>

          <label style={{ display:'block', marginBottom:12 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:4 }}>บทบาทที่จะผูก</span>
            <select value={role} onChange={e => setRole(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, background:'#fff' }}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </label>

          <label style={{ display:'block', marginBottom:16 }}>
            <span style={{ fontSize:12, fontWeight:600, color:'#6B7280', display:'block', marginBottom:4 }}>อายุ PIN</span>
            <select value={ttl} onChange={e => setTtl(Number(e.target.value))}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, background:'#fff' }}>
              {TTL_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>

          {error && <p style={{ fontSize:12, color:'#DC2626', marginBottom:8 }}>❌ {error}</p>}

          <button onClick={create} disabled={saving || !selected.size}
            style={{ width:'100%', padding:'10px', borderRadius:8, border:'none', background: selected.size?'#1D4ED8':'#E5E7EB',
              color: selected.size?'#fff':'#9CA3AF', fontWeight:600, fontSize:14, cursor: selected.size?'pointer':'not-allowed' }}>
            {saving ? '⏳ กำลังสร้าง…' : `🔑 สร้าง PIN (${selected.size} คน)`}
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div>
            <p style={{ margin:'0 0 8px', fontWeight:600, fontSize:13, color:'#059669' }}>✅ สร้าง PIN สำเร็จ {results.length} คน</p>
            <div style={{ border:'1px solid #D1FAE5', borderRadius:8, overflow:'hidden' }}>
              {results.map(r => (
                <div key={r.member_id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid #D1FAE5', background:'#F0FDF4' }}>
                  <div>
                    <p style={{ margin:0, fontWeight:600, fontSize:13 }}>{r.name}</p>
                    <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>แจ้งสมาชิกใช้ PIN นี้</p>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <code style={{ fontSize:20, fontWeight:800, letterSpacing:4, color:'#1D4ED8', background:'#EFF6FF', padding:'4px 12px', borderRadius:8 }}>
                      {r.pin}
                    </code>
                    <button onClick={() => navigator.clipboard.writeText(r.pin)}
                      style={{ background:'none', border:'1px solid #93C5FD', borderRadius:6, padding:'4px 8px', cursor:'pointer', fontSize:11, color:'#1D4ED8' }}>
                      📋
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ margin:'6px 0 0', fontSize:11, color:'#9CA3AF' }}>
              💡 แจ้ง PIN ให้สมาชิก → เปิดแอป → กรอก PIN → ผูก LINE ได้เลย
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

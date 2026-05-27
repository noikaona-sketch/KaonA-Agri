'use client';

import { useCallback, useEffect, useState } from 'react';
import { Drawer } from '@/shared/components/drawer';

/* ── Types ── */
type GroupMember = {
  id:string; full_name:string; phone:string|null;
  status:string; is_leader:boolean; seedKg:number; areaRai:number;
};
type Group = {
  id:string; name:string; description:string|null; created_at:string;
  memberCount:number; leader:{ id:string; full_name:string }|null;
  totalSeedKg:number; totalAreaRai:number; members:GroupMember[];
};

/* ── Sub components ── */
function StatusDot({ status }: { status:string }) {
  const c = status==='approved'?'#10B981':status==='pending'||status==='pending_approval'?'#F59E0B':'#9CA3AF';
  return <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:c, marginRight:5 }}/>;
}

function Num({ n, unit, color }: { n:number; unit:string; color?:string }) {
  if (!n) return <span style={{ fontSize:12, color:'#D1D5DB' }}>—</span>;
  return <span style={{ fontSize:13, fontWeight:600, color:color??'#111' }}>{n.toLocaleString('th-TH', { maximumFractionDigits:1 })} <span style={{ fontSize:11, color:'#9CA3AF', fontWeight:400 }}>{unit}</span></span>;
}

/* ── Main ── */
export function AdminGroupsTable() {
  const [groups,  setGroups]  = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string|null>(null);
  const [expanded,setExpanded]= useState<Set<string>>(new Set());
  const [drawerGroup, setDrawerGroup] = useState<Group|null>(null);

  // create group
  const [showCreate, setShowCreate] = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newDesc,    setNewDesc]    = useState('');
  const [saving,     setSaving]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/groups/summary', { credentials:'include' });
    const d   = (await res.json()) as { groups?: Group[]; error?: string };
    if (!res.ok) { setError(d.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setGroups(d.groups ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createGroup() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch('/api/admin/groups', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name:newName.trim(), description:newDesc||undefined }),
    });
    setSaving(false);
    if (res.ok) { setNewName(''); setNewDesc(''); setShowCreate(false); void load(); }
  }

  async function deleteGroup(id:string, name:string) {
    if (!confirm(`ลบกลุ่ม "${name}" ?\nสมาชิกในกลุ่มจะไม่ถูกลบ`)) return;
    await fetch(`/api/admin/groups/${id}`, { method:'DELETE', credentials:'include' });
    void load();
  }

  function toggleExpand(id:string) {
    setExpanded(p => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const totalMembers  = groups.reduce((s,g) => s+g.memberCount, 0);
  const totalSeedKg   = groups.reduce((s,g) => s+g.totalSeedKg, 0);
  const totalAreaRai  = groups.reduce((s,g) => s+g.totalAreaRai, 0);

  if (loading) return <p style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>⏳ กำลังโหลด…</p>;
  if (error)   return <p style={{ textAlign:'center', padding:20, color:'#DC2626' }}>❌ {error}</p>;

  return (
    <div>
      {/* Header + create button */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <p style={{ margin:0, fontSize:13, color:'#6B7280' }}>{groups.length} กลุ่ม · {totalMembers} สมาชิก</p>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={load} style={{ padding:'7px 12px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontSize:13 }}>🔄</button>
          <button onClick={() => setShowCreate(p=>!p)}
            style={{ padding:'7px 16px', borderRadius:8, border:'none', background:'#2D6A4F', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer' }}>
            ➕ สร้างกลุ่ม
          </button>
        </div>
      </div>

      {/* Create group panel */}
      {showCreate && (
        <div style={{ background:'#F0FDF4', border:'1.5px solid #6EE7B7', borderRadius:10, padding:'16px 18px', marginBottom:16 }}>
          <p style={{ margin:'0 0 12px', fontWeight:700, fontSize:14 }}>➕ สร้างกลุ่มใหม่</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:4 }}>ชื่อกลุ่ม *</label>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="เช่น กลุ่มบ้านโนนสวรรค์"
                style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' }} />
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6B7280', marginBottom:4 }}>รายละเอียด</label>
              <input value={newDesc} onChange={e=>setNewDesc(e.target.value)} placeholder="ย่อ/อำเภอ"
                style={{ width:'100%', padding:'8px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' }} />
            </div>
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); }}
              style={{ padding:'7px 16px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', fontSize:13, cursor:'pointer' }}>ยกเลิก</button>
            <button onClick={createGroup} disabled={saving||!newName.trim()}
              style={{ padding:'7px 20px', borderRadius:8, border:'none', background:newName.trim()?'#16A34A':'#E5E7EB', color:newName.trim()?'#fff':'#9CA3AF', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {saving?'…':'💾 สร้าง'}
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <div style={{ textAlign:'center', padding:'52px 24px', color:'#9CA3AF' }}>
          <div style={{ fontSize:44, marginBottom:10, opacity:.4 }}>🏘️</div>
          <p style={{ fontSize:15, fontWeight:600, color:'#374151', marginBottom:4 }}>ยังไม่มีกลุ่ม</p>
          <p style={{ fontSize:13 }}>กด "สร้างกลุ่ม" เพื่อเริ่มต้น</p>
        </div>
      )}

      {groups.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.05)' }}>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:640 }}>
              <thead>
                <tr style={{ background:'#F9FAFB', borderBottom:'1.5px solid #E5E7EB' }}>
                  <th style={{ width:36 }}/>
                  {['ชื่อกลุ่ม','หัวหน้า','สมาชิก','จองเมล็ดรวม','พื้นที่รวม',''].map((h,i) => (
                    <th key={i} style={{ padding:'10px 16px', textAlign: i===5?'right':'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((g, gi) => (
                  <>
                    {/* ── Group row ── */}
                    <tr key={g.id} style={{ borderBottom:'1px solid #E5E7EB', background: expanded.has(g.id)?'#F0FDF4':'#fff', transition:'background .1s' }}>
                      <td style={{ padding:'0 0 0 12px', textAlign:'center' }}>
                        <button onClick={() => toggleExpand(g.id)}
                          style={{ background:'none', border:'none', cursor:'pointer', fontSize:14, color:'#9CA3AF', padding:'4px', lineHeight:1, transition:'transform .15s', transform: expanded.has(g.id)?'rotate(90deg)':'rotate(0)' }}>
                          ▶
                        </button>
                      </td>
                      <td style={{ padding:'13px 16px' }}>
                        <p style={{ margin:0, fontWeight:700, fontSize:13, color:'#111' }}>🏘️ {g.name}</p>
                        {g.description && <p style={{ margin:'2px 0 0', fontSize:11, color:'#9CA3AF' }}>{g.description}</p>}
                      </td>
                      <td style={{ padding:'13px 16px' }}>
                        {g.leader
                          ? <span style={{ fontSize:12, display:'flex', alignItems:'center', gap:5 }}><span>👑</span>{g.leader.full_name}</span>
                          : <span style={{ fontSize:12, color:'#D1D5DB' }}>ยังไม่มี</span>}
                      </td>
                      <td style={{ padding:'13px 16px' }}>
                        <span style={{ fontSize:16, fontWeight:800, color:'#2D6A4F' }}>{g.memberCount}</span>
                        <span style={{ fontSize:11, color:'#9CA3AF' }}> คน</span>
                      </td>
                      <td style={{ padding:'13px 16px' }}><Num n={g.totalSeedKg}  unit="กก." color="#7C3AED"/></td>
                      <td style={{ padding:'13px 16px' }}><Num n={g.totalAreaRai} unit="ไร่" color="#2563EB"/></td>
                      <td style={{ padding:'13px 16px', textAlign:'right' }}>
                        <div style={{ display:'flex', gap:6, justifyContent:'flex-end' }}>
                          <button onClick={() => setDrawerGroup(g)}
                            style={{ padding:'5px 12px', borderRadius:7, border:'1px solid #E5E7EB', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                            👥 จัดการ
                          </button>
                          <button onClick={() => deleteGroup(g.id, g.name)}
                            style={{ padding:'5px 10px', borderRadius:7, border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626', fontSize:12, cursor:'pointer' }}>
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Expanded member rows ── */}
                    {expanded.has(g.id) && g.members.map((m, mi) => (
                      <tr key={m.id} style={{ borderBottom: mi<g.members.length-1?'1px solid #F3F4F6':'1px solid #D1FAE5', background:'#F8FFFE' }}>
                        <td/>
                        <td style={{ padding:'9px 16px 9px 32px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ width:28, height:28, borderRadius:'50%', background:m.is_leader?'#FEF3C7':'#D1FAE5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:m.is_leader?'#92400E':'#065F46', flexShrink:0 }}>
                              {m.is_leader ? '👑' : m.full_name[0]}
                            </div>
                            <div>
                              <p style={{ margin:0, fontSize:12, fontWeight:600, color:'#111' }}>{m.full_name}</p>
                              {m.phone && <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>{m.phone}</p>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'9px 16px' }}>
                          <StatusDot status={m.status} />
                          <span style={{ fontSize:11, color:'#6B7280' }}>{m.status==='approved'?'อนุมัติแล้ว':m.status==='pending'?'รออนุมัติ':m.status}</span>
                        </td>
                        <td style={{ padding:'9px 16px' }}>—</td>
                        <td style={{ padding:'9px 16px' }}><Num n={m.seedKg}  unit="กก." color="#7C3AED"/></td>
                        <td style={{ padding:'9px 16px' }}><Num n={m.areaRai} unit="ไร่" color="#2563EB"/></td>
                        <td/>
                      </tr>
                    ))}

                    {/* ── Subtotal row ── */}
                    {expanded.has(g.id) && (
                      <tr key={`${g.id}-sub`} style={{ borderBottom:`2px solid #D1FAE5`, background:'#ECFDF5' }}>
                        <td/>
                        <td colSpan={3} style={{ padding:'8px 16px 8px 32px', fontSize:11, fontWeight:700, color:'#065F46' }}>รวมกลุ่ม {g.name}</td>
                        <td style={{ padding:'8px 16px' }}><Num n={g.totalSeedKg}  unit="กก." color="#7C3AED"/></td>
                        <td style={{ padding:'8px 16px' }}><Num n={g.totalAreaRai} unit="ไร่" color="#2563EB"/></td>
                        <td/>
                      </tr>
                    )}
                  </>
                ))}

                {/* ── Grand total ── */}
                <tr style={{ background:'#F0FDF4', borderTop:'2px solid #6EE7B7' }}>
                  <td/>
                  <td colSpan={3} style={{ padding:'11px 16px', fontSize:12, fontWeight:800, color:'#065F46' }}>รวมทั้งหมด ({groups.length} กลุ่ม)</td>
                  <td style={{ padding:'11px 16px' }}><Num n={totalSeedKg}  unit="กก." color="#7C3AED"/></td>
                  <td style={{ padding:'11px 16px' }}><Num n={totalAreaRai} unit="ไร่" color="#2563EB"/></td>
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Drawer จัดการกลุ่ม (เพิ่ม/ลบสมาชิก + ตั้งหัวหน้า) ── */}
      <Drawer open={!!drawerGroup} onClose={() => { setDrawerGroup(null); void load(); }} title={`🏘️ ${drawerGroup?.name ?? ''}`} width={480}>
        {drawerGroup && <GroupManagePanel group={drawerGroup} onRefresh={async () => { await load(); setDrawerGroup(gs => gs ? (groups.find(g=>g.id===gs.id)??gs) : null); }} />}
      </Drawer>
    </div>
  );
}

/* ── GroupManagePanel — เพิ่ม/ลบ/ตั้งหัวหน้า ── */
function GroupManagePanel({ group, onRefresh }: { group:Group; onRefresh:()=>Promise<void> }) {
  const [search,    setSearch]    = useState('');
  const [results,   setResults]   = useState<{ id:string; full_name:string; phone:string|null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [acting,    setActing]    = useState<string|null>(null);
  const [notice,    setNotice]    = useState<string|null>(null);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await fetch(`/api/admin/members/list?search=${encodeURIComponent(search)}`, { credentials:'include' });
      const d   = (await res.json()) as { members?: { member_id:string; full_name:string; phone:string|null }[] };
      setResults((d.members ?? []).map(m => ({ id:m.member_id, full_name:m.full_name, phone:m.phone })));
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function addMember(memberId: string) {
    setActing(memberId);
    await fetch(`/api/admin/groups/${group.id}/members`, {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ member_id: memberId }),
    });
    setActing(null); setSearch(''); setResults([]);
    setNotice('✅ เพิ่มสมาชิกแล้ว'); await onRefresh();
  }

  async function removeMember(memberId: string) {
    setActing(memberId);
    await fetch(`/api/admin/groups/${group.id}/members`, {
      method:'DELETE', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ member_id: memberId }),
    });
    setActing(null); setNotice('✅ ลบสมาชิกแล้ว'); await onRefresh();
  }

  async function setLeader(memberId: string, isLeader: boolean) {
    setActing(memberId);
    await fetch(`/api/admin/groups/${group.id}/members`, {
      method:'PATCH', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ member_id: memberId, is_leader: isLeader }),
    });
    setActing(null); setNotice(isLeader?'👑 ตั้งหัวหน้าแล้ว':'✅ ยกเลิกหัวหน้าแล้ว'); await onRefresh();
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
      {notice && <div style={{ background:'#D1FAE5', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#065F46', fontWeight:600 }}>{notice}</div>}

      {/* Search add */}
      <div>
        <p style={{ margin:'0 0 8px', fontWeight:700, fontSize:13 }}>➕ เพิ่มสมาชิก</p>
        <input placeholder="พิมพ์ชื่อหรือเบอร์…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, boxSizing:'border-box' }} />
        {searching && <p style={{ fontSize:12, color:'#9CA3AF', marginTop:6 }}>⏳ กำลังค้นหา…</p>}
        {results.length > 0 && (
          <div style={{ border:'1px solid #E5E7EB', borderRadius:8, overflow:'hidden', marginTop:8 }}>
            {results.map(m => {
              const already = group.members.some(gm => gm.id === m.id);
              return (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', borderBottom:'1px solid #F3F4F6', background: already?'#F9FAFB':'#fff' }}>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:'#D1FAE5', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12, color:'#065F46', flexShrink:0 }}>
                    {m.full_name[0]}
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:600 }}>{m.full_name}</p>
                    <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{m.phone ?? '—'}</p>
                  </div>
                  {already
                    ? <span style={{ fontSize:11, color:'#9CA3AF', padding:'3px 8px', background:'#F3F4F6', borderRadius:6 }}>อยู่แล้ว</span>
                    : <button onClick={() => addMember(m.id)} disabled={!!acting}
                        style={{ padding:'5px 12px', borderRadius:6, border:'none', background:'#16A34A', color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer' }}>
                        {acting===m.id?'…':'+ เพิ่ม'}
                      </button>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Member list */}
      <div>
        <p style={{ margin:'0 0 10px', fontWeight:700, fontSize:13 }}>👥 สมาชิก ({group.members.length} คน)</p>
        {group.members.length === 0 && (
          <p style={{ textAlign:'center', padding:20, color:'#9CA3AF', fontSize:13, background:'#F9FAFB', borderRadius:8 }}>ยังไม่มีสมาชิก</p>
        )}
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {group.members.map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:m.is_leader?'#FFFBEB':'#fff', borderRadius:10, border:`1.5px solid ${m.is_leader?'#FCD34D':'#E5E7EB'}` }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:m.is_leader?'#FEF3C7':'#D1FAE5', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:13, color:m.is_leader?'#92400E':'#065F46', flexShrink:0 }}>
                {m.is_leader?'👑':m.full_name[0]}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <p style={{ margin:0, fontWeight:600, fontSize:13 }}>{m.full_name}</p>
                  {m.is_leader && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'#FCD34D', color:'#92400E', fontWeight:700 }}>หัวหน้า</span>}
                </div>
                <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{m.phone??'—'}</p>
              </div>
              <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                <button onClick={() => setLeader(m.id, !m.is_leader)} disabled={!!acting} title={m.is_leader?'ยกเลิกหัวหน้า':'ตั้งเป็นหัวหน้า'}
                  style={{ padding:'4px 9px', borderRadius:6, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontSize:13 }}>
                  {m.is_leader?'👤':'👑'}
                </button>
                <button onClick={() => removeMember(m.id)} disabled={!!acting}
                  style={{ padding:'4px 9px', borderRadius:6, border:'1px solid #FECACA', background:'#FEF2F2', color:'#DC2626', cursor:'pointer', fontSize:12, fontWeight:600 }}>
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

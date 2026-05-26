'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

type MemberInfo = { id:string; full_name:string; phone:string|null; status:string } | null;
type GroupMember = { id:string; is_leader:boolean; member: MemberInfo };
type MemberData  = {
  cycle:   { status:string; area:number; season:string } | null;
  booking: { status:string; date:string|null }           | null;
  noburn:  { status:string }                             | null;
  seed:    { status:string; qty:number }                 | null;
};
type Group = { id:string; name:string; description:string|null; member_group_members: GroupMember[] };
type ApiRes = { groups: Group[]; memberData: Record<string, MemberData> };

const CYCLE_MAP: Record<string,{text:string;color:string;bg:string}> = {
  planning:   { text:'วางแผน',      color:'#D97706', bg:'#FFFBEB' },
  planting:   { text:'กำลังปลูก',   color:'#059669', bg:'#ECFDF5' },
  growing:    { text:'กำลังเติบโต', color:'#16A34A', bg:'#F0FDF4' },
  ready:      { text:'พร้อมเกี่ยว', color:'#2563EB', bg:'#EFF6FF' },
  harvesting: { text:'กำลังเกี่ยว', color:'#7C3AED', bg:'#F5F3FF' },
  completed:  { text:'เสร็จแล้ว',   color:'#6B7280', bg:'#F9FAFB' },
};
const BOOKING_MAP: Record<string,{text:string;color:string}> = {
  pending:   { text:'จองแล้ว',     color:'#2563EB' },
  confirmed: { text:'ยืนยันแล้ว',  color:'#059669' },
  completed: { text:'รับซื้อแล้ว', color:'#6B7280' },
  cancelled: { text:'ยกเลิก',      color:'#DC2626' },
};
const NOBURN_MAP: Record<string,{text:string;color:string}> = {
  pending:       { text:'รออนุมัติ',   color:'#D97706' },
  pending_admin: { text:'รออนุมัติ',   color:'#D97706' },
  approved:      { text:'อนุมัติแล้ว', color:'#059669' },
  rejected:      { text:'ไม่ผ่าน',     color:'#DC2626' },
};

function StatusPill({ text, color, bg }: { text:string; color:string; bg?:string }) {
  return (
    <span style={{ display:'inline-block', fontSize:11, padding:'2px 8px', borderRadius:99, background: bg ?? `${color}18`, color, fontWeight:600, whiteSpace:'nowrap' }}>
      {text}
    </span>
  );
}

function CycleCell({ d }: { d: MemberData['cycle'] }) {
  if (!d) return <StatusPill text="ยังไม่ดำเนินการ" color="#9CA3AF" />;
  const c = CYCLE_MAP[d.status] ?? { text:d.status, color:'#374151', bg:'#F3F4F6' };
  return <StatusPill text={c.text + (d.area ? ` ${d.area}ไร่` : '')} color={c.color} bg={c.bg} />;
}
function BookingCell({ d }: { d: MemberData['booking'] }) {
  if (!d) return <StatusPill text="ยังไม่ดำเนินการ" color="#9CA3AF" />;
  const c = BOOKING_MAP[d.status] ?? { text:d.status, color:'#374151' };
  const date = d.date ? ' · ' + new Date(d.date).toLocaleDateString('th-TH',{day:'numeric',month:'short'}) : '';
  return <StatusPill text={c.text + date} color={c.color} />;
}
function NoburnCell({ d }: { d: MemberData['noburn'] }) {
  if (!d) return <StatusPill text="ยังไม่ดำเนินการ" color="#9CA3AF" />;
  const c = NOBURN_MAP[d.status] ?? { text:d.status, color:'#374151' };
  return <StatusPill text={c.text} color={c.color} />;
}

export default function AdminTeamsPage() {
  const [data,    setData]    = useState<ApiRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [selGroup, setSelGroup] = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/leader/team', { credentials:'include' });
    const d   = (await res.json()) as ApiRes;
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = data?.groups ?? [];
  const filteredGroups = groups
    .filter(g => selGroup === 'all' || g.id === selGroup)
    .map(g => ({
      ...g,
      member_group_members: g.member_group_members.filter(gm => {
        if (!search) return true;
        const name  = gm.member?.full_name?.toLowerCase() ?? '';
        const phone = gm.member?.phone ?? '';
        return name.includes(search.toLowerCase()) || phone.includes(search);
      })
    }));

  const allMembers = groups.flatMap(g => g.member_group_members).length;

  return (
    <AdminWebShell title="👥 ภาพรวมทีม" subtitle="ติดตามสถานะการปลูก จอง และไม่เผา ของสมาชิกทุกกลุ่ม">

      {/* KPI */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { label:'กลุ่มทั้งหมด', value:groups.length, color:'#2D6A4F' },
          { label:'สมาชิกทั้งหมด', value:allMembers, color:'#2563EB' },
          { label:'มีรอบปลูก', value: Object.values(data?.memberData ?? {}).filter(m => m.cycle).length, color:'#059669' },
          { label:'จองรับซื้อแล้ว', value: Object.values(data?.memberData ?? {}).filter(m => m.booking).length, color:'#7C3AED' },
          { label:'ยื่นไม่เผา', value: Object.values(data?.memberData ?? {}).filter(m => m.noburn).length, color:'#DC2626' },
        ].map(k => (
          <div key={k.label} style={{ flex:1, minWidth:100, background:'#fff', border:'1px solid #E5E7EB', borderRadius:10, padding:'12px 16px', textAlign:'center' }}>
            <p style={{ margin:'0 0 2px', fontSize:20, fontWeight:800, color:k.color }}>{k.value}</p>
            <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <input
          placeholder="🔍 ค้นหาชื่อหรือเบอร์…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ flex:1, minWidth:200, padding:'8px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }} />
        <select value={selGroup} onChange={e => setSelGroup(e.target.value)}
          style={{ padding:'8px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, background:'#fff' }}>
          <option value="all">🏘️ ทุกกลุ่ม</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <button onClick={load} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #E5E7EB', background:'#fff', cursor:'pointer', fontSize:13 }}>🔄</button>
      </div>

      {loading && <p style={{ textAlign:'center', color:'#9CA3AF', padding:40 }}>⏳ กำลังโหลด…</p>}

      {!loading && filteredGroups.length === 0 && (
        <div style={{ textAlign:'center', padding:60, color:'#9CA3AF' }}>
          <div style={{ fontSize:48 }}>🏘️</div>
          <p style={{ marginTop:12, fontSize:15, fontWeight:600 }}>ไม่พบข้อมูลกลุ่ม</p>
          <p style={{ fontSize:13 }}>สร้างกลุ่มและเพิ่มสมาชิกได้ที่เมนู สมาชิก → กลุ่ม</p>
        </div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {filteredGroups.map(group => {
          const leader = group.member_group_members.find(m => m.is_leader)?.member;
          const memberData = data?.memberData ?? {};

          return (
            <div key={group.id} style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
              {/* Group header */}
              <div style={{ background:'#F0FDF4', borderBottom:'1px solid #D1FAE5', padding:'14px 20px', display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:22 }}>🏘️</span>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:15, fontWeight:800, color:'#065F46' }}>{group.name}</p>
                  {leader && <p style={{ margin:'2px 0 0', fontSize:12, color:'#059669' }}>👑 หัวหน้า: {leader.full_name}</p>}
                </div>
                <span style={{ fontSize:12, color:'#059669', background:'#D1FAE5', padding:'3px 10px', borderRadius:99, fontWeight:600 }}>
                  {group.member_group_members.length} คน
                </span>
              </div>

              {/* Table */}
              {group.member_group_members.length === 0 ? (
                <p style={{ textAlign:'center', padding:'20px', color:'#9CA3AF', fontSize:13 }}>ไม่มีสมาชิกในกลุ่มนี้</p>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ background:'#F9FAFB' }}>
                        {['สมาชิก','เบอร์','🌾 สถานะปลูก','📅 การจองรับซื้อ','🔥 ไม่เผา'].map(h => (
                          <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.member_group_members.map((gm, i) => {
                        const m  = gm.member;
                        if (!m) return null;
                        const md = memberData[m.id] ?? { cycle:null, booking:null, noburn:null, seed:null };
                        return (
                          <tr key={gm.id} style={{ borderBottom: i < group.member_group_members.length-1 ? '1px solid #F3F4F6' : 'none', background: gm.is_leader ? '#FFFBEB' : '#fff' }}>
                            <td style={{ padding:'12px 16px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:32, height:32, borderRadius:'50%', background: gm.is_leader ? '#FEF3C7' : '#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color: gm.is_leader ? '#92400E' : '#16A34A', flexShrink:0 }}>
                                  {gm.is_leader ? '👑' : m.full_name[0]}
                                </div>
                                <div>
                                  <p style={{ margin:0, fontWeight:600, fontSize:13, color:'#111' }}>{m.full_name}</p>
                                  {gm.is_leader && <span style={{ fontSize:10, color:'#92400E', background:'#FEF3C7', padding:'1px 6px', borderRadius:4, fontWeight:700 }}>หัวหน้ากลุ่ม</span>}
                                </div>
                              </div>
                            </td>
                            <td style={{ padding:'12px 16px', fontSize:12, color:'#9CA3AF' }}>{m.phone ?? '—'}</td>
                            <td style={{ padding:'12px 16px' }}><CycleCell d={md.cycle} /></td>
                            <td style={{ padding:'12px 16px' }}><BookingCell d={md.booking} /></td>
                            <td style={{ padding:'12px 16px' }}><NoburnCell d={md.noburn} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AdminWebShell>
  );
}

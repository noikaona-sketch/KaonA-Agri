'use client';

import { useEffect, useState }        from 'react';
import { MobileAppShell }             from '@/shared/components/mobile-app-shell';
import { useCurrentMember }           from '@/providers/auth-provider';

/* ── Types ── */
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

/* ── Status helpers ── */
function cycleChip(d: MemberData['cycle']) {
  if (!d) return <Chip icon="🌾" text="ยังไม่ดำเนินการ" color="#9CA3AF" bg="#F3F4F6" />;
  const map: Record<string,{text:string;color:string;bg:string}> = {
    planning:    { text:'วางแผน',      color:'#D97706', bg:'#FFFBEB' },
    planting:    { text:'กำลังปลูก',   color:'#059669', bg:'#ECFDF5' },
    growing:     { text:'กำลังเติบโต', color:'#16A34A', bg:'#F0FDF4' },
    ready:       { text:'พร้อมเกี่ยว', color:'#2563EB', bg:'#EFF6FF' },
    harvesting:  { text:'กำลังเกี่ยว', color:'#7C3AED', bg:'#F5F3FF' },
    completed:   { text:'เสร็จแล้ว',   color:'#6B7280', bg:'#F9FAFB' },
  };
  const c = map[d.status] ?? { text: d.status, color:'#374151', bg:'#F3F4F6' };
  const sub = d.area ? ` · ${d.area} ไร่` : '';
  return <Chip icon="🌾" text={c.text + sub} color={c.color} bg={c.bg} />;
}

function bookingChip(d: MemberData['booking']) {
  if (!d) return <Chip icon="📅" text="ยังไม่ดำเนินการ" color="#9CA3AF" bg="#F3F4F6" />;
  const date = d.date ? new Date(d.date).toLocaleDateString('th-TH', { day:'numeric', month:'short' }) : '';
  const map: Record<string,{text:string;color:string;bg:string}> = {
    pending:   { text:`จองแล้ว${date?' · '+date:''}`, color:'#2563EB', bg:'#EFF6FF' },
    confirmed: { text:`ยืนยันแล้ว${date?' · '+date:''}`, color:'#059669', bg:'#ECFDF5' },
    completed: { text:'รับซื้อแล้ว', color:'#6B7280', bg:'#F9FAFB' },
    cancelled: { text:'ยกเลิกแล้ว', color:'#DC2626', bg:'#FEF2F2' },
  };
  const c = map[d.status] ?? { text: d.status, color:'#374151', bg:'#F3F4F6' };
  return <Chip icon="📅" text={c.text} color={c.color} bg={c.bg} />;
}

function noburnChip(d: MemberData['noburn']) {
  if (!d) return <Chip icon="🔥" text="ยังไม่ดำเนินการ" color="#9CA3AF" bg="#F3F4F6" />;
  const map: Record<string,{text:string;color:string;bg:string}> = {
    pending:          { text:'รออนุมัติ',  color:'#D97706', bg:'#FFFBEB' },
    pending_admin:    { text:'รออนุมัติ',  color:'#D97706', bg:'#FFFBEB' },
    approved:         { text:'อนุมัติแล้ว',color:'#059669', bg:'#ECFDF5' },
    rejected:         { text:'ไม่ผ่าน',    color:'#DC2626', bg:'#FEF2F2' },
  };
  const c = map[d.status] ?? { text: d.status, color:'#374151', bg:'#F3F4F6' };
  return <Chip icon="🔥" text={c.text} color={c.color} bg={c.bg} />;
}

function Chip({ icon, text, color, bg }: { icon:string; text:string; color:string; bg:string }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, padding:'4px 10px', borderRadius:99, background:bg, color, fontWeight:600, whiteSpace:'nowrap' }}>
      {icon} {text}
    </span>
  );
}

/* ── Component ── */
export default function LeaderTeamPage() {
  const member  = useCurrentMember();
  const [data,  setData]  = useState<ApiRes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    if (!member?.member_id) return;
    void fetch(`/api/leader/team?member_id=${member.member_id}`)
      .then(r => r.json())
      .then((d: ApiRes & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, [member?.member_id]);

  if (loading) return (
    <MobileAppShell title="👥 ทีมของฉัน" subtitle="">
      <div style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>⏳ กำลังโหลด…</div>
    </MobileAppShell>
  );

  if (error) return (
    <MobileAppShell title="👥 ทีมของฉัน" subtitle="">
      <div style={{ textAlign:'center', padding:40, color:'#DC2626' }}>❌ {error}</div>
    </MobileAppShell>
  );

  if (!data?.groups?.length) return (
    <MobileAppShell title="👥 ทีมของฉัน" subtitle="">
      <div style={{ textAlign:'center', padding:60 }}>
        <div style={{ fontSize:48 }}>🏘️</div>
        <p style={{ fontSize:15, fontWeight:600, color:'#374151', marginTop:12 }}>ยังไม่มีกลุ่มที่ดูแล</p>
        <p style={{ fontSize:13, color:'#9CA3AF' }}>ติดต่อ admin เพื่อตั้งเป็นหัวหน้ากลุ่ม</p>
      </div>
    </MobileAppShell>
  );

  return (
    <MobileAppShell title="👥 ทีมของฉัน" subtitle={`${data.groups.length} กลุ่มที่ดูแล`}>
      <div style={{ display:'flex', flexDirection:'column', gap:20, padding:'4px 0 24px' }}>
        {data.groups.map(group => {
          const leader = group.member_group_members.find(m => m.is_leader)?.member;
          const members = group.member_group_members.filter(m => m.member?.status === 'approved' || true);

          return (
            <div key={group.id} style={{ background:'#fff', borderRadius:16, border:'1px solid #E5E7EB', overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.06)' }}>
              {/* Group header */}
              <div style={{ background:'#2D6A4F', padding:'14px 18px' }}>
                <p style={{ margin:0, fontSize:16, fontWeight:800, color:'#fff' }}>🏘️ {group.name}</p>
                {leader && (
                  <p style={{ margin:'3px 0 0', fontSize:12, color:'rgba(255,255,255,.75)' }}>
                    👑 หัวหน้า: {leader.full_name}
                  </p>
                )}
                <p style={{ margin:'2px 0 0', fontSize:11, color:'rgba(255,255,255,.6)' }}>
                  {members.length} สมาชิก
                </p>
              </div>

              {/* Column headers */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:0, background:'#F9FAFB', padding:'8px 18px', borderBottom:'1px solid #E5E7EB' }}>
                {['สมาชิก','🌾 ปลูก','📅 จอง','🔥 ไม่เผา'].map(h => (
                  <p key={h} style={{ margin:0, fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em' }}>{h}</p>
                ))}
              </div>

              {/* Members */}
              {members.length === 0 && (
                <p style={{ textAlign:'center', padding:'20px', color:'#9CA3AF', fontSize:13 }}>ยังไม่มีสมาชิกในกลุ่ม</p>
              )}
              {members.map((gm, i) => {
                const m  = gm.member;
                if (!m) return null;
                const md = data.memberData[m.id] ?? { cycle:null, booking:null, noburn:null, seed:null };
                return (
                  <div key={gm.id} style={{ padding:'12px 18px', borderBottom: i < members.length-1 ? '1px solid #F3F4F6' : 'none', background: gm.is_leader ? '#FFFBEB' : '#fff' }}>
                    {/* Name row */}
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <div style={{ width:32, height:32, borderRadius:'50%', background: gm.is_leader ? '#FEF3C7' : '#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color: gm.is_leader ? '#92400E' : '#16A34A', flexShrink:0 }}>
                        {gm.is_leader ? '👑' : m.full_name[0]}
                      </div>
                      <div>
                        <p style={{ margin:0, fontSize:14, fontWeight:700, color:'#111' }}>{m.full_name}</p>
                        {m.phone && <p style={{ margin:0, fontSize:11, color:'#9CA3AF' }}>{m.phone}</p>}
                      </div>
                    </div>
                    {/* Status chips */}
                    <div style={{ display:'flex', flexDirection:'column', gap:5, paddingLeft:40 }}>
                      {cycleChip(md.cycle)}
                      {bookingChip(md.booking)}
                      {noburnChip(md.noburn)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </MobileAppShell>
  );
}

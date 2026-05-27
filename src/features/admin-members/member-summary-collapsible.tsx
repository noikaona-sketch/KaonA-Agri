'use client';

import { useState } from 'react';

/* ── Types ── */
type RoleData = {
  count:number; approved:number; hasBooking:number; hasCycle:number; hasNoburn:number;
};
type GroupData = {
  id:string; name:string; memberCount:number;
  leader: { id:string; full_name:string } | null;
  hasBooking:number; hasCycle:number; hasNoburn:number;
};
type Props = {
  byRole:       Record<string, RoleData>;
  groupSummary: GroupData[];
  onRoleClick?: (role: string | null) => void;
  onGroupClick?: (groupId: string | null) => void;
};

/* ── Helpers ── */
const ROLE_CFG: Record<string, { icon:string; label:string; color:string; bg:string }> = {
  farmer:     { icon:'🌾', label:'เกษตรกร',    color:'#065F46', bg:'#ECFDF5' },
  staff:      { icon:'👷', label:'เจ้าหน้าที่', color:'#1E40AF', bg:'#EFF6FF' },
  inspector:  { icon:'🔍', label:'ผู้ตรวจ',    color:'#5B21B6', bg:'#F5F3FF' },
  leader:     { icon:'👑', label:'หัวหน้ากลุ่ม',color:'#92400E', bg:'#FFFBEB' },
  truck_owner:{ icon:'🚛', label:'รถร่วม',     color:'#7C3AED', bg:'#EDE9FE' },
  admin:      { icon:'⚙️', label:'แอดมิน',     color:'#374151', bg:'#F9FAFB' },
};

function ProgressBar({ value, total, color }: { value:number; total:number; color:string }) {
  const pct = total > 0 ? Math.round((value/total)*100) : 0;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, height:5, background:'#F3F4F6', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:color, borderRadius:99, transition:'width .3s' }} />
      </div>
      <span style={{ fontSize:10, color:'#9CA3AF', minWidth:28, textAlign:'right' }}>{value}/{total}</span>
    </div>
  );
}

function SectionHeader({
  icon, title, count, open, onToggle, activeFilter, onClear,
}: {
  icon:string; title:string; count?:number; open:boolean;
  onToggle:()=>void; activeFilter:boolean; onClear:()=>void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px', cursor:'pointer', userSelect:'none',
        background: open ? '#F0FDF4' : '#F9FAFB', borderBottom: open ? '1px solid #D1FAE5' : 'none',
        transition:'background .12s' }}>
      <span style={{ fontSize:13, color: open ? '#059669' : '#9CA3AF', transition:'transform .2s', display:'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
      <span style={{ fontSize:14 }}>{icon}</span>
      <span style={{ flex:1, fontSize:13, fontWeight:700, color:'#374151' }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background: open ? '#D1FAE5' : '#E5E7EB', color: open ? '#065F46' : '#6B7280', fontWeight:600 }}>
          {count} รายการ
        </span>
      )}
      {activeFilter && (
        <button onClick={e => { e.stopPropagation(); onClear(); }}
          style={{ fontSize:10, padding:'2px 8px', borderRadius:6, border:'1px solid #FCA5A5', background:'#FEF2F2', color:'#DC2626', cursor:'pointer', fontWeight:600 }}>
          ✕ ล้าง filter
        </button>
      )}
    </div>
  );
}

/* ── Main Component ── */
export function MemberSummaryCollapsible({ byRole, groupSummary, onRoleClick, onGroupClick }: Props) {
  const [openRole,  setOpenRole]  = useState(true);
  const [openGroup, setOpenGroup] = useState(false);
  const [activeRole,  setActiveRole]  = useState<string|null>(null);
  const [activeGroup, setActiveGroup] = useState<string|null>(null);

  function handleRoleClick(role: string) {
    const next = activeRole === role ? null : role;
    setActiveRole(next);
    onRoleClick?.(next);
  }
  function handleGroupClick(id: string) {
    const next = activeGroup === id ? null : id;
    setActiveGroup(next);
    onGroupClick?.(next);
  }
  function clearRole()  { setActiveRole(null);  onRoleClick?.(null);  }
  function clearGroup() { setActiveGroup(null); onGroupClick?.(null); }

  const roleEntries = Object.entries(byRole)
    .filter(([, d]) => d.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  return (
    <div style={{ marginBottom:20 }}>

      {/* ── สรุปตาม Role ── */}
      <div style={{ border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', marginBottom:10, boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
        <SectionHeader
          icon="👤" title="สรุปตาม Role" count={roleEntries.length}
          open={openRole} onToggle={() => setOpenRole(p => !p)}
          activeFilter={!!activeRole} onClear={clearRole} />

        {openRole && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth:560 }}>
              <thead>
                <tr style={{ background:'#F9FAFB' }}>
                  {['Role','สมาชิก','อนุมัติแล้ว','มีรอบปลูก','จองรับซื้อ','ยื่นไม่เผา'].map(h => (
                    <th key={h} style={{ padding:'9px 16px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roleEntries.map(([role, d]) => {
                  const cfg   = ROLE_CFG[role] ?? { icon:'👤', label:role, color:'#374151', bg:'#F9FAFB' };
                  const isAct = activeRole === role;
                  return (
                    <tr key={role}
                      onClick={() => handleRoleClick(role)}
                      style={{ borderBottom:'1px solid #F3F4F6', cursor:'pointer', background: isAct ? cfg.bg : '#fff', transition:'background .1s' }}>
                      <td style={{ padding:'11px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontSize:16 }}>{cfg.icon}</span>
                          <div>
                            <p style={{ margin:0, fontSize:13, fontWeight:700, color: isAct ? cfg.color : '#111' }}>{cfg.label}</p>
                            <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>{role}</p>
                          </div>
                          {isAct && <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}40`, fontWeight:600 }}>กรองอยู่</span>}
                        </div>
                      </td>
                      <td style={{ padding:'11px 16px' }}>
                        <p style={{ margin:'0 0 4px', fontSize:16, fontWeight:800, color:cfg.color }}>{d.count}</p>
                        <ProgressBar value={d.count} total={Object.values(byRole).reduce((s,x)=>s+x.count,0)} color={cfg.color} />
                      </td>
                      <td style={{ padding:'11px 16px' }}>
                        <span style={{ fontSize:13, fontWeight:600, color: d.approved>0?'#059669':'#9CA3AF' }}>{d.approved}</span>
                        <span style={{ fontSize:11, color:'#9CA3AF' }}> / {d.count}</span>
                      </td>
                      <td style={{ padding:'11px 16px' }}>
                        <span style={{ fontSize:13, fontWeight:600, color: d.hasCycle>0?'#2563EB':'#9CA3AF' }}>{d.hasCycle}</span>
                        <span style={{ fontSize:11, color:'#9CA3AF' }}> คน</span>
                      </td>
                      <td style={{ padding:'11px 16px' }}>
                        <span style={{ fontSize:13, fontWeight:600, color: d.hasBooking>0?'#7C3AED':'#9CA3AF' }}>{d.hasBooking}</span>
                        <span style={{ fontSize:11, color:'#9CA3AF' }}> คน</span>
                      </td>
                      <td style={{ padding:'11px 16px' }}>
                        <span style={{ fontSize:13, fontWeight:600, color: d.hasNoburn>0?'#DC2626':'#9CA3AF' }}>{d.hasNoburn}</span>
                        <span style={{ fontSize:11, color:'#9CA3AF' }}> คน</span>
                      </td>
                    </tr>
                  );
                })}
                {roleEntries.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:'20px', color:'#9CA3AF', fontSize:13 }}>ยังไม่มีข้อมูล Role</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── สรุปตามกลุ่ม ── */}
      <div style={{ border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
        <SectionHeader
          icon="🏘️" title="สรุปตามกลุ่ม" count={groupSummary.length}
          open={openGroup} onToggle={() => setOpenGroup(p => !p)}
          activeFilter={!!activeGroup} onClear={clearGroup} />

        {openGroup && (
          <div style={{ overflowX:'auto' }}>
            {groupSummary.length === 0 ? (
              <p style={{ textAlign:'center', padding:'20px', color:'#9CA3AF', fontSize:13 }}>ยังไม่มีกลุ่ม — สร้างกลุ่มได้ที่แท็บ 🏘️ กลุ่ม</p>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:560 }}>
                <thead>
                  <tr style={{ background:'#F9FAFB' }}>
                    {['กลุ่ม','หัวหน้า','สมาชิก','มีรอบปลูก','จองรับซื้อ','ยื่นไม่เผา'].map(h => (
                      <th key={h} style={{ padding:'9px 16px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.06em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupSummary.map((g, i) => {
                    const isAct = activeGroup === g.id;
                    return (
                      <tr key={g.id}
                        onClick={() => handleGroupClick(g.id)}
                        style={{ borderBottom: i < groupSummary.length-1 ? '1px solid #F3F4F6' : 'none', cursor:'pointer', background: isAct ? '#F0FDF4' : '#fff', transition:'background .1s' }}>
                        <td style={{ padding:'11px 16px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:18 }}>🏘️</span>
                            <div>
                              <p style={{ margin:0, fontSize:13, fontWeight:700, color: isAct ? '#065F46' : '#111' }}>{g.name}</p>
                              {isAct && <span style={{ fontSize:10, color:'#059669', fontWeight:600 }}>กรองอยู่</span>}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'11px 16px' }}>
                          {g.leader
                            ? <span style={{ fontSize:12, display:'flex', alignItems:'center', gap:4 }}><span style={{ fontSize:14 }}>👑</span>{g.leader.full_name}</span>
                            : <span style={{ fontSize:12, color:'#9CA3AF' }}>ยังไม่มี</span>}
                        </td>
                        <td style={{ padding:'11px 16px' }}>
                          <span style={{ fontSize:14, fontWeight:700, color:'#2D6A4F' }}>{g.memberCount}</span>
                          <span style={{ fontSize:11, color:'#9CA3AF' }}> คน</span>
                        </td>
                        <td style={{ padding:'11px 16px' }}>
                          <span style={{ fontSize:13, fontWeight:600, color: g.hasCycle>0?'#2563EB':'#9CA3AF' }}>{g.hasCycle}</span>
                          <span style={{ fontSize:11, color:'#9CA3AF' }}> / {g.memberCount}</span>
                        </td>
                        <td style={{ padding:'11px 16px' }}>
                          <span style={{ fontSize:13, fontWeight:600, color: g.hasBooking>0?'#7C3AED':'#9CA3AF' }}>{g.hasBooking}</span>
                          <span style={{ fontSize:11, color:'#9CA3AF' }}> / {g.memberCount}</span>
                        </td>
                        <td style={{ padding:'11px 16px' }}>
                          <span style={{ fontSize:13, fontWeight:600, color: g.hasNoburn>0?'#DC2626':'#9CA3AF' }}>{g.hasNoburn}</span>
                          <span style={{ fontSize:11, color:'#9CA3AF' }}> / {g.memberCount}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Total row */}
                <tfoot>
                  <tr style={{ background:'#F0FDF4', borderTop:'2px solid #D1FAE5' }}>
                    <td style={{ padding:'10px 16px', fontWeight:700, fontSize:13, color:'#065F46' }} colSpan={2}>รวมทั้งหมด</td>
                    <td style={{ padding:'10px 16px', fontWeight:700, color:'#065F46' }}>
                      {groupSummary.reduce((s,g)=>s+g.memberCount,0)} คน
                    </td>
                    <td style={{ padding:'10px 16px', fontWeight:700, color:'#2563EB' }}>
                      {groupSummary.reduce((s,g)=>s+g.hasCycle,0)}
                    </td>
                    <td style={{ padding:'10px 16px', fontWeight:700, color:'#7C3AED' }}>
                      {groupSummary.reduce((s,g)=>s+g.hasBooking,0)}
                    </td>
                    <td style={{ padding:'10px 16px', fontWeight:700, color:'#DC2626' }}>
                      {groupSummary.reduce((s,g)=>s+g.hasNoburn,0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

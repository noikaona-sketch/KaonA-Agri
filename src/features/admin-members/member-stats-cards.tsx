'use client';

import { useEffect, useState } from 'react';

type Stats = {
  total:number; approved:number; pending:number; rejected:number; suspended:number;
  by_role: Record<string,number>; groups:number;
  groupSummary?: {
    id:string; name:string; memberCount:number;
    leader: { id:string; full_name:string } | null;
    hasBooking:number; hasCycle:number; hasNoburn:number;
  }[];
  by_role_detail?: Record<string,{
    count:number; approved:number; hasBooking:number; hasCycle:number; hasNoburn:number;
  }>;
};

const ROLE_CFG: { key:string; label:string; icon:string; color:string; bg:string }[] = [
  { key:'farmer',     label:'เกษตรกร',  icon:'🌾', color:'#065F46', bg:'#ECFDF5' },
  { key:'staff',      label:'เจ้าหน้าที่', icon:'👷', color:'#1E40AF', bg:'#EFF6FF' },
  { key:'inspector',  label:'ผู้ตรวจ',  icon:'🔍', color:'#5B21B6', bg:'#F5F3FF' },
  { key:'leader',     label:'หัวหน้ากลุ่ม', icon:'👥', color:'#92400E', bg:'#FFFBEB' },
  { key:'truck_owner',label:'รถร่วม',   icon:'🚛', color:'#7C3AED', bg:'#EDE9FE' },
];

type Props = { onRoleFilter?: (role: string | null) => void };

export function MemberStatsCards({ onRoleFilter }: Props) {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [active,  setActive]  = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/admin/members/stats', { credentials:'include' })
      .then(r => r.json()).then((d: Stats) => setStats(d));
  }, []);

  if (!stats) return (
    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
      {[...Array(6)].map((_,i) => (
        <div key={i} style={{ width:120, height:72, borderRadius:10, background:'#f3f4f6', animation:'pulse 1.5s infinite' }} />
      ))}
    </div>
  );

  function toggle(key: string | null) {
    const next = active === key ? null : key;
    setActive(next);
    onRoleFilter?.(next);
  }

  return (
    <div style={{ marginBottom:20 }}>
      {/* Status row */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
        {[
          { key:'all',       label:'ทั้งหมด',     value:stats.total,     color:'#374151', bg:'#F9FAFB', border:'#E5E7EB' },
          { key:'approved',  label:'อนุมัติแล้ว', value:stats.approved,  color:'#059669', bg:'#ECFDF5', border:'#6EE7B7' },
          { key:'pending',   label:'รออนุมัติ',   value:stats.pending,   color:stats.pending>0?'#D97706':'#9CA3AF', bg:'#FFFBEB', border:'#FCD34D' },
          { key:'suspended', label:'ระงับ',        value:stats.suspended, color:'#DC2626', bg:'#FEF2F2', border:'#FCA5A5' },
        ].map(c => (
          <button key={c.key} onClick={() => toggle(c.key === 'all' ? null : c.key)}
            style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', padding:'10px 16px', borderRadius:10,
              border:`1.5px solid ${active===(c.key==='all'?null:c.key)?c.border:'#E5E7EB'}`,
              background: active===(c.key==='all'?null:c.key)?c.bg:'#fff',
              cursor:'pointer', minWidth:100, transition:'all .12s' }}>
            <span style={{ fontSize:22, fontWeight:800, color:c.color }}>{c.value}</span>
            <span style={{ fontSize:11, color:'#6B7280', marginTop:1 }}>{c.label}</span>
          </button>
        ))}
      </div>

      {/* Role row */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {ROLE_CFG.map(r => {
        const rawVal = stats.by_role[r.key];
          const count = typeof rawVal === 'number' ? rawVal : (rawVal as { count?: number })?.count ?? 0;
          const isActive = active === r.key;
          return (
            <button key={r.key} onClick={() => toggle(r.key)}
              style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:10,
                border:`1.5px solid ${isActive ? r.color : '#E5E7EB'}`,
                background: isActive ? r.bg : '#fff',
                cursor:'pointer', transition:'all .12s' }}>
              <span style={{ fontSize:16 }}>{r.icon}</span>
              <div style={{ textAlign:'left' }}>
                <p style={{ margin:0, fontSize:16, fontWeight:700, color:r.color }}>{count}</p>
                <p style={{ margin:0, fontSize:10, color:'#6B7280' }}>{r.label}</p>
              </div>
            </button>
          );
        })}
        {/* กลุ่ม */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:10, border:'1.5px solid #E5E7EB', background:'#fff' }}>
          <span style={{ fontSize:16 }}>🏘️</span>
          <div>
            <p style={{ margin:0, fontSize:16, fontWeight:700, color:'#374151' }}>{stats.groups}</p>
            <p style={{ margin:0, fontSize:10, color:'#6B7280' }}>กลุ่ม</p>
          </div>
        </div>
      </div>
    </div>
  );
}

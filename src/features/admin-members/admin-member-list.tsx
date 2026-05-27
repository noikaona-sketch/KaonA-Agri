'use client';

import Link           from 'next/link';
import { useEffect, useState, useCallback } from 'react';

/* ── Types ── */
type MemberRow = {
  member_id: string; full_name: string; phone: string | null;
  line_display_name?: string | null;
  status: string; roles: string[]; effective_role: string | null; created_at: string;
  rejection_reason?: string | null;
  bank_verified_status: string;
  has_plots: boolean; has_bank: boolean;
  readyToApprove: boolean; missingFields: string[]; readinessReason: string[];
};

/* ── Config ── */
const ROLE_CFG: Record<string,{icon:string;color:string;bg:string}> = {
  farmer:     { icon:'🌾', color:'#065F46', bg:'#D1FAE5' },
  truck_owner:{ icon:'🚛', color:'#5B21B6', bg:'#EDE9FE' },
  inspector:  { icon:'🔍', color:'#1E40AF', bg:'#DBEAFE' },
  staff:      { icon:'👷', color:'#92400E', bg:'#FEF3C7' },
  leader:     { icon:'👑', color:'#92400E', bg:'#FEF3C7' },
  admin:      { icon:'⚙️', color:'#374151', bg:'#F3F4F6' },
};

const STATUS_CFG: Record<string,{label:string;color:string;bg:string;dot:string}> = {
  approved:         { label:'อนุมัติแล้ว',         color:'#065F46', bg:'#D1FAE5', dot:'#10B981' },
  pending:          { label:'รออนุมัติ',            color:'#92400E', bg:'#FEF3C7', dot:'#F59E0B' },
  pending_approval: { label:'รอตรวจสอบ',            color:'#92400E', bg:'#FEF3C7', dot:'#F59E0B' },
  returned:         { label:'ตีกลับแก้ไข',          color:'#1E40AF', bg:'#DBEAFE', dot:'#3B82F6' },
  rejected:         { label:'ไม่อนุมัติ',            color:'#991B1B', bg:'#FEE2E2', dot:'#EF4444' },
  suspended:        { label:'ระงับใช้งาน',           color:'#374151', bg:'#F3F4F6', dot:'#9CA3AF' },
};

const STATUS_TABS = [
  { key:'',                          label:'ทั้งหมด' },
  { key:'pending',                   label:'รออนุมัติ' },
  { key:'approved',                  label:'อนุมัติแล้ว' },
  { key:'rejected',                  label:'ไม่อนุมัติ' },
  { key:'suspended',                 label:'ระงับ' },
  { key:'cancelled_waiting_reapply', label:'🔄 ยกเลิก/รอสมัครใหม่' },
] as const;

/* ── Sub-components ── */
function StatusChip({ status, rejectionReason }: { status:string; rejectionReason?:string|null }) {
  if (status === 'rejected' && rejectionReason === 'cancelled_by_admin') {
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, padding:'3px 9px', borderRadius:99, background:'#EEF2FF', color:'#4338CA', fontWeight:600 }}>
        <span style={{ width:5, height:5, borderRadius:'50%', background:'#6366F1', display:'inline-block' }}/>
        ยกเลิก / รอสมัครใหม่
      </span>
    );
  }
  const c = STATUS_CFG[status] ?? { label:status, color:'#374151', bg:'#F3F4F6', dot:'#9CA3AF' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, padding:'3px 9px', borderRadius:99, background:c.bg, color:c.color, fontWeight:600, whiteSpace:'nowrap' }}>
      <span style={{ width:5, height:5, borderRadius:'50%', background:c.dot, display:'inline-block' }}/>
      {c.label}
    </span>
  );
}

function RoleBadge({ role }: { role:string }) {
  const c = ROLE_CFG[role] ?? { icon:'👤', color:'#374151', bg:'#F3F4F6' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:3, fontSize:10, padding:'2px 7px', borderRadius:99, background:c.bg, color:c.color, fontWeight:600, marginRight:3, marginBottom:2, whiteSpace:'nowrap' }}>
      {c.icon} {role}
    </span>
  );
}

function ReadinessBadge({ m }: { m:MemberRow }) {
  if (m.readyToApprove) return (
    <span style={{ fontSize:11, color:'#059669', fontWeight:600, display:'flex', alignItems:'center', gap:4 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:'#10B981', display:'inline-block' }}/>พร้อม
    </span>
  );
  const missing = m.missingFields?.length ?? 0;
  return (
    <span style={{ fontSize:11, color:'#D97706', fontWeight:600, cursor:'default', display:'flex', alignItems:'center', gap:4 }}
      title={`ขาด: ${(m.missingFields ?? []).join(', ')}`}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:'#F59E0B', display:'inline-block' }}/>
      ขาด {missing} รายการ
    </span>
  );
}

function Avatar({ name, isLeader }: { name:string; isLeader:boolean }) {
  return (
    <div style={{ width:34, height:34, borderRadius:'50%', background: isLeader ? '#FEF3C7' : '#D1FAE5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color: isLeader ? '#92400E' : '#065F46', flexShrink:0 }}>
      {isLeader ? '👑' : (name?.[0] ?? '?')}
    </div>
  );
}

/* ── Main Component ── */
export function AdminMemberList({ roleFilter }: { roleFilter?: string | null }) {
  const [members,      setMembers]      = useState<MemberRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string|null>(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter2,  setRoleFilter2]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const sq  = statusFilter === 'cancelled_waiting_reapply' ? 'rejected' : statusFilter;
    const res = await fetch(`/api/admin/members/list?status=${sq}`, { credentials:'include' });
    const d   = (await res.json()) as { members?: MemberRow[]; error?: string };
    if (!res.ok) { setError(d.error ?? 'โหลดไม่สำเร็จ'); setLoading(false); return; }
    setMembers(d.members ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { void load(); }, [load]);

  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    if (q && !m.full_name.toLowerCase().includes(q) && !(m.phone ?? '').includes(q)) return false;
    if (statusFilter === 'cancelled_waiting_reapply' && !(m.status === 'rejected' && m.rejection_reason === 'cancelled_by_admin')) return false;
    if (roleFilter  && !(m.roles ?? []).includes(roleFilter))  return false;
    if (roleFilter2 && !(m.roles ?? []).includes(roleFilter2)) return false;
    return true;
  });

  const isLeader = (m: MemberRow) => (m.roles ?? []).includes('leader');

  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{ background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:10, padding:'12px 16px', marginBottom:16 }}>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          {/* Search */}
          <div style={{ flex:1, minWidth:200, position:'relative' }}>
            <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'#9CA3AF', fontSize:14, pointerEvents:'none' }}>🔍</span>
            <input
              placeholder="ค้นหาชื่อ เบอร์โทร…"
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', padding:'8px 12px 8px 32px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, color:'#111', background:'#fff', boxSizing:'border-box' }} />
          </div>

          {/* Role filter */}
          <select value={roleFilter2} onChange={e => setRoleFilter2(e.target.value)}
            style={{ padding:'8px 32px 8px 10px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13, color:'#374151', background:'#fff url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236B7280\' stroke-width=\'2\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E") no-repeat right 10px center', appearance:'none', minWidth:140 }}>
            <option value="">👤 ทุก Role</option>
            {Object.entries(ROLE_CFG).map(([k,v]) => (
              <option key={k} value={k}>{v.icon} {k}</option>
            ))}
          </select>

          {/* Result count */}
          <span style={{ fontSize:12, color:'#9CA3AF', marginLeft:'auto', whiteSpace:'nowrap' }}>
            แสดง <strong style={{ color:'#374151' }}>{filtered.length}</strong> จาก {members.length} รายการ
          </span>
        </div>

        {/* Status tabs */}
        <div style={{ display:'flex', gap:4, marginTop:10, borderBottom:'1.5px solid #E5E7EB', paddingBottom:0, flexWrap:'wrap' }}>
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              style={{ padding:'6px 14px', border:'none', background:'none', cursor:'pointer', fontSize:12, fontWeight: statusFilter===t.key ? 700 : 400, color: statusFilter===t.key ? '#2D6A4F' : '#6B7280', borderBottom: statusFilter===t.key ? '2.5px solid #2D6A4F' : '2.5px solid transparent', marginBottom:-1.5, whiteSpace:'nowrap', transition:'all .1s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {loading && <p style={{ textAlign:'center', padding:40, color:'#9CA3AF' }}>⏳ กำลังโหลด…</p>}
      {error   && <p style={{ textAlign:'center', padding:20, color:'#DC2626' }}>❌ {error}</p>}

      {!loading && !error && (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.05)' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'52px 24px', color:'#9CA3AF' }}>
              <div style={{ fontSize:40, marginBottom:10, opacity:.4 }}>👥</div>
              <p style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:4 }}>ไม่พบสมาชิก</p>
              <p style={{ fontSize:12 }}>ลองเปลี่ยน filter หรือค้นหาด้วยคำอื่น</p>
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', minWidth:680 }}>
                <thead>
                  <tr style={{ background:'#F9FAFB', borderBottom:'1.5px solid #E5E7EB' }}>
                    {['','ชื่อ-นามสกุล','เบอร์โทร','บทบาท','สถานะ','ความพร้อม','วันสมัคร',''].map((h,i) => (
                      <th key={i} style={{ padding:'10px 14px', textAlign: i===7?'right':'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.06em', whiteSpace:'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((m, idx) => (
                    <tr key={m.member_id}
                      style={{ borderBottom: idx < filtered.length-1 ? '1px solid #F3F4F6' : 'none', transition:'background .08s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}>

                      {/* Avatar */}
                      <td style={{ padding:'12px 10px 12px 16px', width:44 }}>
                        <Avatar name={m.full_name} isLeader={isLeader(m)} />
                      </td>

                      {/* Name */}
                      <td style={{ padding:'12px 14px' }}>
                        <p style={{ margin:0, fontWeight:700, fontSize:13, color:'#111' }}>
                          {m.full_name?.trim() || <span style={{ color:'#9CA3AF', fontStyle:'italic' }}>ยังไม่ได้กรอกชื่อ</span>}
                        </p>
                        {m.line_display_name && m.line_display_name !== m.full_name && (
                          <p style={{ margin:'1px 0 0', fontSize:11, color:'#9CA3AF' }}>LINE: {m.line_display_name}</p>
                        )}
                      </td>

                      {/* Phone */}
                      <td style={{ padding:'12px 14px', fontSize:12, color:'#6B7280', whiteSpace:'nowrap' }}>
                        {m.phone ?? '—'}
                      </td>

                      {/* Roles */}
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex', flexWrap:'wrap', gap:2 }}>
                          {(m.roles ?? []).map(r => <RoleBadge key={r} role={r} />)}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding:'12px 14px', whiteSpace:'nowrap' }}>
                        <StatusChip status={m.status} rejectionReason={m.rejection_reason} />
                      </td>

                      {/* Readiness */}
                      <td style={{ padding:'12px 14px' }}>
                        <ReadinessBadge m={m} />
                      </td>

                      {/* Date */}
                      <td style={{ padding:'12px 14px', fontSize:11, color:'#9CA3AF', whiteSpace:'nowrap' }}>
                        {new Date(m.created_at).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' })}
                      </td>

                      {/* Actions */}
                      <td style={{ padding:'12px 16px', textAlign:'right' }}>
                        <Link href={`/admin/members/${m.member_id}`}
                          style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:7, border:'1px solid #E5E7EB', background:'#fff', color:'#374151', fontSize:12, fontWeight:600, textDecoration:'none', whiteSpace:'nowrap', transition:'all .1s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor='#2D6A4F'; (e.currentTarget as HTMLElement).style.color='#2D6A4F'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='#E5E7EB'; (e.currentTarget as HTMLElement).style.color='#374151'; }}>
                          ดูรายละเอียด →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

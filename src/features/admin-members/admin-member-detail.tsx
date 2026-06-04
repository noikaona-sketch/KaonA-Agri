'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter }     from 'next/navigation';
import { ErrorState }    from '@/shared/components/error-state';
import { LoadingState }  from '@/shared/components/loading-state';
import { PlotMap, PlotData } from '@/shared/components/plot-map';

function MemberPlotMiniMap({ plots, selectedId, onSelect }: {
  plots: PlotData[]; selectedId:string|null; onSelect:(id:string)=>void;
}) {
  return <PlotMap plots={plots} selectedId={selectedId} onSelect={onSelect} height={280} />;
}
import { MemberRoleManager } from './member-role-manager';
import { CompletenessChecklistPanel } from './panels/completeness-checklist-panel';
import { BankAccountPanel }           from './panels/bank-account-panel';
import { ReturnRejectModal }           from './panels/return-reject-modal';
import { ApprovalHistoryPanel }        from './panels/approval-history-panel';
import { AdminMember360Tabs }          from './admin-member-360-tabs';

type MemberDetail = {
  id: string; full_name: string; phone: string | null;
  citizen_id_masked: string;
  house_no: string | null; moo: string | null;
  subdistrict: string | null; district: string | null; province: string | null;
  address: string | null;
  status: string; registration_type: string | null;
  line_user_id: string | null; line_display_name: string | null; line_picture_url: string | null;
  created_at: string;
  bank_name: string | null; bank_account_number: string | null; bank_account_name: string | null;
  bank_verified_status: string;
  return_reason: string | null; returned_at: string | null;
  rejection_reason: string | null;
};
type PlotRow = {
  id:string; member_id:string|null; name:string; area_rai:number;
  lat:number|null; lng:number|null; accuracy:number|null;
  status:string; province:string|null; district:string|null; sub_district:string|null;
  land_doc_type:string|null; land_doc_number?:string|null; description:string|null;
  boundary_geojson:object|null; area_rai_calculated:number|null;
};
type MemberOption = { id: string; member_id?: string; full_name: string; phone: string | null; line_display_name?: string | null };

type VehicleRow = { id: string; vehicle_type: string; plate_number: string; brand: string | null; model: string | null; year_be: number | null };
type RoleRow    = { role: string; is_primary: boolean };
type DocRow     = { doc_type: string; verified: boolean; file_url: string | null };
type LogRow     = { id: string; action: string; reason: string | null; acted_by: string | null; created_at: string };


const PLOT_STATUS_OPTIONS = [
  { value: 'pending_review', label: 'รออนุมัติ' },
  { value: 'verified',       label: 'ตรวจสอบแล้ว' },
  { value: 'approved',       label: 'อนุมัติแล้ว' },
  { value: 'rejected',       label: 'ไม่อนุมัติ' },
  { value: 'cancelled',      label: 'ยกเลิก / ซ่อน' },
  { value: 'inactive',       label: 'ไม่ใช้งาน' },
];

const STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
  approved:  { label: '✅ อนุมัติแล้ว', color: '#1b5e20', bg: '#e8f5e9' },
  pending:   { label: '⏳ รออนุมัติ',   color: '#e65100', bg: '#fff8e1' },
  returned:  { label: '↩️ ตีกลับ',     color: '#1565c0', bg: '#e3f2fd' },
  rejected:  { label: '❌ ไม่อนุมัติ',  color: '#c62828', bg: '#ffebee' },
  suspended: { label: '⛔ ระงับ',       color: '#616161', bg: '#f5f5f5' },
};

export function AdminMemberDetail({ memberId }: { memberId: string }) {
  const router = useRouter();
  const [member,   setMember]   = useState<MemberDetail | null>(null);
  const [plots,    setPlots]    = useState<PlotRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [roles,    setRoles]    = useState<RoleRow[]>([]);
  const [docs,     setDocs]     = useState<DocRow[]>([]);
  const [logs,     setLogs]     = useState<LogRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selectedPlotId, setSelectedPlotId] = useState<string|null>(null);
  const plotEditPanelRef = useRef<HTMLDivElement | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [acting,   setActing]   = useState(false);
  const [editingPlot, setEditingPlot] = useState<PlotRow | null>(null);
  const [plotForm, setPlotForm] = useState({ name:'', area_rai:'', province:'', district:'', sub_district:'', description:'', land_doc_type:'', land_doc_number:'', status:'pending_review', member_id:'' });
  const [plotMemberQuery, setPlotMemberQuery] = useState('');
  const [plotBoundaryDrawing, setPlotBoundaryDrawing] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [editingMember, setEditingMember] = useState(false);
  const [memberForm, setMemberForm] = useState({
    full_name:'', phone:'', citizen_id:'', address:'', house_no:'', moo:'', subdistrict:'', district:'', province:'',
    bank_name:'', bank_account_number:'', bank_account_name:'',
  });

  async function cancelAndAllowReapply() {
    if (!member) return;
    if (!confirm(`ยกเลิกใบสมัครปัจจุบันของ "${member.full_name}" และเปิดให้สมัครใหม่?\nสมาชิกจะเห็นข้อความให้กลับไปสมัครใหม่ และต้องส่งใบสมัครใหม่อีกครั้ง`)) return;
    setActing(true);
    const res = await fetch(`/api/admin/members/${member.id}`, {
      method: 'DELETE', credentials: 'include',
    });
    setActing(false);
    const d = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) { alert(`❌ ดำเนินการไม่สำเร็จ: ${d.error}`); return; }
    router.push('/admin/members');
  }
  const [notice,   setNotice]   = useState<string | null>(null);
  const [modal,    setModal]    = useState<'return' | 'reject' | null>(null);
  const [incompleteWarning, setIncompleteWarning] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<{ readyToApprove: boolean; missingFields: string[]; readinessReason: string[] } | null>(null);

  async function load() {
    setLoading(true); setError(null);
    const res = await fetch(`/api/admin/members/${memberId}`);
    const payload = (await res.json()) as {
      member?: MemberDetail; plots?: PlotRow[]; vehicles?: VehicleRow[];
      roles?: RoleRow[]; docs?: DocRow[]; logs?: LogRow[]; error?: string;
      readyToApprove?: boolean; missingFields?: string[]; readinessReason?: string[];
    };
    if (!res.ok) { setError(payload.error ?? 'ไม่พบข้อมูลสมาชิก'); setLoading(false); return; }
    const membersRes = await fetch('/api/admin/members/list?status=approved', { credentials: 'include' });
    if (membersRes.ok) {
      const md = (await membersRes.json()) as { members?: MemberOption[] };
      setMembers(((md.members ?? []) as MemberOption[]).map(m => ({ ...m, id: m.id ?? m.member_id! })).filter(m => m.id));
    }
    setMember(payload.member ?? null);
    setPlots(payload.plots ?? []);
    setVehicles(payload.vehicles ?? []);
    setRoles(payload.roles ?? []);
    setDocs(payload.docs ?? []);
    setLogs(payload.logs ?? []);
    setReadiness({
      readyToApprove: payload.readyToApprove ?? false,
      missingFields: payload.missingFields ?? [],
      readinessReason: payload.readinessReason ?? [],
    });
    setLoading(false);
    setEditingMember(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('edit') === '1');
    setMemberForm({
      full_name: payload.member?.full_name ?? '',
      phone: payload.member?.phone ?? '',
      citizen_id: '',
      address: payload.member?.address ?? '',
      house_no: payload.member?.house_no ?? '',
      moo: payload.member?.moo ?? '',
      subdistrict: payload.member?.subdistrict ?? '',
      district: payload.member?.district ?? '',
      province: payload.member?.province ?? '',
      bank_name: payload.member?.bank_name ?? '',
      bank_account_number: payload.member?.bank_account_number ?? '',
      bank_account_name: payload.member?.bank_account_name ?? '',
    });
  }

  useEffect(() => { void load(); }, [memberId]);

  async function updateStatus(status: string, reason?: string) {
    setActing(true); setNotice(null); setIncompleteWarning(null);
    const res = await fetch('/api/admin/members/approvals', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, decision: status, reason }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string; incomplete?: boolean; missing_fields?: string };
    setActing(false);

    if (!res.ok) {
      if (payload.incomplete) {
        // ข้อมูลไม่ครบ — แสดงแจ้งเตือน + ให้ใส่ override reason
        setIncompleteWarning(payload.missing_fields ?? 'ข้อมูลไม่ครบ');
      } else {
        setError(payload.error ?? 'ดำเนินการไม่สำเร็จ');
      }
      return;
    }
    setNotice(`เปลี่ยนสถานะเป็น "${status}" แล้ว`);
    setModal(null);
    await load();
  }

  async function updateBankStatus(bankStatus: string) {
    setActing(true);
    const res = await fetch('/api/admin/members/approvals', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, decision: 'bank_status', bankStatus }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) setError(payload.error ?? 'ดำเนินการไม่สำเร็จ');
    else setNotice(`บัญชีธนาคาร: ${bankStatus}`);
    setActing(false); await load();
  }
  function openEditPlot(p: PlotRow) {
    setEditingPlot(p);
    setSelectedPlotId(p.id);
    setPlotBoundaryDrawing(false);
    setPlotForm({
      name: p.name ?? '', area_rai: String(p.area_rai ?? ''), province: p.province ?? '', district: p.district ?? '', sub_district: p.sub_district ?? '',
      description: p.description ?? '', land_doc_type: p.land_doc_type ?? '', land_doc_number: p.land_doc_number ?? '', status: p.status ?? 'pending_review', member_id: p.member_id ?? memberId,
    });
    setTimeout(() => plotEditPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }
  async function saveEditPlot() {
    if (!editingPlot) return;
    const area = Number(plotForm.area_rai);
    if (!plotForm.name.trim() || !Number.isFinite(area) || area <= 0) { setError('กรอกชื่อแปลงและพื้นที่ให้ถูกต้อง'); return; }
    const res = await fetch('/api/admin/plots', {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plot_id: editingPlot.id, name: plotForm.name, area_rai: area, province: plotForm.province, district: plotForm.district, subdistrict: plotForm.sub_district, description: plotForm.description, land_doc_type: plotForm.land_doc_type, land_doc_number: plotForm.land_doc_number, status: plotForm.status, member_id: plotForm.member_id || null }),
    });
    const payload = (await res.json()) as { ok?:boolean; error?:string };
    if (!res.ok) { setError(payload.error ?? 'บันทึกแปลงไม่สำเร็จ'); return; }
    setNotice('บันทึกข้อมูลแปลงแล้ว');
    setSelectedPlotId(editingPlot.id);
    await load();
    setTimeout(() => plotEditPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }

  async function savePlotBoundaryFromMemberPage(plotId: string, geojson: object, areaRai: number) {
    const res = await fetch('/api/admin/plots', {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plot_id: plotId, boundary_geojson: geojson, area_rai_calculated: areaRai }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) { setError(payload.error ?? 'บันทึกขอบเขตไม่สำเร็จ'); return; }
    setNotice(`บันทึกขอบเขตแปลงแล้ว (${areaRai} ไร่)`);
    setPlots(ps => ps.map(p => p.id === plotId ? { ...p, boundary_geojson: geojson, area_rai_calculated: areaRai } : p));
  }

  async function saveMemberProfile() {
    const citizenDigits = memberForm.citizen_id.trim();
    if (citizenDigits.length > 0 && citizenDigits.length !== 13) {
      setError('เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก');
      return;
    }
    const memberPayload = {
      full_name:   memberForm.full_name,
      phone:       memberForm.phone,
      address:     memberForm.address,
      house_no:    memberForm.house_no,
      moo:         memberForm.moo,
      subdistrict: memberForm.subdistrict,
      district:    memberForm.district,
      province:    memberForm.province,
      ...(citizenDigits.length > 0 ? { citizen_id: citizenDigits } : {}),
    };
    setActing(true);
    const res = await fetch(`/api/admin/members/${memberId}`, {
      method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member: memberPayload }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    setActing(false);
    if (!res.ok) { setError(payload.error ?? 'บันทึกข้อมูลสมาชิกไม่สำเร็จ'); return; }
    setNotice('บันทึกข้อมูลสมาชิกแล้ว');
    setEditingMember(false);
    await load();
  }

  if (loading) return <LoadingState label="กำลังโหลดข้อมูล…" />;
  if (error || !member) return <ErrorState title="ไม่พบข้อมูลสมาชิก" detail={error ?? ''} />;

  const st = STATUS_TH[member.status] ?? { label: member.status, color: '#374151', bg: '#F3F4F6' };
  const isLeader = roles.some(r => r.role === 'leader');
  const plotMemberOptions = members.filter(m => {
    const q = plotMemberQuery.trim().toLowerCase();
    if (!q) return true;
    return [m.full_name, m.phone, m.line_display_name].filter(Boolean).join(' ').toLowerCase().includes(q);
  }).slice(0, 80);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {modal && <ReturnRejectModal type={modal} acting={acting} onCancel={() => setModal(null)} onConfirm={(r) => void updateStatus(modal === 'return' ? 'returned' : 'rejected', r)} />}

      {/* ── Notice / Warning ── */}
      {notice && (
        <div style={{ background:'#D1FAE5', border:'1px solid #6EE7B7', borderRadius:10, padding:'12px 16px', fontWeight:600, color:'#065F46', display:'flex', alignItems:'center', gap:8 }}>
          ✅ {notice}
        </div>
      )}
      {incompleteWarning && (
        <div style={{ background:'#FFFBEB', border:'1.5px solid #FCD34D', borderRadius:10, padding:'14px 16px' }}>
          <p style={{ margin:'0 0 8px', fontWeight:700, color:'#92400E' }}>⚠️ ข้อมูลยังไม่ครบ: {incompleteWarning}</p>
          <p style={{ margin:'0 0 10px', fontSize:13, color:'#6B7280' }}>กรอกเหตุผลเพื่ออนุมัติข้ามขั้นตอน (override)</p>
          <div style={{ display:'flex', gap:8 }}>
            <input placeholder="เหตุผล override…" id="override-reason"
              style={{ flex:1, padding:'8px 12px', borderRadius:8, border:'1.5px solid #E5E7EB', fontSize:13 }} />
            <button className="admin-btn admin-btn--success"
              onClick={() => void updateStatus('approved', (document.getElementById('override-reason') as HTMLInputElement)?.value || 'override')}
              disabled={acting}>✅ อนุมัติ (override)</button>
            <button className="admin-btn admin-btn--secondary" onClick={() => setIncompleteWarning(null)}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* ── Hero Header ── */}
      <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:14, padding:'20px 24px', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
          {/* Avatar */}
          <div style={{ position:'relative', flexShrink:0 }}>
            {member.line_picture_url ? (
              <img src={member.line_picture_url} alt="LINE" width={64} height={64}
                style={{ borderRadius:'50%', border:'2.5px solid #D1FAE5', display:'block' }} />
            ) : (
              <div style={{ width:64, height:64, borderRadius:'50%', background: isLeader?'#FEF3C7':'#D1FAE5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, color: isLeader?'#92400E':'#065F46', border:'2.5px solid #D1FAE5' }}>
                {isLeader ? '👑' : (member.full_name?.[0] ?? '?')}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
              <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'#111' }}>
                {member.full_name?.trim() || <span style={{ color:'#9CA3AF', fontStyle:'italic' }}>ยังไม่ได้กรอกชื่อ</span>}
              </h2>
              {/* Status chip */}
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, padding:'3px 10px', borderRadius:99, background:st.bg, color:st.color, fontWeight:700, border:`1px solid ${st.color}30` }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:st.color, display:'inline-block' }}/>
                {st.label}
              </span>
            </div>
            {member.line_display_name && member.line_display_name !== member.full_name && (
              <p style={{ margin:'0 0 6px', fontSize:12, color:'#9CA3AF' }}>LINE: {member.line_display_name}</p>
            )}
            {/* Meta row */}
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:12, color:'#6B7280' }}>
              {member.phone && <span>📞 {member.phone}</span>}
              {member.citizen_id_masked && <span>🪪 {member.citizen_id_masked}</span>}
              <span>📅 สมัคร {new Date(member.created_at).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'numeric'})}</span>
              {member.registration_type && <span>📋 {member.registration_type}</span>}
            </div>
            {/* Roles */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:8 }}>
              {roles.map(r => {
                const cfg: Record<string,{icon:string;color:string;bg:string}> = {
                  farmer:     {icon:'🌾',color:'#065F46',bg:'#D1FAE5'},
                  staff:      {icon:'👷',color:'#92400E',bg:'#FEF3C7'},
                  inspector:  {icon:'🔍',color:'#1E40AF',bg:'#DBEAFE'},
                  leader:     {icon:'👑',color:'#92400E',bg:'#FEF3C7'},
                  truck_owner:{icon:'🚛',color:'#5B21B6',bg:'#EDE9FE'},
                  admin:      {icon:'⚙️',color:'#374151',bg:'#F3F4F6'},
                };
                const c = cfg[r.role] ?? {icon:'👤',color:'#374151',bg:'#F3F4F6'};
                return (
                  <span key={r.role} style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, padding:'3px 9px', borderRadius:99, background:c.bg, color:c.color, fontWeight:700 }}>
                    {c.icon} {r.role} {r.is_primary && <span style={{ fontSize:9, opacity:.7 }}>●</span>}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            {(member.status === 'pending' || member.status === 'returned') && <>
              <button className="admin-btn admin-btn--success" onClick={() => void updateStatus('approved')} disabled={acting} style={{ fontWeight:700 }}>✅ อนุมัติ</button>
              <button className="admin-btn admin-btn--secondary" onClick={() => setModal('return')} disabled={acting}>↩️ ตีกลับ</button>
              <button className="admin-btn admin-btn--danger"    onClick={() => setModal('reject')} disabled={acting}>❌ ปฏิเสธ</button>
            </>}
            {member.status === 'approved'  && <button className="admin-btn admin-btn--secondary" onClick={() => void updateStatus('suspended')} disabled={acting}>⛔ ระงับ</button>}
            {member.status === 'rejected'  && <button className="admin-btn admin-btn--success"   onClick={() => void updateStatus('pending')}   disabled={acting}>↩️ เปิดสมัครใหม่</button>}
            {member.status === 'suspended' && <button className="admin-btn admin-btn--success"   onClick={() => void updateStatus('approved')}  disabled={acting}>✅ คืนสิทธิ์</button>}
            <button onClick={() => void cancelAndAllowReapply()} disabled={acting}
              style={{ padding:'6px 12px', borderRadius:8, border:'1px solid #FECDD3', background:'#FFF1F2', color:'#DC2626', fontSize:12, fontWeight:600, cursor:'pointer' }}>
              🗑️ ยกเลิก
            </button>
          </div>
        </div>

        {/* Reason banners */}
        {member.status === 'returned' && member.return_reason && (
          <div style={{ marginTop:12, padding:'10px 14px', background:'#EFF6FF', borderRadius:8, fontSize:13, color:'#1E40AF' }}>
            ↩️ <strong>เหตุผลตีกลับ:</strong> {member.return_reason}
          </div>
        )}
        {member.status === 'rejected' && member.rejection_reason && member.rejection_reason !== 'cancelled_by_admin' && (
          <div style={{ marginTop:12, padding:'10px 14px', background:'#FEF2F2', borderRadius:8, fontSize:13, color:'#DC2626' }}>
            ❌ <strong>เหตุผลปฏิเสธ:</strong> {member.rejection_reason}
          </div>
        )}
      </div>

      {plots.length > 0 && (
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', marginTop:-8 }}>
          <span style={{ fontSize:12, padding:'4px 10px', borderRadius:99, background:'#D1FAE5', color:'#065F46', fontWeight:700 }}>🌾 {plots.length} แปลง</span>
          <span style={{ fontSize:12, padding:'4px 10px', borderRadius:99, background:'#EEF2FF', color:'#3730A3', fontWeight:700 }}>รวม {plots.reduce((s,p)=>s+(Number(p.area_rai)||0),0).toLocaleString()} ไร่</span>
        </div>
      )}

      {/* ── 2-Column Grid ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Col 1 — ข้อมูลส่วนตัว */}
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ padding:'13px 18px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:15 }}>👤</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>ข้อมูลส่วนตัว</span>
          </div>
          <div style={{ padding:'4px 0' }}>
            <div style={{ padding:'12px 18px', borderBottom:'1px solid #F3F4F6', display:'flex', justifyContent:'flex-end' }}>
              {!editingMember ? (
                <button className="admin-btn admin-btn--secondary" onClick={() => setEditingMember(true)} disabled={acting}>✏️ แก้ไขข้อมูลสมาชิก</button>
              ) : (
                <div style={{ display:'flex', gap:8 }}>
                  <button className="admin-btn admin-btn--secondary" onClick={() => setEditingMember(false)} disabled={acting}>ยกเลิก</button>
                  <button className="admin-btn admin-btn--success" onClick={() => void saveMemberProfile()} disabled={acting}>บันทึก</button>
                </div>
              )}
            </div>
            {editingMember && (
              <div style={{ padding:'12px 18px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, borderBottom:'1px solid #F3F4F6', background:'#FAFAFA' }}>
                {Object.entries({
                  full_name:'ชื่อ-นามสกุล', phone:'เบอร์โทร', address:'ที่อยู่ตามทะเบียน', house_no:'บ้านเลขที่', moo:'หมู่', subdistrict:'ตำบล', district:'อำเภอ', province:'จังหวัด',
                }).map(([key, label]) => (
                  <input key={key} value={memberForm[key as keyof typeof memberForm]} onChange={(e) => setMemberForm((p) => ({ ...p, [key]: key === 'citizen_id' ? e.target.value.replace(/\D/g, '').slice(0, 13) : e.target.value }))} placeholder={label} inputMode={key === 'citizen_id' ? 'numeric' : undefined} style={{ padding:'8px 10px', border:'1px solid #D1D5DB', borderRadius:8 }} />
                ))}
              </div>
            )}
            {[
              { label:'ชื่อ-นามสกุล', value: member.full_name || '—' },
              { label:'ชื่อ LINE',     value: member.line_display_name || '—' },
              { label:'เบอร์โทร',      value: member.phone || '—' },
              { label:'เลขบัตรฯ',      value: member.citizen_id_masked || '—' },
              { label:'ที่อยู่ตามทะเบียน', value: member.address || '—' },
              { label:'บ้านเลขที่',     value: member.house_no || '—' },
              { label:'หมู่',          value: member.moo || '—' },
              { label:'ตำบล',         value: member.subdistrict || '—' },
              { label:'อำเภอ',         value: member.district || '—' },
              { label:'จังหวัด',       value: member.province || '—' },
              { label:'ประเภทสมัคร',   value: member.registration_type || '—' },
              { label:'LINE UID',       value: member.line_user_id ? member.line_user_id.slice(0,20)+'…' : '—', mono:true },
            ].map((row, i) => (
              <div key={row.label} style={{ display:'flex', padding:'10px 18px', borderBottom:'1px solid #F9FAFB', background: i%2===0?'#fff':'#FAFAFA' }}>
                <span style={{ width:110, fontSize:12, fontWeight:600, color:'#6B7280', flexShrink:0 }}>{row.label}</span>
                <span style={{ fontSize:12, color:'#111', fontFamily: (row as {mono?:boolean}).mono?'monospace':'inherit' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Col 2 — ธนาคาร + ความพร้อม */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <BankAccountPanel
            bankName={member.bank_name}
            bankAccountNumber={member.bank_account_number}
            bankAccountName={member.bank_account_name}
            bankVerifiedStatus={member.bank_verified_status}
            acting={acting}
            onUpdateBank={(s) => void updateBankStatus(s)} />
          <CompletenessChecklistPanel member={member} plots={plots} vehicles={vehicles} docs={docs} roles={roles} readiness={readiness} />
        </div>
      </div>

      {/* ── Role Manager ── */}
      <MemberRoleManager memberId={memberId} memberName={member.full_name} currentRoles={roles} onRolesUpdated={load} />

      {/* ── แปลงเกษตร table/map ── */}
      {plots.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ padding:'13px 18px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:15 }}>🌾</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>แปลงเกษตร</span>
            <span style={{ fontSize:11, padding:'1px 7px', borderRadius:99, background:'#D1FAE5', color:'#065F46', fontWeight:600 }}>{plots.length} แปลง</span>
            <a href={`/admin/farming?member=${memberId}`}
              style={{ marginLeft:'auto', fontSize:11, padding:'3px 10px', borderRadius:6, border:'1px solid #D1FAE5', color:'#065F46', textDecoration:'none', fontWeight:600 }}>
              🗺️ ดูแผนที่เต็ม →
            </a>
          </div>

          {editingPlot && (
            <div ref={plotEditPanelRef} style={{ borderBottom:'1px solid #E5E7EB', background:'#FAFAFA' }}>
              <div style={{ position:'sticky', top:0, zIndex:5, padding:'10px 16px', background:'#ECFDF5', borderBottom:'1px solid #BBF7D0', color:'#065F46', fontWeight:800, fontSize:13 }}>
                กำลังแก้ไขแปลง: {editingPlot.name}
              </div>
              <div style={{ padding:14, display:'grid', gap:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:8 }}>
                  {(['name','area_rai','province','district','sub_district','description','land_doc_type','land_doc_number'] as const).map((k) => (
                    <input key={k} value={plotForm[k]} onChange={(e)=>setPlotForm((p)=>({ ...p, [k]: e.target.value }))} placeholder={k} style={{ padding:'8px 10px', border:'1px solid #D1D5DB', borderRadius:8 }} />
                  ))}
                </div>

                <label style={{ display:'grid', gap:4, fontSize:12, fontWeight:700, color:'#374151' }}>สถานะแปลง
                  <select value={plotForm.status} onChange={e => setPlotForm(p => ({ ...p, status:e.target.value }))}
                    style={{ padding:'8px 10px', border:'1px solid #D1D5DB', borderRadius:8, background:'#fff' }}>
                    {PLOT_STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </label>

                <div style={{ display:'grid', gap:6 }}>
                  <label style={{ display:'grid', gap:4, fontSize:12, fontWeight:700, color:'#374151' }}>เจ้าของ / สมาชิก
                    <input value={plotMemberQuery} onChange={e => setPlotMemberQuery(e.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร หรือ LINE…" style={{ padding:'8px 10px', border:'1px solid #D1D5DB', borderRadius:8 }} />
                  </label>
                  <select value={plotForm.member_id} onChange={e => setPlotForm(p => ({ ...p, member_id:e.target.value }))}
                    style={{ padding:'8px 10px', border:'1px solid #D1D5DB', borderRadius:8, background:'#fff' }}>
                    <option value="">— ยังไม่ระบุสมาชิก —</option>
                    {plotMemberOptions.map(m => <option key={m.id} value={m.id}>{m.full_name}{m.phone ? ` · ${m.phone}` : ''}{m.line_display_name ? ` · LINE: ${m.line_display_name}` : ''}</option>)}
                  </select>
                </div>

                <div style={{ display:'flex', gap:8, justifyContent:'flex-end', flexWrap:'wrap' }}>
                  <button className="admin-btn admin-btn--secondary" onClick={()=>{ setEditingPlot(null); setPlotBoundaryDrawing(false); }}>ยกเลิก</button>
                  <button className="admin-btn admin-btn--success" onClick={() => void saveEditPlot()}>บันทึกแปลง</button>
                </div>

                <div style={{ border:'1px solid #E5E7EB', borderRadius:10, padding:12, background:'#fff' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <p style={{ margin:0, fontSize:12, fontWeight:800, color:'#374151' }}>🗺️ วาดขอบเขต</p>
                    <button type="button" onClick={() => setPlotBoundaryDrawing(v => !v)}
                      style={{ padding:'5px 10px', borderRadius:8, border:'1px solid #D1D5DB', background:plotBoundaryDrawing?'#FFFBEB':'#fff', color:plotBoundaryDrawing?'#92400E':'#374151', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                      {plotBoundaryDrawing ? 'ปิดโหมดวาด' : 'วาดขอบเขต'}
                    </button>
                  </div>
                  <PlotMap plots={[{ ...editingPlot, sub_district: editingPlot.sub_district, member:null }]} selectedId={editingPlot.id} onSelect={setSelectedPlotId} editMode={plotBoundaryDrawing} onSaveBoundary={savePlotBoundaryFromMemberPage} height={320} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
            {/* Table */}
            <div style={{ borderRight:'1px solid #E5E7EB', overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#F9FAFB' }}>
                    {['ชื่อแปลง','ไร่','จังหวัด','GPS','ขอบเขต','จัดการ'].map(h => (
                      <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.04em', borderBottom:'1px solid #E5E7EB', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {plots.map((p, i) => (
                    <tr key={p.id}
                      onClick={() => setSelectedPlotId(p.id === selectedPlotId ? null : p.id)}
                      style={{ borderBottom:i<plots.length-1?'1px solid #F3F4F6':'none', cursor:'pointer', background:editingPlot?.id===p.id?'#DCFCE7':selectedPlotId===p.id?'#F0FDF4':'#fff', transition:'background .1s' }}>
                      <td style={{ padding:'10px 14px', fontWeight:600, fontSize:13 }}>{p.name}</td>
                      <td style={{ padding:'10px 14px', fontSize:13, color:'#2D6A4F', fontWeight:700 }}>{p.area_rai}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:'#6B7280' }}>{p.province ?? '—'}</td>
                      <td style={{ padding:'10px 14px', fontSize:11, color: p.lat?'#059669':'#D1D5DB' }}>
                        {p.lat ? '✓' : '—'}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:11 }}>
                        {p.boundary_geojson
                          ? <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'#EDE9FE', color:'#5B21B6', fontWeight:700 }}>มีขอบเขต</span>
                          : <span style={{ color:'#D1D5DB', fontSize:11 }}>—</span>}
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:11 }}>
                        <button onClick={(e) => { e.stopPropagation(); openEditPlot(p); }} style={{ border:'1px solid #D1D5DB', background:'#fff', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>แก้ไข</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Map */}
            <div style={{ padding:12 }}>
              <MemberPlotMiniMap
                plots={plots.map(p => ({ ...p, member:null }))}
                selectedId={selectedPlotId}
                onSelect={setSelectedPlotId} />
            </div>
          </div>
        </div>
      )}

      {/* ── ยานพาหนะ ── */}
      {vehicles.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
          <div style={{ padding:'13px 18px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:15 }}>🚛</span>
            <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>ยานพาหนะ</span>
            <span style={{ fontSize:11, padding:'1px 7px', borderRadius:99, background:'#EDE9FE', color:'#5B21B6', fontWeight:600 }}>{vehicles.length} คัน</span>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'#F9FAFB' }}>
                  {['ทะเบียน','ประเภท','ยี่ห้อ/รุ่น','ปี'].map(h => (
                    <th key={h} style={{ padding:'9px 16px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6B7280', textTransform:'uppercase', letterSpacing:'.05em', borderBottom:'1px solid #E5E7EB' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v, i) => (
                  <tr key={v.id} style={{ borderBottom: i<vehicles.length-1?'1px solid #F3F4F6':'none' }}>
                    <td style={{ padding:'11px 16px', fontWeight:700, fontSize:13, letterSpacing:1 }}>{v.plate_number}</td>
                    <td style={{ padding:'11px 16px', fontSize:13 }}>{v.vehicle_type}</td>
                    <td style={{ padding:'11px 16px', fontSize:12, color:'#6B7280' }}>{[v.brand,v.model].filter(Boolean).join(' ')||'—'}</td>
                    <td style={{ padding:'11px 16px', fontSize:12, color:'#6B7280' }}>{v.year_be ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 360 View — ประวัติครบวงจร ── */}
      <div style={{ background:'#fff', border:'1px solid #E5E7EB', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,.04)' }}>
        <div style={{ padding:'13px 18px', background:'#F9FAFB', borderBottom:'1px solid #E5E7EB', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:15 }}>📋</span>
          <span style={{ fontSize:13, fontWeight:700, color:'#374151' }}>ประวัติครบวงจร</span>
          <span style={{ fontSize:11, padding:'1px 7px', borderRadius:99, background:'#ECFDF5', color:'#065F46', fontWeight:600 }}>360°</span>
        </div>
        <div style={{ padding:'0 4px 8px' }}>
          <AdminMember360Tabs memberId={memberId} />
        </div>
      </div>

      {/* ── ประวัติการอนุมัติ ── */}
      <ApprovalHistoryPanel logs={logs} />
    </div>
  );
}

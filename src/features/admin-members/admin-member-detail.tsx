'use client';

import { useEffect, useState } from 'react';
import { ErrorState }   from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { MemberRoleManager } from './member-role-manager';
import { CompletenessChecklistPanel } from './panels/completeness-checklist-panel';
import { BankAccountPanel }           from './panels/bank-account-panel';
import { ReturnRejectModal }           from './panels/return-reject-modal';
import { ApprovalHistoryPanel }        from './panels/approval-history-panel';

type MemberDetail = {
  id: string; full_name: string; phone: string | null;
  citizen_id_masked: string; address: string | null;
  status: string; registration_type: string | null;
  line_user_id: string | null; line_display_name: string | null; line_picture_url: string | null;
  created_at: string;
  bank_name: string | null; bank_account_number: string | null; bank_account_name: string | null;
  bank_verified_status: string;
  return_reason: string | null; returned_at: string | null;
  rejection_reason: string | null;
};
type PlotRow    = { id: string; name: string; area_rai: number; lat: number; lng: number; status: string; province: string | null; land_doc_type: string | null };
type VehicleRow = { id: string; vehicle_type: string; plate_number: string; brand: string | null; model: string | null; year_be: number | null };
type RoleRow    = { role: string; is_primary: boolean };
type DocRow     = { doc_type: string; verified: boolean; file_url: string | null };
type LogRow     = { id: string; action: string; reason: string | null; acted_by: string | null; created_at: string };

const STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
  approved:  { label: '✅ อนุมัติแล้ว', color: '#1b5e20', bg: '#e8f5e9' },
  pending:   { label: '⏳ รออนุมัติ',   color: '#e65100', bg: '#fff8e1' },
  returned:  { label: '↩️ ตีกลับ',     color: '#1565c0', bg: '#e3f2fd' },
  rejected:  { label: '❌ ไม่อนุมัติ',  color: '#c62828', bg: '#ffebee' },
  suspended: { label: '⛔ ระงับ',       color: '#616161', bg: '#f5f5f5' },
};

export function AdminMemberDetail({ memberId }: { memberId: string }) {
  const [member,   setMember]   = useState<MemberDetail | null>(null);
  const [plots,    setPlots]    = useState<PlotRow[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [roles,    setRoles]    = useState<RoleRow[]>([]);
  const [docs,     setDocs]     = useState<DocRow[]>([]);
  const [logs,     setLogs]     = useState<LogRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [acting,   setActing]   = useState(false);
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
  }

  useEffect(() => { void load(); }, [memberId]);

  async function updateStatus(status: string, reason?: string) {
    setActing(true); setNotice(null); setIncompleteWarning(null);
    const res = await fetch('/api/admin/members/approvals', {
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
    const res = await fetch('/api/admin/members/approvals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, decision: 'bank_status', bankStatus }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) setError(payload.error ?? 'ดำเนินการไม่สำเร็จ');
    else setNotice(`บัญชีธนาคาร: ${bankStatus}`);
    setActing(false); await load();
  }

  if (loading) return <LoadingState label="กำลังโหลดข้อมูล…" />;
  if (error || !member) return <ErrorState title="ไม่พบข้อมูลสมาชิก" detail={error ?? ''} />;

  const st = STATUS_TH[member.status] ?? { label: member.status, color: '#333', bg: '#f5f5f5' };

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      {modal && <ReturnRejectModal type={modal} acting={acting} onCancel={() => setModal(null)} onConfirm={(r) => void updateStatus(modal === 'return' ? 'returned' : 'rejected', r)} />}

      {/* LINE Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {member.line_picture_url ? (
          <img src={member.line_picture_url} alt="LINE" width={52} height={52} style={{ borderRadius: '50%', border: '2px solid #a5d6a7', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0, border: '2px solid #a5d6a7' }}>
            {member.full_name?.[0] ?? '?'}
          </div>
        )}
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{member.full_name}</h2>
          {member.line_display_name && member.line_display_name !== member.full_name && (
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>LINE: {member.line_display_name}</p>
          )}
        </div>
      </div>

      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>✅ {notice}</div>}

      {/* Incomplete warning + override */}
      {incompleteWarning && (
        <div style={{ background: '#fff8e1', border: '1.5px solid #ffe082', borderRadius: 10, padding: '14px 16px' }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: '#e65100' }}>⚠️ ข้อมูลยังไม่ครบ: {incompleteWarning}</p>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#6b7280' }}>กรอกเหตุผลเพื่ออนุมัติข้ามขั้นตอน (override)</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <input placeholder="เหตุผล override…" id="override-reason"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14 }} />
            <button className="admin-btn admin-btn--success"
              onClick={() => void updateStatus('approved', (document.getElementById('override-reason') as HTMLInputElement)?.value || 'override')}
              disabled={acting}>✅ อนุมัติ (override)</button>
            <button className="admin-btn admin-btn--secondary" onClick={() => setIncompleteWarning(null)}>ยกเลิก</button>
          </div>
        </div>
      )}

      {/* Status + Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: st.bg, border: `1.5px solid ${st.color}55`, borderRadius: 14, padding: '16px 20px' }}>
        <div>
          <span style={{ fontSize: 16, fontWeight: 800, color: st.color }}>{st.label}</span>
          {member.status === 'returned' && member.return_reason && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#1565c0' }}>เหตุผล: {member.return_reason}</p>
          )}
          {member.status === 'rejected' && member.rejection_reason && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#c62828' }}>เหตุผล: {member.rejection_reason}</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
          {(member.status === 'pending' || member.status === 'returned') && <>
            <button className="admin-btn admin-btn--success"   onClick={() => void updateStatus('approved')} disabled={acting}>✅ อนุมัติ</button>
            <button className="admin-btn admin-btn--secondary" onClick={() => setModal('return')} disabled={acting}>↩️ ตีกลับ</button>
            <button className="admin-btn admin-btn--danger"    onClick={() => setModal('reject')} disabled={acting}>❌ ปฏิเสธ</button>
          </>}
          {member.status === 'approved'  && <button className="admin-btn admin-btn--secondary" onClick={() => void updateStatus('suspended')} disabled={acting}>⛔ ระงับบัญชี</button>}
          {member.status === 'rejected'  && <button className="admin-btn admin-btn--success"   onClick={() => void updateStatus('pending')}   disabled={acting}>↩️ ให้สมัครใหม่</button>}
          {member.status === 'suspended' && <button className="admin-btn admin-btn--success"   onClick={() => void updateStatus('approved')}  disabled={acting}>✅ คืนสิทธิ์</button>}
        </div>
      </div>

      {/* Panels */}
      <CompletenessChecklistPanel member={member} plots={plots} vehicles={vehicles} docs={docs} roles={roles} readiness={readiness} />
      <BankAccountPanel bankName={member.bank_name} bankAccountNumber={member.bank_account_number} bankAccountName={member.bank_account_name} bankVerifiedStatus={member.bank_verified_status} acting={acting} onUpdateBank={(s) => void updateBankStatus(s)} />

      {/* ข้อมูลส่วนตัว */}
      <section>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>👤 ข้อมูลส่วนตัว</h2>
        <div className="admin-table-wrap"><table className="admin-table"><tbody>
          {[
            ['ชื่อ-นามสกุล', member.full_name],
            ['ชื่อ LINE', member.line_display_name ?? '—'],
            ['เบอร์โทร', member.phone ?? '—'],
            ['เลขบัตรประชาชน', member.citizen_id_masked],
            ['ที่อยู่', member.address ?? '—'],
            ['ประเภทสมัคร', member.registration_type ?? '—'],
            ['LINE User ID', member.line_user_id ?? '—'],
            ['วันที่สมัคร', new Date(member.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })],
          ].map(([label, val]) => (
            <tr key={String(label)}>
              <td style={{ width: 160, fontWeight: 600, color: '#4a6741', background: '#f7faf7', whiteSpace: 'nowrap' }}>{label}</td>
              <td style={{ fontSize: label === 'LINE User ID' ? 12 : 14, fontFamily: label === 'LINE User ID' ? 'monospace' : 'inherit', color: label === 'LINE User ID' ? '#6b7280' : 'inherit' }}>{val}</td>
            </tr>
          ))}
        </tbody></table></div>
      </section>

      <MemberRoleManager memberId={memberId} memberName={member.full_name} currentRoles={roles} onRolesUpdated={load} />

      {plots.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🌾 แปลงเกษตร ({plots.length} แปลง)</h2>
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>ชื่อแปลง</th><th>ไร่</th><th>จังหวัด</th><th>เอกสาร</th><th>พิกัด GPS</th></tr></thead>
            <tbody>{plots.map((p) => (<tr key={p.id}><td style={{ fontWeight: 600 }}>{p.name}</td><td>{p.area_rai}</td><td>{p.province ?? '—'}</td><td>{p.land_doc_type ?? '—'}</td><td style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{p.lat?.toFixed(4)}, {p.lng?.toFixed(4)}</td></tr>))}</tbody>
          </table></div>
        </section>
      )}

      {vehicles.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🚛 ยานพาหนะ ({vehicles.length} คัน)</h2>
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>ทะเบียน</th><th>ประเภท</th><th>ยี่ห้อ / รุ่น</th><th>ปี</th></tr></thead>
            <tbody>{vehicles.map((v) => (<tr key={v.id}><td style={{ fontWeight: 700, letterSpacing: 1 }}>{v.plate_number}</td><td>{v.vehicle_type}</td><td>{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td><td>{v.year_be ?? '—'}</td></tr>))}</tbody>
          </table></div>
        </section>
      )}

      <ApprovalHistoryPanel logs={logs} />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { ErrorState }    from '@/shared/components/error-state';
import { LoadingState }  from '@/shared/components/loading-state';
import { MemberRoleManager } from './member-role-manager';

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
  returned:  { label: '↩️ ตีกลับ',      color: '#1565c0', bg: '#e3f2fd' },
  rejected:  { label: '❌ ไม่อนุมัติ',  color: '#c62828', bg: '#ffebee' },
  suspended: { label: '⛔ ระงับ',        color: '#616161', bg: '#f5f5f5' },
};
const BANK_STATUS_TH: Record<string, { label: string; color: string }> = {
  missing:      { label: '⚠️ ยังไม่มี',    color: '#9ca3af' },
  needs_review: { label: '🔍 รอตรวจสอบ',   color: '#e65100' },
  verified:     { label: '✅ ยืนยันแล้ว',  color: '#1b5e20' },
  rejected:     { label: '❌ ข้อมูลผิด',   color: '#c62828' },
};
const DOC_LABEL: Record<string, string> = {
  thai_id_card: '🪪 บัตรประชาชน', farmer_card: '📗 ทะเบียนเกษตรกร',
  land_doc: '📄 โฉนด/นส.3', vehicle_reg: '🚜 ทะเบียนรถ', other: '📎 อื่นๆ',
};

function maskBank(acc: string | null) {
  if (!acc) return '—';
  return acc.length > 4 ? 'xxx-x-x' + acc.slice(-4) + '-x' : '****';
}

// ── Checklist ──────────────────────────────────────────────────────────
function ChecklistPanel({ member, plots, vehicles, docs, roles }: {
  member: MemberDetail; plots: PlotRow[]; vehicles: VehicleRow[];
  docs: DocRow[]; roles: RoleRow[];
}) {
  const checks = [
    { label: 'ชื่อ-นามสกุล',    ok: !!member.full_name },
    { label: 'เบอร์โทร',         ok: !!member.phone },
    { label: 'ที่อยู่',           ok: !!member.address },
    { label: 'เลขบัตรประชาชน',   ok: !!member.citizen_id_masked && member.citizen_id_masked !== 'PENDING' },
    { label: 'LINE User ID',      ok: !!member.line_user_id },
    { label: 'บัญชีธนาคาร',      ok: member.bank_verified_status === 'verified' },
    { label: 'แปลงเกษตร',        ok: plots.length > 0, warning: plots.length === 0 },
  ];

  const roleSet = new Set(roles.map((r) => r.role));
  if (roleSet.has('farmer') || roleSet.has('leader')) {
    checks.push({ label: 'ข้อมูลแปลง (farmer)', ok: plots.length > 0, warning: plots.length === 0 });
  }
  if (roleSet.has('truck_owner')) {
    checks.push({ label: 'ข้อมูลยานพาหนะ', ok: vehicles.length > 0, warning: vehicles.length === 0 });
    checks.push({ label: 'บัญชีธนาคาร (สำหรับรับชำระ)', ok: member.bank_verified_status === 'verified' });
  }

  const passed  = checks.filter((c) => c.ok).length;
  const total   = checks.length;
  const allPass = passed === total;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>📋 Completeness Checklist</h2>
        <span style={{ fontSize: 13, fontWeight: 700, color: allPass ? '#1b5e20' : '#e65100' }}>
          {passed}/{total} {allPass ? '✅ พร้อมอนุมัติ' : '⚠️ ยังไม่ครบ'}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {checks.map((c) => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderRadius: 8, background: c.ok ? '#f0faf0' : '#fff8f0', border: `1px solid ${c.ok ? '#c8e6c9' : '#ffe0b2'}` }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{c.ok ? '✅' : '⚠️'}</span>
            <span style={{ fontSize: 13, color: c.ok ? '#1b5e20' : '#e65100', fontWeight: c.ok ? 400 : 500 }}>{c.label}</span>
          </div>
        ))}
      </div>
      {docs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#4a6741' }}>เอกสารประกอบ:</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {docs.map((d) => (
              <div key={d.doc_type} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderRadius: 8, background: d.verified ? '#f0faf0' : '#fff8e1', border: `1px solid ${d.verified ? '#c8e6c9' : '#ffe082'}` }}>
                <span style={{ fontSize: 14 }}>{d.verified ? '✅' : '⏳'}</span>
                <span style={{ fontSize: 13 }}>{DOC_LABEL[d.doc_type] ?? d.doc_type}</span>
                {d.file_url && <a href={d.file_url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', fontSize: 12, color: '#1565c0' }}>ดูไฟล์</a>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Main ───────────────────────────────────────────────────────────────
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
  const [showReturnModal,  setShowReturnModal]  = useState(false);
  const [showRejectModal,  setShowRejectModal]  = useState(false);
  const [reasonInput,      setReasonInput]      = useState('');

  async function load() {
    setLoading(true); setError(null);
    const res = await fetch(`/api/admin/members/${memberId}`);
    const payload = (await res.json()) as {
      member?: MemberDetail; plots?: PlotRow[]; vehicles?: VehicleRow[];
      roles?: RoleRow[]; docs?: DocRow[]; logs?: LogRow[]; error?: string;
    };
    if (!res.ok) { setError(payload.error ?? 'ไม่พบข้อมูลสมาชิก'); setLoading(false); return; }
    setMember(payload.member ?? null);
    setPlots(payload.plots ?? []);
    setVehicles(payload.vehicles ?? []);
    setRoles(payload.roles ?? []);
    setDocs(payload.docs ?? []);
    setLogs(payload.logs ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [memberId]);

  async function updateStatus(status: string, reason?: string) {
    setActing(true); setNotice(null);
    const res = await fetch('/api/admin/members/approvals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, decision: status, reason }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) { setError(payload.error ?? 'ดำเนินการไม่สำเร็จ'); setActing(false); return; }
    setNotice(`เปลี่ยนสถานะเป็น "${status}" แล้ว`);
    setActing(false); setShowReturnModal(false); setShowRejectModal(false); setReasonInput('');
    await load();
  }

  async function updateBankStatus(bankStatus: string) {
    setActing(true);
    const res = await fetch('/api/admin/members/approvals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, decision: 'bank_status', bankStatus }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) { setError(payload.error ?? 'ดำเนินการไม่สำเร็จ'); }
    else setNotice(`บัญชีธนาคาร: ${bankStatus}`);
    setActing(false); await load();
  }

  if (loading) return <LoadingState label="กำลังโหลดข้อมูล…" />;
  if (error || !member) return <ErrorState title="ไม่พบข้อมูลสมาชิก" detail={error ?? ''} />;

  const st   = STATUS_TH[member.status]  ?? { label: member.status,  color: '#333', bg: '#f5f5f5' };
  const bst  = BANK_STATUS_TH[member.bank_verified_status] ?? BANK_STATUS_TH.missing;

  return (
    <div style={{ display: 'grid', gap: 28 }}>

      {/* Modal: ตีกลับ */}
      {showReturnModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 480, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px' }}>↩️ ตีกลับให้แก้ไข</h3>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#6b7280' }}>กรุณาระบุเหตุผลที่ต้องการให้สมาชิกแก้ไข (จำเป็น)</p>
            <textarea value={reasonInput} onChange={(e) => setReasonInput(e.target.value)} rows={4} placeholder="เช่น: เลขบัตรประชาชนไม่ตรงกับเอกสาร, กรุณาแนบรูปถ่ายใหม่…" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 14, boxSizing: 'border-box', resize: 'none' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn--secondary" onClick={() => { setShowReturnModal(false); setReasonInput(''); }}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" disabled={!reasonInput.trim() || acting} onClick={() => void updateStatus('returned', reasonInput.trim())}>↩️ ตีกลับ</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: ปฏิเสธ */}
      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 480, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px', color: '#c62828' }}>❌ ปฏิเสธการสมัคร</h3>
            <p style={{ margin: '0 0 12px', fontSize: 14, color: '#6b7280' }}>กรุณาระบุเหตุผลที่ปฏิเสธ (จำเป็น)</p>
            <textarea value={reasonInput} onChange={(e) => setReasonInput(e.target.value)} rows={4} placeholder="เช่น: ข้อมูลไม่ถูกต้อง, ไม่อยู่ในพื้นที่รับสมัคร…" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1.5px solid #ffcdd2', fontSize: 14, boxSizing: 'border-box', resize: 'none' }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="admin-btn admin-btn--secondary" onClick={() => { setShowRejectModal(false); setReasonInput(''); }}>ยกเลิก</button>
              <button className="admin-btn admin-btn--danger" disabled={!reasonInput.trim() || acting} onClick={() => void updateStatus('rejected', reasonInput.trim())}>❌ ปฏิเสธ</button>
            </div>
          </div>
        </div>
      )}

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
            <button className="admin-btn admin-btn--success" onClick={() => void updateStatus('approved')} disabled={acting}>✅ อนุมัติ</button>
            <button className="admin-btn admin-btn--secondary" onClick={() => setShowReturnModal(true)} disabled={acting}>↩️ ตีกลับ</button>
            <button className="admin-btn admin-btn--danger"   onClick={() => setShowRejectModal(true)} disabled={acting}>❌ ปฏิเสธ</button>
          </>}
          {member.status === 'approved'  && <button className="admin-btn admin-btn--secondary" onClick={() => void updateStatus('suspended')} disabled={acting}>⛔ ระงับบัญชี</button>}
          {member.status === 'rejected'  && <button className="admin-btn admin-btn--success"   onClick={() => void updateStatus('pending')}   disabled={acting}>↩️ ให้สมัครใหม่</button>}
          {member.status === 'suspended' && <button className="admin-btn admin-btn--success"   onClick={() => void updateStatus('approved')}  disabled={acting}>✅ คืนสิทธิ์</button>}
        </div>
      </div>

      {/* Checklist */}
      <ChecklistPanel member={member} plots={plots} vehicles={vehicles} docs={docs} roles={roles} />

      {/* ข้อมูลส่วนตัว */}
      <section>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>👤 ข้อมูลส่วนตัว</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
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
            </tbody>
          </table>
        </div>
      </section>

      {/* บัญชีธนาคาร */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🏦 บัญชีธนาคาร</h2>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: bst.color }}>{bst.label}</span>
            {member.bank_verified_status === 'needs_review' && <>
              <button className="admin-btn admin-btn--success" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => void updateBankStatus('verified')} disabled={acting}>✅ ยืนยัน</button>
              <button className="admin-btn admin-btn--danger"  style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => void updateBankStatus('rejected')} disabled={acting}>❌ ข้อมูลผิด</button>
            </>}
            {member.bank_verified_status === 'verified' && (
              <button className="admin-btn admin-btn--secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => void updateBankStatus('needs_review')} disabled={acting}>🔄 ยกเลิกยืนยัน</button>
            )}
          </div>
        </div>
        {member.bank_name || member.bank_account_number ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <tbody>
                <tr><td style={{ width: 160, fontWeight: 600, color: '#4a6741', background: '#f7faf7' }}>ธนาคาร</td><td>{member.bank_name ?? '—'}</td></tr>
                <tr><td style={{ fontWeight: 600, color: '#4a6741', background: '#f7faf7' }}>เลขบัญชี</td><td style={{ fontFamily: 'monospace' }}>{maskBank(member.bank_account_number)}</td></tr>
                <tr><td style={{ fontWeight: 600, color: '#4a6741', background: '#f7faf7' }}>ชื่อบัญชี</td><td>{member.bank_account_name ?? '—'}</td></tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ color: '#9ca3af', fontSize: 14 }}>ยังไม่มีข้อมูลบัญชีธนาคาร</p>
        )}
      </section>

      {/* Role */}
      <MemberRoleManager memberId={memberId} memberName={member.full_name} currentRoles={roles} onRolesUpdated={load} />

      {/* แปลง */}
      {plots.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🌾 แปลงเกษตร ({plots.length} แปลง)</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ชื่อแปลง</th><th>ไร่</th><th>จังหวัด</th><th>เอกสาร</th><th>พิกัด GPS</th></tr></thead>
              <tbody>
                {plots.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td>{p.area_rai}</td>
                    <td>{p.province ?? '—'}</td>
                    <td>{p.land_doc_type ?? '—'}</td>
                    <td style={{ fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{p.lat?.toFixed(4)}, {p.lng?.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ยานพาหนะ */}
      {vehicles.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🚛 ยานพาหนะ ({vehicles.length} คัน)</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ทะเบียน</th><th>ประเภท</th><th>ยี่ห้อ / รุ่น</th><th>ปี</th></tr></thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 700, letterSpacing: 1 }}>{v.plate_number}</td>
                    <td>{v.vehicle_type}</td>
                    <td>{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</td>
                    <td>{v.year_be ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Approval Log */}
      {logs.length > 0 && (
        <section>
          <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>📝 ประวัติการดำเนินการ</h2>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>การกระทำ</th><th>เหตุผล</th><th>โดย</th><th>วันที่</th></tr></thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 600 }}>{l.action}</td>
                    <td style={{ color: '#6b7280', fontSize: 13 }}>{l.reason ?? '—'}</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{l.acted_by ?? '—'}</td>
                    <td style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(l.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

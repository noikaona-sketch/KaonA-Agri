'use client';

type PlotRow    = { id: string };
type VehicleRow = { id: string };
type RoleRow    = { role: string };
type DocRow     = { doc_type: string; verified: boolean; file_url: string | null };
type MemberInfo = { phone: string | null; address: string | null; citizen_id_masked: string; line_user_id: string | null; bank_verified_status: string };

const DOC_LABEL: Record<string, string> = {
  thai_id_card: '🪪 บัตรประชาชน', farmer_card: '📗 ทะเบียนเกษตรกร',
  land_doc: '📄 โฉนด/นส.3', vehicle_reg: '🚜 ทะเบียนรถ', other: '📎 อื่นๆ',
};

export function CompletenessChecklistPanel({ member, plots, vehicles, docs, roles, readiness }: {
  member: MemberInfo; plots: PlotRow[]; vehicles: VehicleRow[];
  docs: DocRow[]; roles: RoleRow[];
  readiness: { readyToApprove: boolean; missingFields: string[]; readinessReason: string[] } | null;
}) {
  const roleSet = new Set(roles.map((r) => r.role));
  const checks = [
    { label: 'ชื่อ-นามสกุล',            ok: true },
    { label: 'เบอร์โทร',                 ok: !!member.phone },
    { label: 'ที่อยู่',                   ok: !!member.address },
    { label: 'เลขบัตรประชาชน',           ok: !!member.citizen_id_masked && member.citizen_id_masked !== 'PENDING' },
    { label: 'LINE User ID',              ok: !!member.line_user_id },
    { label: 'บัญชีธนาคาร (verified)',    ok: member.bank_verified_status === 'verified' },
    ...(roleSet.has('farmer') || roleSet.has('leader')
      ? [{ label: 'แปลงเกษตร', ok: plots.length > 0 }] : []),
    ...(roleSet.has('truck_owner')
      ? [{ label: 'ยานพาหนะ', ok: vehicles.length > 0 }] : []),
  ];
  const passed = checks.filter((c) => c.ok).length;
  const critical = checks.filter((c) => ['เบอร์โทร', 'ที่อยู่', 'เลขบัตรประชาชน', 'แปลงเกษตร'].includes(c.label));
  const allPass = readiness?.readyToApprove ?? passed === checks.length;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0d3d1f' }}>📋 Checklist</h2>
        <span style={{ fontSize: 12, fontWeight: 700, color: allPass ? '#1b5e20' : '#e65100' }}>
          {passed}/{checks.length} {allPass ? '✅ พร้อมอนุมัติ' : '⚠️ ยังไม่ครบ'}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {critical.map((c) => (
          <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6, background: c.ok ? '#f0faf0' : '#fff8f0', border: `1px solid ${c.ok ? '#c8e6c9' : '#ffe0b2'}` }}>
            <span style={{ fontSize: 13 }}>{c.ok ? '✅' : '⚠️'}</span>
            <span style={{ fontSize: 12, color: c.ok ? '#1b5e20' : '#e65100', fontWeight: c.ok ? 400 : 500 }}>{c.label}</span>
          </div>
        ))}
      </div>
      {readiness && !readiness.readyToApprove && readiness.missingFields.length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#b45309' }}>
          ขาดข้อมูล: {readiness.missingFields.join(', ')}
        </div>
      )}
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

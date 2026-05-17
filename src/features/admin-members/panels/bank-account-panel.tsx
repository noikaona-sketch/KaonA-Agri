'use client';

const BANK_STATUS_TH: Record<string, { label: string; color: string }> = {
  missing:      { label: '⚠️ ยังไม่มี',    color: '#9ca3af' },
  needs_review: { label: '🔍 รอตรวจสอบ',   color: '#e65100' },
  verified:     { label: '✅ ยืนยันแล้ว',  color: '#1b5e20' },
  rejected:     { label: '❌ ข้อมูลผิด',   color: '#c62828' },
};

function maskBank(acc: string | null) {
  if (!acc) return '—';
  return acc.length > 4 ? 'xxx-x-x' + acc.slice(-4) + '-x' : '****';
}

export function BankAccountPanel({ bankName, bankAccountNumber, bankAccountName, bankVerifiedStatus, acting, onUpdateBank }: {
  bankName: string | null; bankAccountNumber: string | null; bankAccountName: string | null;
  bankVerifiedStatus: string; acting: boolean;
  onUpdateBank: (status: string) => void;
}) {
  const bst = BANK_STATUS_TH[bankVerifiedStatus] ?? BANK_STATUS_TH.missing;
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>🏦 บัญชีธนาคาร</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: bst.color }}>{bst.label}</span>
          {bankVerifiedStatus === 'needs_review' && <>
            <button className="admin-btn admin-btn--success" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onUpdateBank('verified')} disabled={acting}>✅ ยืนยัน</button>
            <button className="admin-btn admin-btn--danger"  style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onUpdateBank('rejected')} disabled={acting}>❌ ข้อมูลผิด</button>
          </>}
          {bankVerifiedStatus === 'verified' && (
            <button className="admin-btn admin-btn--secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => onUpdateBank('needs_review')} disabled={acting}>🔄 ยกเลิกยืนยัน</button>
          )}
        </div>
      </div>
      {bankName || bankAccountNumber ? (
        <div className="admin-table-wrap"><table className="admin-table"><tbody>
          <tr><td style={{ width: 160, fontWeight: 600, color: '#4a6741', background: '#f7faf7' }}>ธนาคาร</td><td>{bankName ?? '—'}</td></tr>
          <tr><td style={{ fontWeight: 600, color: '#4a6741', background: '#f7faf7' }}>เลขบัญชี</td><td style={{ fontFamily: 'monospace' }}>{maskBank(bankAccountNumber)}</td></tr>
          <tr><td style={{ fontWeight: 600, color: '#4a6741', background: '#f7faf7' }}>ชื่อบัญชี</td><td>{bankAccountName ?? '—'}</td></tr>
        </tbody></table></div>
      ) : <p style={{ color: '#9ca3af', fontSize: 14 }}>ยังไม่มีข้อมูลบัญชีธนาคาร</p>}
    </section>
  );
}

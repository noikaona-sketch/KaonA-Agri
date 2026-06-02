'use client';

import { type ChangeEvent, useState } from 'react';

type ValidRow = {
  scale_ticket_no: string; member_phone: string; member_id: string;
  gross_weight_kg: number; moisture_pct: number; weigh_at: string;
  location_name: string; quality_grade?: string;
};

type ErrorRow = {
  row: number; scale_ticket_no: string; reason: string; detail: string;
};

type PreviewResult = {
  valid: ValidRow[]; errors: ErrorRow[]; location_id: string;
};

const REASON_LABEL: Record<string, string> = {
  member_not_found:   '❌ ไม่พบสมาชิก',
  duplicate_ticket:   '🔁 เลขบัตรซ้ำ',
  invalid_moisture:   '💧 ความชื้นผิดช่วง',
  missing_field:      '⚠️ ข้อมูลไม่ครบ',
  location_not_found: '📍 ไม่พบจุดรับ',
};

const TEMPLATE = `scale_ticket_no,member_phone,gross_weight_kg,moisture_pct,weigh_at,location_name,quality_grade
TK-001,0812345678,5200,28.5,2026-05-23 10:30,จุดรับที่ 1,B
TK-002,0898765432,3800,25.0,2026-05-23 11:00,จุดรับที่ 1,A`;

const S = {
  section: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 16px', display: 'grid', gap: 10 } as React.CSSProperties,
};

export function IntakeCsvPreview({ locationId }: { locationId: string }) {
  const [csvText,  setCsvText]  = useState('');
  const [preview,  setPreview]  = useState<PreviewResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result,   setResult]   = useState<{ successCount: number; errors: { scale_ticket_no: string; error: string }[] } | null>(null);
  const [notice,   setNotice]   = useState<{ ok: boolean; msg: string } | null>(null);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result));
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  }

  async function runPreview() {
    if (!csvText.trim()) { setNotice({ ok: false, msg: 'กรุณาอัปโหลดหรือวาง CSV ก่อน' }); return; }
    setLoading(true); setNotice(null); setPreview(null); setResult(null);
    const res = await fetch('/api/intake/csv-import?action=preview', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvText, location_id: locationId }),
    });
    const d = (await res.json()) as PreviewResult & { error?: string };
    setLoading(false);
    if (!res.ok) { setNotice({ ok: false, msg: d.error ?? 'preview ไม่สำเร็จ' }); return; }
    setPreview(d);
  }

  async function commit() {
    if (!preview?.valid.length) return;
    setCommitting(true); setNotice(null);
    const res = await fetch('/api/intake/csv-import?action=commit', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: preview.valid, location_id: locationId }),
    });
    const d = (await res.json()) as { ok?: boolean; successCount?: number; errors?: []; error?: string };
    setCommitting(false);
    if (!res.ok || !d.ok) { setNotice({ ok: false, msg: d.error ?? 'commit ไม่สำเร็จ' }); return; }
    setResult({ successCount: d.successCount ?? 0, errors: d.errors ?? [] });
    setPreview(null); setCsvText('');
    setNotice({ ok: true, msg: `✅ บันทึกสำเร็จ ${d.successCount} รายการ` });
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = 'intake_template.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* Notice */}
      {notice && (
        <div style={{ padding: '10px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
          background: notice.ok ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${notice.ok ? '#86efac' : '#fca5a5'}`,
          color: notice.ok ? '#14532d' : '#991b1b',
          display: 'flex', justifyContent: 'space-between' }}>
          <span>{notice.msg}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>✕</button>
        </div>
      )}

      {/* Upload + template */}
      <div style={S.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>📁 อัปโหลด CSV</p>
          <button onClick={downloadTemplate}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 7, border: '1.5px solid #2e7d32', background: '#fff', color: '#2e7d32', cursor: 'pointer', fontWeight: 600 }}>
            ⬇ Template
          </button>
        </div>
        <input type="file" accept=".csv,text/csv" onChange={onFile} />
        <textarea
          value={csvText} onChange={(e) => setCsvText(e.target.value)}
          placeholder="หรือวางข้อมูล CSV ตรงนี้…"
          rows={4}
          style={{ padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'monospace', background: '#fafafa' }} />
        <button onClick={runPreview} disabled={loading || !csvText.trim()}
          style={{ padding: '10px', borderRadius: 9, border: 'none', background: loading ? '#e5e7eb' : '#1d4ed8', color: loading ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'wait' : 'pointer' }}>
          {loading ? '⏳ กำลังตรวจสอบ…' : '🔍 ตรวจสอบ CSV'}
        </button>
      </div>

      {/* Preview result */}
      {preview && (
        <div style={{ display: 'grid', gap: 10 }}>
          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: '#14532d' }}>{preview.valid.length}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>✅ รายการผ่าน</p>
            </div>
            <div style={{ background: preview.errors.length > 0 ? '#fef2f2' : '#f3f4f6', border: `1px solid ${preview.errors.length > 0 ? '#fca5a5' : '#e5e7eb'}`, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 24, fontWeight: 900, color: preview.errors.length > 0 ? '#dc2626' : '#9ca3af' }}>{preview.errors.length}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>❌ รายการผิดพลาด</p>
            </div>
          </div>

          {/* Valid rows sample */}
          {preview.valid.length > 0 && (
            <div style={S.section}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#14532d' }}>✅ รายการที่พร้อมบันทึก</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f0fdf4' }}>
                      {['บัตรชั่ง','เบอร์','น้ำหนัก','ความชื้น','เกรด'].map((h) => (
                        <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, whiteSpace: 'nowrap', color: '#14532d' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.valid.slice(0, 5).map((r) => (
                      <tr key={r.scale_ticket_no} style={{ borderTop: '1px solid #f0fdf4' }}>
                        <td style={{ padding: '5px 8px' }}>{r.scale_ticket_no}</td>
                        <td style={{ padding: '5px 8px' }}>{r.member_phone}</td>
                        <td style={{ padding: '5px 8px' }}>{r.gross_weight_kg.toLocaleString()}</td>
                        <td style={{ padding: '5px 8px' }}>{r.moisture_pct}%</td>
                        <td style={{ padding: '5px 8px' }}>{r.quality_grade ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.valid.length > 5 && (
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af' }}>...และอีก {preview.valid.length - 5} รายการ</p>
                )}
              </div>
            </div>
          )}

          {/* Errors */}
          {preview.errors.length > 0 && (
            <div style={{ ...S.section, borderColor: '#fca5a5' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#dc2626' }}>❌ รายการที่มีปัญหา (จะไม่ถูกบันทึก)</p>
              {preview.errors.map((e) => (
                <div key={`${e.row}-${e.scale_ticket_no}`} style={{ display: 'flex', gap: 8, fontSize: 12, padding: '6px 10px', background: '#fef2f2', borderRadius: 7 }}>
                  <span style={{ color: '#9ca3af', flexShrink: 0 }}>แถว {e.row}</span>
                  <span style={{ fontWeight: 600 }}>{e.scale_ticket_no}</span>
                  <span style={{ color: '#dc2626' }}>{REASON_LABEL[e.reason] ?? e.reason}</span>
                  <span style={{ color: '#6b7280', flex: 1 }}>— {e.detail}</span>
                </div>
              ))}
            </div>
          )}

          {/* Commit */}
          {preview.valid.length > 0 && (
            <button onClick={commit} disabled={committing}
              style={{ padding: '12px', borderRadius: 10, border: 'none', background: committing ? '#e5e7eb' : '#2e7d32', color: committing ? '#9ca3af' : '#fff', fontWeight: 800, fontSize: 15, cursor: committing ? 'wait' : 'pointer' }}>
              {committing ? '⏳ กำลังบันทึก…' : `✅ บันทึก ${preview.valid.length} รายการ`}
            </button>
          )}
        </div>
      )}

      {/* Commit result */}
      {result && (
        <div style={{ ...S.section, background: '#f0fdf4', borderColor: '#86efac' }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: '#14532d' }}>🎉 บันทึกเสร็จสิ้น</p>
          <p style={{ margin: 0, fontSize: 13 }}>บันทึกสำเร็จ {result.successCount} รายการ · ส่ง LINE ให้เกษตรกรแล้ว</p>
          {result.errors.length > 0 && (
            <div>
              <p style={{ margin: '4px 0', fontSize: 12, color: '#dc2626', fontWeight: 600 }}>รายการที่ fail ระหว่าง commit:</p>
              {result.errors.map((e) => (
                <p key={e.scale_ticket_no} style={{ margin: '2px 0', fontSize: 12, color: '#dc2626' }}>{e.scale_ticket_no}: {e.error}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

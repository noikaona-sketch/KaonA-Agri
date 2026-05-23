'use client';

import { useEffect, useState } from 'react';
import { useParams }           from 'next/navigation';
import { MobileAppShell }      from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }      from '@/shared/components/protected-route';
import { LoadingState }        from '@/shared/components/loading-state';

type Booking = {
  id: string; scheduled_date: string; actual_completed_at: string | null;
  scale_ticket_no: string | null; intake_source: string;
  gross_weight_kg: number | null; deduct_pct: number | null; net_weight_kg: number | null;
  actual_moisture_pct: number | null; quality_grade: string | null;
  price_per_kg: number | null; bonus_per_kg: number | null;
  gross_amount: number | null; net_amount: number | null;
  payment_method: string | null;
  pickup_locations: { name: string } | null;
  members: { full_name: string; phone: string | null; member_no: string | null } | null;
};

const fmt    = (n: number | null) => n == null ? '—' : n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
const fmtN   = (n: number | null, d = 4) => n == null ? '—' : Number(n).toFixed(d);
const thDate = (s: string | null) => s ? new Date(s).toLocaleString('th-TH', { dateStyle:'medium', timeStyle:'short' }) : '—';
const GRADE_LABEL: Record<string, string> = { A:'A — คุณภาพดี', B:'B — ปกติ', C:'C — ชื้นสูง', reject:'ปฏิเสธ' };
const PAY_LABEL:   Record<string, string> = { transfer:'โอนเงิน', cash:'เงินสด', debit_account:'ตัดบัญชีเครดิต' };

function Row({ label, value, bold, green, red }: { label: string; value: string; bold?: boolean; green?: boolean; red?: boolean }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'7px 0', borderBottom:'0.5px solid #f0f4f0' }}>
      <span style={{ fontSize:13, color:'#6b7280' }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:bold?700:500, color:green?'#166534':red?'#dc2626':'#111' }}>{value}</span>
    </div>
  );
}

function ReceiptContent() {
  const { id }    = useParams<{ id: string }>();
  const [b, setB] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  useEffect(() => {
    void fetch(`/api/intake/receipt/${id}`)
      .then(r => r.json())
      .then((d: { booking?: Booking; error?: string }) => {
        if (d.error) setErr(d.error);
        else setB(d.booking ?? null);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <LoadingState label="กำลังโหลดใบเสร็จ…" />;
  if (err || !b) return <p style={{ color:'#dc2626', padding:24, textAlign:'center' }}>{err || 'ไม่พบข้อมูล'}</p>;

  const isReject = b.quality_grade === 'reject';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Header card */}
      <div style={{ background: isReject ? '#fef2f2' : '#f0fdf4', border:`1px solid ${isReject?'#fca5a5':'#bbf7d0'}`, borderRadius:16, padding:'16px', textAlign:'center' }}>
        <p style={{ margin:'0 0 4px', fontSize:20 }}>{isReject ? '❌' : '✅'}</p>
        <p style={{ margin:'0 0 2px', fontSize:16, fontWeight:700, color:isReject?'#991b1b':'#166534' }}>
          {isReject ? 'ปฏิเสธการรับซื้อ' : 'รับซื้อสำเร็จ'}
        </p>
        {b.scale_ticket_no && <p style={{ margin:'0 0 4px', fontSize:12, color:'#6b7280' }}>ใบชั่ง: {b.scale_ticket_no}</p>}
        <p style={{ margin:0, fontSize:12, color:'#6b7280' }}>{thDate(b.actual_completed_at ?? b.scheduled_date)}</p>
      </div>

      {/* สมาชิก */}
      <div className="kaona-card">
        <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:600, color:'#9ca3af', textTransform:'uppercase' }}>สมาชิก</p>
        <Row label="ชื่อ"         value={b.members?.full_name ?? '—'} bold />
        <Row label="เบอร์โทร"     value={b.members?.phone ?? '—'} />
        <Row label="จุดรับ"       value={b.pickup_locations?.name ?? '—'} />
        <Row label="วันที่จอง"    value={thDate(b.scheduled_date)} />
      </div>

      {/* น้ำหนักและคุณภาพ */}
      {!isReject && (
        <div className="kaona-card">
          <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:600, color:'#9ca3af', textTransform:'uppercase' }}>น้ำหนักและคุณภาพ</p>
          <Row label="น้ำหนักรวม"    value={`${fmt(b.gross_weight_kg)} กก.`} />
          <Row label={`หัก ${fmtN(b.deduct_pct, 1)}%`} value={`−${fmt((b.gross_weight_kg ?? 0) - (b.net_weight_kg ?? 0))} กก.`} red />
          <Row label="น้ำหนักสุทธิ"  value={`${fmt(b.net_weight_kg)} กก.`} bold />
          <Row label="ความชื้น"      value={`${fmtN(b.actual_moisture_pct, 1)}%`} />
          <Row label="คุณภาพ"        value={GRADE_LABEL[b.quality_grade ?? ''] ?? b.quality_grade ?? '—'} />
        </div>
      )}

      {/* ราคา */}
      {!isReject && (
        <div className="kaona-card">
          <p style={{ margin:'0 0 8px', fontSize:11, fontWeight:600, color:'#9ca3af', textTransform:'uppercase' }}>ราคา</p>
          <Row label="ราคาฐาน"         value={`${fmtN(Number(b.price_per_kg) - Number(b.bonus_per_kg ?? 0))} บาท/กก.`} />
          {(b.bonus_per_kg ?? 0) > 0 && <Row label="โบนัส"  value={`+${fmtN(b.bonus_per_kg)} บาท/กก.`} green />}
          <Row label="ราคาสุทธิ"        value={`${fmtN(b.price_per_kg)} บาท/กก.`} bold />
          <Row label="ยอดก่อนโบนัส"    value={`฿${fmt(b.gross_amount)}`} />
          {(b.bonus_per_kg ?? 0) > 0 && (
            <Row label="โบนัสรวม" value={`+฿${fmt((b.bonus_per_kg ?? 0) * (b.net_weight_kg ?? 0))}`} green />
          )}
        </div>
      )}

      {/* ยอดสุทธิ */}
      {!isReject && (
        <div style={{ background:'#166534', borderRadius:14, padding:'18px 16px', textAlign:'center' }}>
          <p style={{ margin:'0 0 4px', fontSize:13, color:'#bbf7d0' }}>ยอดที่จะได้รับ</p>
          <p style={{ margin:'0 0 6px', fontSize:30, fontWeight:800, color:'#fff' }}>฿{fmt(b.net_amount)}</p>
          {b.payment_method && <p style={{ margin:0, fontSize:12, color:'#86efac' }}>{PAY_LABEL[b.payment_method] ?? b.payment_method}</p>}
        </div>
      )}

      {/* Print */}
      {!isReject && (
        <button className="admin-btn admin-btn--secondary" onClick={() => window.print()}
          style={{ fontSize:13 }}>🖨️ พิมพ์ใบเสร็จ</button>
      )}

      <p style={{ margin:0, fontSize:11, color:'#9ca3af', textAlign:'center' }}>
        ⚠️ ใบเสร็จนี้เป็นการประมาณการ — ยอดจริงขึ้นกับการยืนยันของโรงงาน
      </p>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <ProtectedRoute>
      <MobileAppShell title="🧾 ใบเสร็จรับซื้อ" subtitle="">
        <ReceiptContent />
      </MobileAppShell>
    </ProtectedRoute>
  );
}

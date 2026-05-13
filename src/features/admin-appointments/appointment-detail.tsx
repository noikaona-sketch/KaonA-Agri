'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type Appt = {
  id: string; appointment_number: string; status: string; payment_status: string;
  appointment_date: string; appointment_time: string | null;
  estimated_qty_kg: number; actual_qty_kg: number | null;
  price_per_kg: number; total_amount: number;
  paid_amount: number; location_note: string | null; note: string | null;
  quota_remaining_kg: number | null;
  members: { full_name: string; phone: string | null } | null;
  planting_cycles: { crop_name: string; season_year: number; product_id: string | null } | null;
};

const GRADE_COLORS: Record<string, string> = { A: '#1b5e20', B: '#e65100', C: '#c62828', reject: '#616161' };

type Props = { appointmentId: string };

export function AppointmentDetail({ appointmentId }: Props) {
  const [appt, setAppt]   = useState<Appt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Form สำหรับบันทึกผล
  const [actualQty, setActualQty] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [moisture, setMoisture] = useState('');
  const [qualityNote, setQualityNote] = useState('');
  const [gradeResult, setGradeResult] = useState<{ grade: string; price_adjust: number; is_acceptable: boolean } | null>(null);

  async function load() {
    const s = createSupabaseBrowserClient();
    const { data, error: err } = await s.from('sale_appointments')
      .select('*,members(full_name,phone),planting_cycles(crop_name,season_year,product_id)')
      .eq('id', appointmentId).maybeSingle();
    if (err) setError(err.message);
    else {
      setAppt(data as Appt);
      setActualQty(String((data as Appt).actual_qty_kg ?? (data as Appt).estimated_qty_kg));
      setPaidAmount(String((data as Appt).paid_amount ?? 0));
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [appointmentId]);

  // ตรวจ moisture → grade
  async function checkGrade() {
    if (!moisture || !appt?.planting_cycles?.product_id) return;
    const s = createSupabaseBrowserClient();
    const { data } = await s.rpc('calc_quality_grade', {
      p_product_id: appt.planting_cycles.product_id,
      p_moisture_pct: Number(moisture),
    });
    setGradeResult(data as typeof gradeResult);
  }

  async function saveResult() {
    if (!appt) return;
    setSaving(true); setNotice(null);
    const s = createSupabaseBrowserClient();
    const adjustedPrice = gradeResult ? appt.price_per_kg + gradeResult.price_adjust : appt.price_per_kg;
    await s.from('sale_appointments').update({
      status: 'completed',
      actual_qty_kg: Number(actualQty),
      paid_amount: Number(paidAmount),
      payment_status: Number(paidAmount) >= appt.total_amount ? 'paid' : Number(paidAmount) > 0 ? 'partial' : 'unpaid',
      payment_method: payMethod,
    }).eq('id', appointmentId);
    setSaving(false); setNotice('✅ บันทึกผลการขายแล้ว'); await load();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error || !appt) return <ErrorState title="ไม่พบข้อมูล" detail={error ?? ''} />;

  const effPrice = gradeResult ? appt.price_per_kg + gradeResult.price_adjust : appt.price_per_kg;
  const estimatedTotal = Number(actualQty || appt.estimated_qty_kg) * effPrice;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', background: '#f7faf7', border: '1px solid #e8ede8', borderRadius: 14, padding: '16px 20px' }}>
        <div>
          <p style={{ margin: 0, fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: '#0d3d1f' }}>{appt.appointment_number}</p>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            {new Date(appt.appointment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
            {appt.appointment_time ? ` เวลา ${appt.appointment_time} น.` : ''}
          </p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1b5e20' }}>{appt.total_amount.toLocaleString()} บาท</p>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{appt.estimated_qty_kg.toLocaleString()} กก. × {appt.price_per_kg} บาท</p>
        </div>
      </div>

      {/* ข้อมูลนัด */}
      <section>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#0d3d1f' }}>📋 รายละเอียดนัดขาย</h3>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <tbody>
              {[
                ['สมาชิก', `${appt.members?.full_name ?? '—'} (${appt.members?.phone ?? '—'})`],
                ['พืช/ฤดูกาล', `${appt.planting_cycles?.crop_name ?? '—'} ปี ${appt.planting_cycles?.season_year ?? '—'}`],
                ['ปริมาณคาด', `${appt.estimated_qty_kg.toLocaleString()} กก.`],
                ['สถานที่', appt.location_note ?? '—'],
                ['หมายเหตุ', appt.note ?? '—'],
              ].map(([k, v]) => (
                <tr key={String(k)}><td style={{ background: '#f7faf7', width: 130, fontWeight: 600, fontSize: 13, color: '#4a6741' }}>{k}</td><td style={{ fontSize: 13 }}>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ตรวจคุณภาพ */}
      {appt.planting_cycles?.product_id && appt.status !== 'completed' && (
        <section style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#e65100' }}>🌽 ตรวจคุณภาพข้าวโพด</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <label className="reg-label" style={{ fontSize: 13 }}>ความชื้น (%)
              <input className="reg-input" type="number" step="0.1" value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="14.5" />
            </label>
            <label className="reg-label" style={{ fontSize: 13 }}>หมายเหตุ
              <input className="reg-input" value={qualityNote} onChange={(e) => setQualityNote(e.target.value)} placeholder="ลักษณะเมล็ด..." />
            </label>
            <button className="admin-btn admin-btn--secondary" onClick={checkGrade} style={{ minHeight: 44 }}>🔍 ตรวจ Grade</button>
          </div>
          {gradeResult && (
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 10, background: '#fff', border: `2px solid ${GRADE_COLORS[gradeResult.grade]}` }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: GRADE_COLORS[gradeResult.grade] }}>เกรด {gradeResult.grade}</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>ความชื้น {moisture}%</p>
                </div>
                <div>
                  {gradeResult.is_acceptable ? (
                    <>
                      <p style={{ margin: 0, fontWeight: 700, color: '#1b5e20' }}>✅ รับซื้อได้</p>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
                        ปรับราคา: {gradeResult.price_adjust >= 0 ? '+' : ''}{gradeResult.price_adjust} บาท/กก.
                        → ราคาจริง {effPrice.toFixed(2)} บาท/กก.
                      </p>
                    </>
                  ) : (
                    <p style={{ margin: 0, fontWeight: 700, color: '#c62828' }}>❌ ไม่รับซื้อ — ความชื้นสูงเกิน</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* บันทึกผล */}
      {appt.status !== 'completed' && (
        <section style={{ background: '#f7faf7', border: '1px solid #e8ede8', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#0d3d1f' }}>✅ บันทึกผลการขาย</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label className="reg-label" style={{ fontSize: 13 }}>ปริมาณจริง (กก.)
              <input className="reg-input" type="number" value={actualQty} onChange={(e) => setActualQty(e.target.value)} />
            </label>
            <label className="reg-label" style={{ fontSize: 13 }}>วิธีชำระ
              <select className="reg-input" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="cash">💵 เงินสด</option>
                <option value="transfer">📱 โอน</option>
                <option value="debit_account">📒 ติดบัญชี</option>
              </select>
            </label>
            <label className="reg-label" style={{ fontSize: 13 }}>ชำระแล้ว (บาท)
              <input className="reg-input" type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
            </label>
          </div>
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#e8f5e9', borderRadius: 8, fontSize: 14, fontWeight: 600, color: '#1b5e20' }}>
            💰 ยอดจริง: {estimatedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} บาท
            ({Number(actualQty || 0).toLocaleString()} กก. × {effPrice} บาท)
          </div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="admin-btn admin-btn--primary" style={{ padding: '12px 24px', fontSize: 15 }} onClick={saveResult} disabled={saving}>
              {saving ? 'กำลังบันทึก…' : '💾 บันทึกผล'}
            </button>
          </div>
        </section>
      )}

      {/* ผลสรุป (completed) */}
      {appt.status === 'completed' && (
        <section style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#1b5e20' }}>🏁 ผลการขาย</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {[
              { label: 'ปริมาณจริง', value: `${(appt.actual_qty_kg ?? 0).toLocaleString()} กก.` },
              { label: 'ยอดรวม', value: `${appt.total_amount.toLocaleString()} บาท` },
              { label: 'ชำระแล้ว', value: `${appt.paid_amount.toLocaleString()} บาท` },
            ].map((k) => (
              <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1b5e20' }}>{k.value}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{k.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';

import { UIButton }                from '@/shared/components/ui-button';
import { HarvestBookingStatusCard }         from './harvest-booking-status-card';
import { HarvestValuePreview }              from './harvest-value-preview';
import { useMemberHarvestBooking }          from './use-member-harvest-booking';

type Props = {
  cycleId:   string;
  cropName:  string;
  plotId?:   string;
  onSuccess?: () => void;
};

export function MemberHarvestBookingForm({ cycleId, cropName, plotId, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  // Form state
  const [expectedDateFrom, setExpectedDateFrom] = useState('');
  const [expectedDateTo, setExpectedDateTo] = useState('');
  const [estimatedTonnage, setEstimatedTonnage] = useState('');
  const [requiresDryer, setRequiresDryer] = useState(false);
  const [moisturePct,    setMoisturePct]    = useState('');
  const [note,           setNote]           = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState(false);

  // Hook called at top level — submit function available throughout component
  const { existing, marketPrice, queueSnapshot, loading, submit, update } = useMemberHarvestBooking(cycleId, cropName);
  const [isEditMode, setIsEditMode] = useState(false);

  const hints: string[] = [];
  if (queueSnapshot) {
    if (queueSnapshot.nearTermCount >= 12) hints.push('ช่วงนี้คิวรับซื้อค่อนข้างแน่น');
    if (queueSnapshot.pendingCount >= 6) hints.push('ช่วงนี้มีรายการรอยืนยันหลายรายการ');
    if (queueSnapshot.dryerRequiredCount >= 5) hints.push('อาจมีเวลารออบนานกว่าปกติ');
    if (queueSnapshot.moistureSensitiveCount >= 4) hints.push('เป็นช่วงที่ความชื้นมีผลต่อคิวอบมากขึ้น');
  }

  if (loading) {
    return (
      <div className="kaona-card">
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>กำลังโหลดข้อมูลการจองเก็บเกี่ยว…</p>
      </div>
    );
  }
  if (existing && !isEditMode) return <div><HarvestBookingStatusCard booking={existing} />
    {existing.status !== 'completed' && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <UIButton type="button" onClick={() => {
        setExpectedDateFrom(existing.expected_date_from);
        setExpectedDateTo(existing.expected_date_to);
        setEstimatedTonnage(String(existing.estimated_tonnage));
        setMoisturePct(existing.estimated_moisture === null ? '' : String(existing.estimated_moisture));
        setRequiresDryer(existing.requires_dryer);
        setNote(existing.note ?? '');
        setIsEditMode(true);
      }}>แก้ไข</UIButton>
      <UIButton type="button" variant="secondary" onClick={() => void (async () => {
        const err = await update({ id: existing.id, status: 'cancelled' });
        if (err) setError(err); else window.location.reload();
      })()}>ยกเลิก</UIButton>
    </div>}
  </div>;
  if (success) {
    return (
      <div className="kaona-card" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
          ✅ แจ้งเก็บเกี่ยวสำเร็จ — รอทีมงานยืนยัน
        </p>
      </div>
    );
  }

  const yieldNum = Number(estimatedTonnage);
  const moistureNum = Number(moisturePct);

  async function handleSubmit() {
    setError(null);
    if (!expectedDateFrom || !expectedDateTo)               { setError('กรุณาระบุช่วงวันที่คาดว่าจะเก็บเกี่ยว'); return; }
    if (!estimatedTonnage || yieldNum <= 0) { setError('กรุณาระบุน้ำหนักผลผลิตที่คาดไว้ (ตัน)'); return; }

    setSubmitting(true);
    const err = await (existing ? update : submit)({
      ...(existing ? { id: existing.id } : {}),
      expected_date_from: expectedDateFrom,
      expected_date_to: expectedDateTo,
      estimated_tonnage: yieldNum,
      estimated_moisture: moisturePct ? Number(moisturePct) : undefined,
      requires_dryer: requiresDryer,
      note:                   note.trim() || undefined,
    });
    setSubmitting(false);
    if (err) { setError(err); } else { setSuccess(true); onSuccess?.(); }
  }

  return (
    <div className="kaona-card">
      <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 15 }}>🌾 แจ้งแผนเก็บเกี่ยว</p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        แจ้งข้อมูลเบื้องต้นเพื่อช่วยวางแผนโรงงาน — ข้อมูลจริงอาจเปลี่ยนแปลงได้
      </p>

      {hints.length > 0 && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 10,
          padding: '10px 12px',
          marginBottom: 14,
        }}>
          <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 13, color: '#1d4ed8' }}>
            ℹ️ ข้อมูลช่วงเวลารับซื้อ (เพื่อประกอบการตัดสินใจ)
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: '#1f2937', lineHeight: 1.45 }}>
            {hints.map((hint) => <li key={hint}>{hint}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label className="reg-label">วันที่เริ่มต้น <span style={{ color: '#e53e3e' }}>*</span>
          <input className="reg-input" type="date" value={expectedDateFrom} min={today} disabled={submitting}
            onChange={(e) => setExpectedDateFrom(e.target.value)} />
        </label>
        <label className="reg-label">วันที่สิ้นสุด <span style={{ color: '#e53e3e' }}>*</span>
          <input className="reg-input" type="date" value={expectedDateTo} min={expectedDateFrom || today} disabled={submitting}
            onChange={(e) => setExpectedDateTo(e.target.value)} />
        </label>
      </div>

      <label className="reg-label">
        น้ำหนักผลผลิตที่คาดไว้ (ตัน) <span style={{ color: '#e53e3e' }}>*</span>
        <input className="reg-input" type="number" inputMode="decimal" min="0" step="100"
          value={estimatedTonnage} disabled={submitting} placeholder="เช่น 12"
          onChange={(e) => setEstimatedTonnage(e.target.value)} />
      </label>

      {marketPrice !== null && yieldNum > 0 && (
        <HarvestValuePreview
          estimatedYieldKg={yieldNum * 1000}
          marketPricePerKg={marketPrice}
          estimatedMoisturePct={moisturePct ? moistureNum : undefined}
        />
      )}
      <label className="reg-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="checkbox" checked={requiresDryer} onChange={(e) => setRequiresDryer(e.target.checked)} />
        ต้องการอบลดความชื้น
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <label className="reg-label">
          ความชื้นโดยประมาณ (%) <span style={{ fontSize: 11, color: '#9ca3af' }}>ไม่บังคับ</span>
          <input className="reg-input" type="number" inputMode="decimal" min="0" max="100" step="0.5"
            value={moisturePct} disabled={submitting} placeholder="เช่น 28.5"
            onChange={(e) => setMoisturePct(e.target.value)} />
        </label>
        <div />
      </div>

      <label className="reg-label">
        หมายเหตุ <span style={{ fontSize: 11, color: '#9ca3af' }}>ไม่บังคับ</span>
        <textarea className="reg-input reg-textarea" rows={3} value={note} disabled={submitting}
          placeholder="เช่น สภาพแปลง ปัญหาที่พบ จุดนัดหมาย"
          onChange={(e) => setNote(e.target.value)} />
      </label>

      {error && (
        <div style={{
          background: '#fff3cd', border: '1px solid #ffc107',
          borderRadius: 8, padding: '10px 14px', color: '#856404', fontSize: 13, marginBottom: 8,
        }}>
          ⚠️ {error}
        </div>
      )}

      <UIButton fullWidth type="button"
        disabled={submitting || !expectedDateFrom || !expectedDateTo || !estimatedTonnage}
        loading={submitting}
        onClick={() => void handleSubmit()}>
        {submitting ? 'กำลังบันทึก…' : existing ? 'บันทึกการแก้ไข' : 'บันทึกแผนเก็บเกี่ยว'}
      </UIButton>
    </div>
  );
}

'use client';

import { useState } from 'react';

import { UIButton }                from '@/shared/components/ui-button';
import { DryingSelector, DeliverySelector } from './harvest-booking-options';
import { HarvestBookingStatusCard }         from './harvest-booking-status-card';
import { HarvestValuePreview }              from './harvest-value-preview';
import { useMemberHarvestBooking }          from './use-member-harvest-booking';
import type { DryingPref, DeliveryType }    from './harvest-booking-options';

type Props = {
  cycleId:   string;
  cropName:  string;
  plotId?:   string;
  onSuccess?: () => void;
};

export function MemberHarvestBookingForm({ cycleId, cropName, plotId, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  // Form state
  const [scheduledDate,  setScheduledDate]  = useState('');
  const [estimatedYield, setEstimatedYield] = useState('');
  const [dryingPref,     setDryingPref]     = useState<DryingPref>('unknown');
  const [deliveryType,   setDeliveryType]   = useState<DeliveryType>('unknown');
  const [moisturePct,    setMoisturePct]    = useState('');
  const [moistureSource, setMoistureSource] = useState('');
  const [note,           setNote]           = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [success,        setSuccess]        = useState(false);

  // Hook called at top level — submit function available throughout component
  const { existing, marketPrice, queueSnapshot, loading, submit } = useMemberHarvestBooking(cycleId, cropName);

  const hints: string[] = [];
  if (queueSnapshot) {
    if (queueSnapshot.nearTermCount >= 12) hints.push('ช่วงนี้คิวรับซื้อค่อนข้างแน่น');
    if (queueSnapshot.pendingCount >= 6) hints.push('ช่วงนี้มีรายการรอยืนยันหลายรายการ');
    if (queueSnapshot.dryerRequiredCount >= 5) hints.push('อาจมีเวลารออบนานกว่าปกติ');
    if (queueSnapshot.moistureSensitiveCount >= 4) hints.push('เป็นช่วงที่ความชื้นมีผลต่อคิวอบมากขึ้น');
  }

  if (loading) return null;
  if (existing) return <HarvestBookingStatusCard booking={existing} />;
  if (success) {
    return (
      <div className="kaona-card" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
          ✅ แจ้งเก็บเกี่ยวสำเร็จ — รอทีมงานยืนยัน
        </p>
      </div>
    );
  }

  const yieldNum = Number(estimatedYield);
  const moistureNum = Number(moisturePct);

  async function handleSubmit() {
    setError(null);
    if (!scheduledDate)               { setError('กรุณาระบุวันที่คาดว่าจะเก็บเกี่ยว'); return; }
    if (!estimatedYield || yieldNum <= 0) { setError('กรุณาระบุน้ำหนักผลผลิตที่คาดไว้ (กก.)'); return; }

    setSubmitting(true);
    const err = await submit({
      planting_cycle_id:      cycleId,
      scheduled_date:         scheduledDate,
      plot_id:                plotId,
      note:                   note.trim() || undefined,
      drying_preference:      dryingPref,
      delivery_type:          deliveryType,
      estimated_yield_kg:     yieldNum,
      estimated_moisture_pct: moisturePct ? Number(moisturePct) : undefined,
      moisture_source:        moistureSource || undefined,
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

      <label>
        วันที่คาดว่าจะเก็บเกี่ยว <span style={{ color: '#e53e3e' }}>*</span>
        <input type="date" value={scheduledDate} min={today} disabled={submitting}
          onChange={(e) => setScheduledDate(e.target.value)} />
      </label>

      <label>
        น้ำหนักผลผลิตที่คาดไว้ (กก.) <span style={{ color: '#e53e3e' }}>*</span>
        <input type="number" inputMode="decimal" min="0" step="100"
          value={estimatedYield} disabled={submitting} placeholder="เช่น 5000"
          onChange={(e) => setEstimatedYield(e.target.value)} />
      </label>

      {marketPrice !== null && yieldNum > 0 && (
        <HarvestValuePreview
          estimatedYieldKg={yieldNum}
          marketPricePerKg={marketPrice}
          estimatedMoisturePct={moisturePct ? moistureNum : undefined}
        />
      )}

      <DryingSelector   value={dryingPref}  onChange={setDryingPref}  disabled={submitting} />
      <DeliverySelector value={deliveryType} onChange={setDeliveryType} disabled={submitting} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <label>
          ความชื้นโดยประมาณ (%) <span style={{ fontSize: 11, color: '#9ca3af' }}>ไม่บังคับ</span>
          <input type="number" inputMode="decimal" min="0" max="100" step="0.5"
            value={moisturePct} disabled={submitting} placeholder="เช่น 28.5"
            onChange={(e) => setMoisturePct(e.target.value)} />
        </label>
        <label>
          วิธีประเมินความชื้น
          <select value={moistureSource} disabled={submitting || !moisturePct}
            onChange={(e) => setMoistureSource(e.target.value)}>
            <option value="">เลือก</option>
            <option value="farmer_estimate">ประเมินจากประสบการณ์</option>
            <option value="field_test">ทดสอบในแปลง</option>
            <option value="factory_measure">วัดจากโรงงาน</option>
          </select>
        </label>
      </div>

      <label>
        หมายเหตุ <span style={{ fontSize: 11, color: '#9ca3af' }}>ไม่บังคับ</span>
        <textarea rows={2} value={note} disabled={submitting}
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
        disabled={submitting || !scheduledDate || !estimatedYield}
        loading={submitting}
        onClick={() => void handleSubmit()}>
        {submitting ? 'กำลังบันทึก…' : 'บันทึกแผนเก็บเกี่ยว'}
      </UIButton>
    </div>
  );
}

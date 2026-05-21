'use client';

import { useEffect, useState } from 'react';

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
  const [editing,        setEditing]        = useState(false);

  const { existing, marketPrice, queueSnapshot, loading, submit, update, cancel } = useMemberHarvestBooking(cycleId, cropName);

  useEffect(() => {
    if (!existing || editing) return;
    setScheduledDate(existing.scheduled_date || '');
    setEstimatedYield(existing.actual_yield_kg ? String(existing.actual_yield_kg) : '');
    setDryingPref((existing.drying_preference as DryingPref) || 'unknown');
    setDeliveryType((existing.delivery_type as DeliveryType) || 'unknown');
    setMoisturePct(existing.estimated_moisture_pct != null ? String(existing.estimated_moisture_pct) : '');
    setNote(existing.note ?? '');
  }, [existing, editing]);

  const hints: string[] = [];
  if (queueSnapshot) {
    if (queueSnapshot.nearTermCount >= 12) hints.push('ช่วงนี้คิวรับซื้อค่อนข้างแน่น');
    if (queueSnapshot.pendingCount >= 6) hints.push('ช่วงนี้มีรายการรอยืนยันหลายรายการ');
    if (queueSnapshot.dryerRequiredCount >= 5) hints.push('อาจมีเวลารออบนานกว่าปกติ');
    if (queueSnapshot.moistureSensitiveCount >= 4) hints.push('เป็นช่วงที่ความชื้นมีผลต่อคิวอบมากขึ้น');
  }

  if (loading) return <div className="kaona-card"><p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>กำลังโหลดข้อมูลการจองเก็บเกี่ยว…</p></div>;

  if (existing && !editing) {
    return (
      <HarvestBookingStatusCard
        booking={existing}
        busy={submitting}
        onEdit={() => setEditing(true)}
        onCancel={() => {
          void (async () => {
            if (!confirm('ยืนยันยกเลิกแผนเก็บเกี่ยวนี้?')) return;
            setSubmitting(true);
            const err = await cancel(existing.id);
            setSubmitting(false);
            if (err) setError(err);
          })();
        }}
      />
    );
  }
  if (success) return <div className="kaona-card" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}><p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>✅ บันทึกแผนเก็บเกี่ยวสำเร็จ</p></div>;

  const yieldNum = Number(estimatedYield);
  const moistureNum = Number(moisturePct);

  async function handleSubmit() {
    setError(null);
    if (!scheduledDate) { setError('กรุณาระบุวันที่คาดว่าจะเก็บเกี่ยว'); return; }
    if (!estimatedYield || yieldNum <= 0) { setError('กรุณาระบุน้ำหนักผลผลิตที่คาดไว้ (กก.)'); return; }

    setSubmitting(true);
    const payload = {
      id: existing?.id,
      planting_cycle_id:      cycleId,
      scheduled_date:         scheduledDate,
      plot_id:                plotId,
      note:                   note.trim() || undefined,
      drying_preference:      dryingPref,
      delivery_type:          deliveryType,
      estimated_yield_kg:     yieldNum,
      estimated_moisture_pct: moisturePct ? Number(moisturePct) : undefined,
      moisture_source:        moistureSource || undefined,
    };
    const err = existing ? await update(payload) : await submit(payload);
    setSubmitting(false);
    if (err) setError(err);
    else { setSuccess(true); setEditing(false); onSuccess?.(); }
  }

  return (
    <div className="kaona-card">
      <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 15 }}>🌾 {existing ? 'แก้ไขแผนเก็บเกี่ยว' : 'แจ้งแผนเก็บเกี่ยว'}</p>
      {error && <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', color: '#856404', fontSize: 13, marginBottom: 8 }}>⚠️ {error}</div>}
      <label className="reg-label">วันที่คาดว่าจะเก็บเกี่ยว <span style={{ color: '#e53e3e' }}>*</span><input className="reg-input" type="date" value={scheduledDate} min={today} disabled={submitting} onChange={(e) => setScheduledDate(e.target.value)} /></label>
      <label className="reg-label">น้ำหนักผลผลิตที่คาดไว้ (กก.) <span style={{ color: '#e53e3e' }}>*</span><input className="reg-input" type="number" inputMode="decimal" min="0" step="100" value={estimatedYield} disabled={submitting} onChange={(e) => setEstimatedYield(e.target.value)} /></label>
      {marketPrice !== null && yieldNum > 0 && <HarvestValuePreview estimatedYieldKg={yieldNum} marketPricePerKg={marketPrice} estimatedMoisturePct={moisturePct ? moistureNum : undefined} />}
      <DryingSelector value={dryingPref} onChange={setDryingPref} disabled={submitting} />
      <DeliverySelector value={deliveryType} onChange={setDeliveryType} disabled={submitting} />
      <UIButton fullWidth type="button" disabled={submitting || !scheduledDate || !estimatedYield} loading={submitting} onClick={() => void handleSubmit()}>{submitting ? 'กำลังบันทึก…' : existing ? 'บันทึกการแก้ไข' : 'บันทึกแผนเก็บเกี่ยว'}</UIButton>
      {hints.length > 0 && <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 12 }}>{hints.map((h) => <li key={h}>{h}</li>)}</ul>}
    </div>
  );
}

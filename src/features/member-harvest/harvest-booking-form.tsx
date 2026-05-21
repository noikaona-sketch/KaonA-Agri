'use client';

import { useEffect, useState } from 'react';
import { UIButton } from '@/shared/components/ui-button';
import { HarvestBookingStatusCard } from './harvest-booking-status-card';
import { useMemberHarvestBooking } from './use-member-harvest-booking';

type Props = { cycleId: string; cropName: string; plotId?: string; onSuccess?: () => void };

export function MemberHarvestBookingForm({ cycleId, cropName, onSuccess }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [estimatedTonnage, setEstimatedTonnage] = useState('');
  const [estimatedMoisture, setEstimatedMoisture] = useState('');
  const [requiresDryer, setRequiresDryer] = useState(false);
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { existing, loading, submit, update, cancel } = useMemberHarvestBooking(cycleId, cropName);

  useEffect(() => {
    if (!existing || editing) return;
    setDateFrom(existing.expected_date_from ?? '');
    setDateTo(existing.expected_date_to ?? '');
    setEstimatedTonnage(existing.estimated_tonnage != null ? String(existing.estimated_tonnage) : '');
    setEstimatedMoisture(existing.estimated_moisture != null ? String(existing.estimated_moisture) : '');
    setRequiresDryer(Boolean(existing.requires_dryer));
    setNote(existing.note ?? '');
  }, [existing, editing]);

  if (loading) return <div className="kaona-card">กำลังโหลดข้อมูลการจองเก็บเกี่ยว…</div>;
  if (existing && !editing) {
    return <HarvestBookingStatusCard booking={existing} busy={submitting} onEdit={() => setEditing(true)} onCancel={() => void (async () => {
      if (!confirm('ยืนยันยกเลิกแผนเก็บเกี่ยวนี้?')) return;
      setSubmitting(true); const err = await cancel(existing.id); setSubmitting(false); if (err) setError(err);
    })()} />;
  }

  async function onSave() {
    setError(null);
    if (!dateFrom || !dateTo) return setError('กรุณาระบุช่วงวันที่คาดว่าจะเก็บเกี่ยว');
    if (!estimatedTonnage || Number(estimatedTonnage) <= 0) return setError('กรุณาระบุปริมาณคาดการณ์ (ตัน)');
    setSubmitting(true);
    const payload = {
      id: existing?.id,
      planting_cycle_id: cycleId,
      expected_date_from: dateFrom,
      expected_date_to: dateTo,
      estimated_tonnage: Number(estimatedTonnage),
      estimated_moisture: estimatedMoisture ? Number(estimatedMoisture) : undefined,
      requires_dryer: requiresDryer,
      note: note.trim() || undefined,
    };
    const err = existing ? await update(payload) : await submit(payload);
    setSubmitting(false);
    if (err) setError(err); else { setEditing(false); onSuccess?.(); }
  }

  return <div className="kaona-card">
    <p style={{ margin: '0 0 12px', fontWeight: 700 }}>{existing ? 'แก้ไขแผนเก็บเกี่ยว' : 'แจ้งแผนเก็บเกี่ยว'}</p>
    <label className="reg-label">วันที่คาดเริ่ม<input className="reg-input" type="date" min={today} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
    <label className="reg-label">วันที่คาดสิ้นสุด<input className="reg-input" type="date" min={dateFrom || today} value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
    <label className="reg-label">ปริมาณคาดการณ์ (ตัน)<input className="reg-input" type="number" min="0" step="0.1" value={estimatedTonnage} onChange={(e) => setEstimatedTonnage(e.target.value)} /></label>
    <label className="reg-label">ความชื้นคาดการณ์ (%)<input className="reg-input" type="number" min="0" max="100" step="0.1" value={estimatedMoisture} onChange={(e) => setEstimatedMoisture(e.target.value)} /></label>
    <label className="reg-label"><input type="checkbox" checked={requiresDryer} onChange={(e) => setRequiresDryer(e.target.checked)} /> ต้องการอบ</label>
    <label className="reg-label">หมายเหตุ<textarea className="reg-input reg-textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
    {error && <div style={{ color: '#856404', fontSize: 13 }}>⚠️ {error}</div>}
    <UIButton fullWidth type="button" onClick={() => void onSave()} disabled={submitting}>{submitting ? 'กำลังบันทึก…' : (existing ? 'บันทึกการแก้ไข' : 'บันทึกแผนเก็บเกี่ยว')}</UIButton>
  </div>;
}

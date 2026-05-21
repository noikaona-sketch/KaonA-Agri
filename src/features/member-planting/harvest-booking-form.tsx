'use client';

import { useState } from 'react';
import { UIButton } from '@/shared/components/ui-button';

type Props = {
  cycleId: string;
  memberId: string;
  plotId?: string | null;
  expectedHarvestAt?: string | null;
  cropName: string;
  estimatedYieldKg?: number | null;
  onDone: (bookingId: string) => void;
  onCancel: () => void;
};

export function HarvestBookingForm({ cycleId, memberId, plotId, expectedHarvestAt, cropName, estimatedYieldKg, onDone, onCancel }: Props) {
  const suggestedDate = expectedHarvestAt ? expectedHarvestAt.slice(0, 10) : '';
  const [date, setDate]   = useState(suggestedDate);
  const [time, setTime]   = useState('08:00');
  const [note, setNote]   = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function submit() {
    if (!date) { setError('กรุณาเลือกวันนัด'); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/member/harvest-bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planting_cycle_id: cycleId,
        member_id: memberId,
        expected_date_from: date,
        expected_date_to: date,
        estimated_tonnage: estimatedYieldKg ? Number((estimatedYieldKg/1000).toFixed(2)) : undefined,
        estimated_moisture: undefined,
        requires_dryer: false,
        note: note || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string; booking_id?: string };
    setSaving(false);
    if (!res.ok) { setError(d.error ?? 'นัดไม่สำเร็จ'); return; }
    onDone(d.booking_id ?? '');
  }

  return (
    <div className="mobile-stack">
      <div className="kaona-card" style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>นัดรถเกี่ยว</p>
        <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>🚜 {cropName}</p>
        {estimatedYieldKg && <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.85 }}>คาดผลผลิต {estimatedYieldKg.toLocaleString()} กก.</p>}
      </div>

      {suggestedDate && (
        <div style={{ background: '#e8f5e9', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#2e7d32', fontWeight: 600 }}>
          📅 วันเก็บเกี่ยวที่คาด: {new Date(suggestedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      )}

      {error && <div style={{ background: '#ffebee', borderRadius: 12, padding: '10px 14px', color: '#c62828', fontWeight: 600 }}>⚠️ {error}</div>}

      <label className="reg-label">วันที่นัดรถเกี่ยว <span className="reg-required">*</span>
        <input className="reg-input" type="date" value={date} onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().slice(0, 10)} />
      </label>
      <label className="reg-label">เวลาที่ต้องการ
        <input className="reg-input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <label className="reg-label">หมายเหตุ / ข้อมูลเพิ่มเติม
        <textarea className="reg-input reg-textarea" rows={2} value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="เส้นทาง, เบอร์ติดต่อ..." />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <UIButton variant="ghost" onClick={onCancel}>ยกเลิก</UIButton>
        <UIButton onClick={submit} loading={saving} disabled={!date || saving}>🚜 ยืนยันนัด</UIButton>
      </div>
    </div>
  );
}

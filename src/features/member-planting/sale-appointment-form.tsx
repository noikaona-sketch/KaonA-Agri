'use client';

import { useEffect, useState } from 'react';
import { UIButton } from '@/shared/components/ui-button';

type Props = {
  cycleId: string;
  memberId: string;
  cropName: string;
  estimatedYieldKg?: number | null;
  quotaKg?: number | null;
  onDone: (apptNo: string, pricePerKg: number) => void;
  onCancel: () => void;
};

type LatestPrice = { crop_type: string; price_per_kg: number; effective_date: string };

export function SaleAppointmentForm({ cycleId, memberId, cropName, estimatedYieldKg, quotaKg, onDone, onCancel }: Props) {
  const [date, setDate]       = useState('');
  const [qty, setQty]         = useState(String(Math.round((estimatedYieldKg ?? 0) * 1000)));
  const [note, setNote]       = useState('');
  const [prices, setPrices]   = useState<LatestPrice[]>([]);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/member/sale-appointment?cycle_id=${cycleId}`)
      .then((r) => r.json())
      .then((d: { latest_prices?: LatestPrice[] }) => setPrices(d.latest_prices ?? []));
  }, [cycleId]);

  const latestPrice = prices.find((p) =>
    cropName.includes(p.crop_type) || p.crop_type.includes('ข้าวโพด')
  );
  const pricePerKg  = latestPrice?.price_per_kg ?? 0;
  const qtyKg       = Number(qty) || 0;
  const totalBaht   = qtyKg * pricePerKg;

  async function submit() {
    if (!date || !qty) { setError('กรุณากรอกวันนัดและปริมาณ'); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/member/sale-appointment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planting_cycle_id: cycleId,
        member_id: memberId,
        scheduled_date: date,
        estimated_qty_kg: qtyKg,
        note: note || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string; appointment_number?: string; price_per_kg?: number };
    setSaving(false);
    if (!res.ok) { setError(d.error ?? 'นัดไม่สำเร็จ'); return; }
    onDone(d.appointment_number ?? '', d.price_per_kg ?? pricePerKg);
  }

  return (
    <div className="mobile-stack">
      <div className="kaona-card" style={{ background: 'linear-gradient(135deg,#1565c0,#1976d2)', color: '#fff' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>นัดวันขายผลผลิต</p>
        <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>🌽 {cropName}</p>
      </div>

      {/* ราคาล่าสุด */}
      {latestPrice && (
        <div style={{ background: '#e8f5e9', border: '1.5px solid #a5d6a7', borderRadius: 14, padding: '12px 16px' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#4a6741', fontWeight: 700 }}>💰 ราคารับซื้อล่าสุด</p>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900, color: '#1b5e20' }}>
            {pricePerKg.toFixed(2)} <span style={{ fontSize: 14, fontWeight: 600 }}>บาท/กก.</span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
            อัปเดต {new Date(latestPrice.effective_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>
      )}

      {/* โควต้า */}
      {quotaKg && (
        <div style={{ background: '#fff8e1', border: '1.5px solid #ffe082', borderRadius: 14, padding: '12px 16px', display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: '#e65100', fontWeight: 700 }}>📋 โควต้าที่ได้รับ</p>
            <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900, color: '#bf360c' }}>{quotaKg.toLocaleString()} กก.</p>
          </div>
          {estimatedYieldKg && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>คาดผลผลิต</p>
              <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 700, color: '#4a6741' }}>{(estimatedYieldKg * 1000).toLocaleString()} กก.</p>
            </div>
          )}
        </div>
      )}

      {error && <div style={{ background: '#ffebee', borderRadius: 12, padding: '10px 14px', color: '#c62828', fontWeight: 600 }}>⚠️ {error}</div>}

      <label className="reg-label">วันที่นัดขาย <span className="reg-required">*</span>
        <input className="reg-input" type="date" value={date} onChange={(e) => setDate(e.target.value)}
          min={new Date().toISOString().slice(0, 10)} />
      </label>
      <label className="reg-label">ปริมาณที่ต้องการขาย (กก.) <span className="reg-required">*</span>
        <input className="reg-input" type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
      </label>

      {/* คำนวณเงินประมาณ */}
      {qtyKg > 0 && pricePerKg > 0 && (
        <div style={{ background: '#f3e5f5', borderRadius: 14, padding: '12px 16px' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#7b1fa2', fontWeight: 700 }}>💵 ประมาณเงินที่จะได้รับ</p>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontWeight: 900, color: '#4a148c' }}>
            {totalBaht.toLocaleString('th-TH', { minimumFractionDigits: 2 })} <span style={{ fontSize: 14 }}>บาท</span>
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9c27b0' }}>
            {qtyKg.toLocaleString()} กก. × {pricePerKg.toFixed(2)} บาท/กก.
          </p>
        </div>
      )}

      <label className="reg-label">หมายเหตุ
        <textarea className="reg-input reg-textarea" rows={2} value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="ข้อมูลเพิ่มเติม..." />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <UIButton variant="ghost" onClick={onCancel}>ยกเลิก</UIButton>
        <UIButton onClick={submit} loading={saving} disabled={!date || !qty || saving}>🌽 ยืนยันนัดขาย</UIButton>
      </div>
    </div>
  );
}

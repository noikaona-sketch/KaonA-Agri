'use client';

import { useEffect, useState } from 'react';
import { UIButton } from '@/shared/components/ui-button';

type Booking = {
  id: string;
  expected_date_from: string;
  expected_date_to: string;
  estimated_tonnage: number;
  estimated_moisture: number | null;
  requires_dryer: boolean;
  note: string | null;
  status: string;
};

export function MemberHarvestBookingsPage() {
  const [form, setForm] = useState({ expected_date_from: '', expected_date_to: '', estimated_tonnage: '', estimated_moisture: '', requires_dryer: false, note: '' });
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/member/harvest-bookings');
    const json = await res.json();
    setBookings(json.bookings ?? []);
  }
  useEffect(() => { void load(); }, []);

  async function submit() {
    setLoading(true); setError(null);
    const res = await fetch('/api/member/harvest-bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      expected_date_from: form.expected_date_from,
      expected_date_to: form.expected_date_to,
      estimated_tonnage: Number(form.estimated_tonnage),
      estimated_moisture: form.estimated_moisture ? Number(form.estimated_moisture) : null,
      requires_dryer: form.requires_dryer,
      note: form.note || null,
    }) });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? 'บันทึกไม่สำเร็จ'); return; }
    setForm({ expected_date_from: '', expected_date_to: '', estimated_tonnage: '', estimated_moisture: '', requires_dryer: false, note: '' });
    await load();
  }

  return <div className="mobile-stack" style={{ maxWidth: 560, margin: '0 auto', padding: 12 }}>
    <div className="kaona-card">
      <p style={{ margin: '0 0 10px', fontWeight: 700 }}>แจ้งแผนเก็บเกี่ยว</p>
      <label className="reg-label">คาดว่าจะเก็บเกี่ยวตั้งแต่<input className="reg-input" type="date" value={form.expected_date_from} onChange={(e) => setForm({ ...form, expected_date_from: e.target.value })} /></label>
      <label className="reg-label">ถึงวันที่<input className="reg-input" type="date" value={form.expected_date_to} onChange={(e) => setForm({ ...form, expected_date_to: e.target.value })} /></label>
      <label className="reg-label">ปริมาณโดยประมาณ (ตัน)<input className="reg-input" type="number" step="0.01" value={form.estimated_tonnage} onChange={(e) => setForm({ ...form, estimated_tonnage: e.target.value })} /></label>
      <label className="reg-label">ความชื้นโดยประมาณ (ไม่บังคับ)<input className="reg-input" type="number" step="0.1" value={form.estimated_moisture} onChange={(e) => setForm({ ...form, estimated_moisture: e.target.value })} /></label>
      <label className="reg-label" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" checked={form.requires_dryer} onChange={(e) => setForm({ ...form, requires_dryer: e.target.checked })} /> ต้องการเครื่องอบ</label>
      <label className="reg-label">หมายเหตุ<textarea className="reg-input reg-textarea" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}
      <UIButton onClick={() => void submit()} loading={loading} disabled={loading}>บันทึก</UIButton>
    </div>

    <div className="mobile-stack">
      {bookings.map((b) => <div key={b.id} className="kaona-card">
        <p style={{ margin: 0, fontWeight: 700 }}>{b.expected_date_from} - {b.expected_date_to}</p>
        <p style={{ margin: '6px 0 0', fontSize: 13 }}>ประมาณ {b.estimated_tonnage} ตัน · สถานะ {b.status}</p>
        <p style={{ margin: '6px 0 0', fontSize: 13 }}>เครื่องอบ: {b.requires_dryer ? 'ต้องการ' : 'ไม่ต้องการ'} · ความชื้น: {b.estimated_moisture ?? '-'}%</p>
        {b.note && <p style={{ margin: '6px 0 0', fontSize: 13 }}>{b.note}</p>}
      </div>)}
    </div>
  </div>;
}

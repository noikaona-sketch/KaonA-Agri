'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';

type Location = { id: string; name: string; address: string | null };
type Slot = {
  id: string; pickup_date: string; pickup_time: string;
  capacity_qty: number; booked_qty: number; status: string; note: string | null;
  pickup_locations: Location[] | null;
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  open:      { label: 'เปิดจอง', color: '#2e7d32', bg: '#e8f5e9' },
  full:      { label: 'เต็ม',    color: '#c62828', bg: '#ffebee' },
  closed:    { label: 'ปิด',     color: '#9e9e9e', bg: '#f5f5f5' },
  cancelled: { label: 'ยกเลิก', color: '#9e9e9e', bg: '#f5f5f5' },
};

export function AdminPickupSlots() {
  const [slots, setSlots]       = useState<Slot[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [notice, setNotice]     = useState<string | null>(null);
  const [form, setForm] = useState({
    location_id: '', pickup_date: '', pickup_time: '09:00-12:00',
    capacity_qty: '200', note: '',
  });

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/pickup-slots');
    const d = (await res.json()) as { slots: Slot[]; locations: Location[] };
    setSlots(d.slots ?? []);
    setLocations(d.locations ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!form.location_id || !form.pickup_date) { setNotice('❌ กรุณากรอกข้อมูลให้ครบ'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/pickup-slots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_id: form.location_id, pickup_date: form.pickup_date, pickup_time: form.pickup_time, capacity_qty: Number(form.capacity_qty), note: form.note || null }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ เพิ่มรอบรับสินค้าแล้ว');
    setShowForm(false);
    setForm({ location_id: '', pickup_date: '', pickup_time: '09:00-12:00', capacity_qty: '200', note: '' });
    await load();
  }

  async function toggleStatus(slot: Slot) {
    await fetch('/api/admin/pickup-slots', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: slot.id, action: slot.status === 'open' ? 'close' : 'open' }),
    });
    await load();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>{notice}</div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>รอบรับสินค้า {slots.filter((s) => s.status === 'open').length} รอบที่เปิดอยู่</p>
        <button className="admin-btn admin-btn--primary" onClick={() => setShowForm(!showForm)}>+ เพิ่มรอบ</button>
      </div>

      {/* add form */}
      {showForm && (
        <div className="kaona-card" style={{ marginBottom: 16 }}>
          <p style={{ margin: '0 0 12px', fontWeight: 700 }}>เพิ่มรอบรับสินค้าใหม่</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="reg-label" style={{ gridColumn: '1/-1' }}>จุดรับสินค้า <span className="reg-required">*</span>
              <select className="reg-input" value={form.location_id} onChange={(e) => setForm((p) => ({ ...p, location_id: e.target.value }))}>
                <option value="">เลือกจุดรับ</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </label>
            <label className="reg-label">วันที่ <span className="reg-required">*</span>
              <input className="reg-input" type="date" value={form.pickup_date} onChange={(e) => setForm((p) => ({ ...p, pickup_date: e.target.value }))} min={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="reg-label">เวลา
              <input className="reg-input" value={form.pickup_time} onChange={(e) => setForm((p) => ({ ...p, pickup_time: e.target.value }))} placeholder="09:00-12:00" />
            </label>
            <label className="reg-label">รับได้สูงสุด (ถุง)
              <input className="reg-input" type="number" value={form.capacity_qty} onChange={(e) => setForm((p) => ({ ...p, capacity_qty: e.target.value }))} />
            </label>
            <label className="reg-label">หมายเหตุ
              <input className="reg-input" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} placeholder="ข้อมูลเพิ่มเติม" />
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="admin-btn admin-btn--secondary" onClick={() => setShowForm(false)}>ยกเลิก</button>
            <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก…' : '✅ บันทึก'}</button>
          </div>
        </div>
      )}

      {/* slot list */}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>วันที่</th><th>เวลา</th><th>จุดรับ</th><th>จอง/รับได้</th><th>สถานะ</th><th>จัดการ</th></tr>
          </thead>
          <tbody>
            {slots.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ยังไม่มีรอบรับสินค้า</td></tr>}
            {slots.map((slot) => {
              const st  = STATUS_CFG[slot.status] ?? STATUS_CFG.closed;
              const locRaw = slot.pickup_locations;
              const loc = Array.isArray(locRaw) ? locRaw[0] : locRaw;
              const pct = slot.capacity_qty > 0 ? Math.round((slot.booked_qty / slot.capacity_qty) * 100) : 0;
              return (
                <tr key={slot.id}>
                  <td style={{ fontWeight: 700 }}>{new Date(slot.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{slot.pickup_time}</td>
                  <td>
                    <p style={{ margin: 0, fontWeight: 600 }}>{loc?.name ?? '—'}</p>
                    {loc?.address && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{loc.address}</p>}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: '#e0e0e0', borderRadius: 3, minWidth: 60 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#c62828' : '#2e7d32', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{slot.booked_qty}/{slot.capacity_qty}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                  </td>
                  <td>
                    {['open','closed'].includes(slot.status) && (
                      <button className="admin-btn admin-btn--secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => toggleStatus(slot)}>
                        {slot.status === 'open' ? '🔒 ปิดรอบ' : '🔓 เปิดรอบ'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

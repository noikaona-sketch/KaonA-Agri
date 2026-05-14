'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';

type Price = { id: string; crop_type: string; price_per_kg: number; effective_date: string; note: string | null; is_active: boolean };

export function AdminMarketPrice() {
  const [prices,  setPrices]  = useState<Price[]>([]);
  const [loading, setLoading] = useState(true);
  const [cropType, setCropType] = useState('ข้าวโพด');
  const [price,    setPrice]    = useState('');
  const [note,     setNote]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [notice,   setNotice]   = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/market-price');
    const d = (await res.json()) as { prices?: Price[] };
    setPrices(d.prices ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!price) { setNotice('❌ กรุณากรอกราคา'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/market-price', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop_type: cropType, price_per_kg: Number(price), note: note || null }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice(`✅ อัปเดตราคา ${cropType} = ${price} บาท/กก.`);
    setPrice(''); setNote(''); await load();
  }

  const active = prices.filter((p) => p.is_active);

  return (
    <div>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>{notice}</div>
      )}

      {/* ราคาปัจจุบัน */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 20 }}>
        {active.map((p) => (
          <div key={p.id} style={{ background: '#e8f5e9', border: '1.5px solid #a5d6a7', borderRadius: 14, padding: '14px 16px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 12, color: '#4a6741', fontWeight: 700 }}>{p.crop_type}</p>
            <p style={{ margin: '4px 0', fontSize: 28, fontWeight: 900, color: '#1b5e20' }}>{p.price_per_kg.toFixed(2)}</p>
            <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>บาท/กก.</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
              {new Date(p.effective_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        ))}
      </div>

      {/* form ตั้งราคาใหม่ */}
      <div className="kaona-card">
        <p style={{ margin: '0 0 14px', fontWeight: 700 }}>💰 อัปเดตราคารับซื้อ</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label">ประเภทพืช
            <select className="reg-input" value={cropType} onChange={(e) => setCropType(e.target.value)}>
              <option>ข้าวโพด</option>
              <option>ข้าว</option>
              <option>มันสำปะหลัง</option>
              <option>อื่นๆ</option>
            </select>
          </label>
          <label className="reg-label">ราคา (บาท/กก.) <span className="reg-required">*</span>
            <input className="reg-input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="8.50" />
          </label>
          <label className="reg-label" style={{ gridColumn: '1/-1' }}>หมายเหตุ
            <input className="reg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="ราคา spot วันนี้ / ตลาดกลาง..." />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : '💰 อัปเดตราคา'}
          </button>
        </div>
      </div>

      {/* ประวัติราคา */}
      {!loading && (
        <div style={{ marginTop: 20 }}>
          <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14 }}>ประวัติราคา</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>ประเภท</th><th>ราคา</th><th>วันที่</th><th>หมายเหตุ</th><th>สถานะ</th></tr></thead>
              <tbody>
                {prices.slice(0, 20).map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.crop_type}</td>
                    <td style={{ fontWeight: 800, color: '#1b5e20' }}>{p.price_per_kg.toFixed(2)} บาท</td>
                    <td>{new Date(p.effective_date).toLocaleDateString('th-TH')}</td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{p.note ?? '—'}</td>
                    <td>{p.is_active ? <span style={{ color: '#2e7d32', fontWeight: 700 }}>✅ ใช้อยู่</span> : <span style={{ color: '#9ca3af' }}>เก่า</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

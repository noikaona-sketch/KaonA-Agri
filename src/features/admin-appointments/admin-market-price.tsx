'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';

type Price = {
  id: string; crop_type: string; price_per_kg: number;
  moisture_pct: number | null; price_type: string;
  effective_date: string; note: string | null; is_active: boolean;
};

export function AdminMarketPrice() {
  const [prices,   setPrices]   = useState<Price[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [cropType, setCropType] = useState('ข้าวโพด');
  const [price,    setPrice]    = useState('');
  const [moisture, setMoisture] = useState('');
  const [priceType,setPriceType]= useState('market');
  const [note,     setNote]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [notice,   setNotice]   = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/market-price', { credentials: 'include' });
    const d = (await res.json()) as { prices?: Price[] };
    setPrices(d.prices ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  async function save() {
    if (!price || !moisture) { setNotice('❌ กรุณากรอกราคาและความชื้น'); return; }
    const m = Number(moisture);
    if (m < 1 || m > 50) { setNotice('❌ ความชื้นต้องอยู่ระหว่าง 1–50%'); return; }
    setSaving(true);
    const res = await fetch('/api/admin/market-price', { credentials: 'include', 
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crop_type: cropType, price_per_kg: Number(price), moisture_pct: m, price_type: priceType, note: note || null }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice(`✅ บันทึกราคา ${cropType} ความชื้น ${moisture}% = ${price} บาท/กก.`);
    setPrice(''); setMoisture(''); setNote('');
    await load();
  }

  // เรียงราคา active ตาม moisture สูง → ต่ำ
  const table = prices
    .filter((p) => p.is_active && p.crop_type === cropType && p.moisture_pct !== null)
    .sort((a, b) => (b.moisture_pct ?? 0) - (a.moisture_pct ?? 0));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828', display: 'flex', justifyContent: 'space-between' }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* ตารางราคาตามความชื้น */}
      <div className="kaona-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>📋 ตารางราคาตามความชื้น</p>
          <select className="admin-select" value={cropType} onChange={(e) => setCropType(e.target.value)} style={{ width: 'auto', fontSize: 13 }}>
            <option>ข้าวโพด</option><option>ข้าว</option><option>มันสำปะหลัง</option>
          </select>
        </div>
        {loading ? <LoadingState label="กำลังโหลด…" /> : table.length === 0 ? (
          <p style={{ margin: 0, color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>ยังไม่มีราคาในตาราง — กรอกด้านล่างเพื่อเพิ่ม</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr><th>ความชื้น (%)</th><th>ราคา (บาท/กก.)</th><th>ประเภท</th><th>วันที่ตั้ง</th><th>หมายเหตุ</th></tr>
            </thead>
            <tbody>
              {table.map((r) => (
                <tr key={r.id}>
                  <td><span style={{ fontWeight: 700, fontSize: 16, color: '#1b5e20' }}>{r.moisture_pct}%</span></td>
                  <td><span style={{ fontWeight: 900, fontSize: 18, color: '#111' }}>{Number(r.price_per_kg).toFixed(2)}</span><span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 4 }}>บ./กก.</span></td>
                  <td><span style={{ fontSize: 12, color: '#6b7280' }}>{r.price_type === 'member' ? '🏅 สมาชิก' : '📢 ประกาศ'}</span></td>
                  <td style={{ fontSize: 12, color: '#9ca3af' }}>{new Date(r.effective_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</td>
                  <td style={{ fontSize: 12, color: '#9ca3af' }}>{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Form เพิ่ม/อัปเดตราคา */}
      <div className="kaona-card">
        <p style={{ margin: '0 0 14px', fontWeight: 700 }}>💰 เพิ่ม / อัปเดตราคา</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label">ความชื้น (%) <span className="reg-required">*</span>
            <input className="reg-input" type="number" step="0.1" min="1" max="50"
              value={moisture} onChange={(e) => setMoisture(e.target.value)} placeholder="เช่น 28, 22, 14" />
            <span className="reg-hint">กรอกตัวเลขความชื้นได้อิสระ</span>
          </label>
          <label className="reg-label">ราคา (บาท/กก.) <span className="reg-required">*</span>
            <input className="reg-input" type="number" step="0.01" min="0"
              value={price} onChange={(e) => setPrice(e.target.value)} placeholder="เช่น 4.50" />
          </label>
          <label className="reg-label">ประเภทราคา
            <select className="reg-input" value={priceType} onChange={(e) => setPriceType(e.target.value)}>
              <option value="market">📢 ราคาประกาศ (ตลาด)</option>
              <option value="member">🏅 ราคาสมาชิก KaonA</option>
            </select>
          </label>
          <label className="reg-label">หมายเหตุ
            <input className="reg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ราคา spot วันนี้" />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : '💰 บันทึกราคา'}
          </button>
        </div>
      </div>
    </div>
  );
}

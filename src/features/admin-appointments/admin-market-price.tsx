'use client';

import { useEffect, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';

type Price = {
  id: string; crop_type: string; price_per_kg: number;
  moisture_pct: number | null; price_type: string;
  effective_date: string; note: string | null; is_active: boolean;
};

const MOISTURE_OPTIONS = [
  { value: '', label: 'ไม่ระบุ' },
  { value: '30.0', label: 'ความชื้น 30% (สด)' },
  { value: '14.5', label: 'ความชื้น 14.5% (แห้ง)' },
];

export function AdminMarketPrice() {
  const [prices,     setPrices]     = useState<Price[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [cropType,   setCropType]   = useState('ข้าวโพด');
  const [price,      setPrice]      = useState('');
  const [moisturePct,setMoisturePct]= useState('');
  const [priceType,  setPriceType]  = useState('market');
  const [note,       setNote]       = useState('');
  const [saving,     setSaving]     = useState(false);
  const [notice,     setNotice]     = useState<string | null>(null);

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
      body: JSON.stringify({
        crop_type:    cropType,
        price_per_kg: Number(price),
        moisture_pct: moisturePct ? Number(moisturePct) : null,
        price_type:   priceType,
        note:         note || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    const moistureLabel = moisturePct ? ` ความชื้น ${moisturePct}%` : '';
    const typeLabel = priceType === 'member' ? ' (ราคาสมาชิก)' : ' (ราคาประกาศ)';
    setNotice(`✅ อัปเดตราคา ${cropType}${moistureLabel}${typeLabel} = ${price} บาท/กก.`);
    setPrice(''); setNote(''); await load();
  }

  const active = prices.filter((p) => p.is_active);
  // จัดกลุ่มตาม crop_type
  const grouped = active.reduce<Record<string, Price[]>>((acc, p) => {
    if (!acc[p.crop_type]) acc[p.crop_type] = [];
    acc[p.crop_type].push(p);
    return acc;
  }, {});

  return (
    <div>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
          {notice}
        </div>
      )}

      {/* ราคาปัจจุบัน */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {Object.entries(grouped).map(([crop, rows]) => (
          <div key={crop} style={{ background: '#e8f5e9', border: '1.5px solid #a5d6a7', borderRadius: 14, padding: '14px 16px', minWidth: 180 }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, color: '#4a6741', fontWeight: 700 }}>{crop}</p>
            {rows.map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  {r.moisture_pct !== null ? `${r.moisture_pct}%` : 'ทั่วไป'}
                  {r.price_type === 'member' && <span style={{ marginLeft: 4, fontSize: 10, background: '#fff', color: '#1b5e20', borderRadius: 4, padding: '0 4px' }}>สมาชิก</span>}
                </p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: '#1b5e20' }}>{Number(r.price_per_kg).toFixed(2)}<span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginLeft: 2 }}>บ./กก.</span></p>
              </div>
            ))}
            <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af' }}>
              {new Date(rows[0].effective_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
            </p>
          </div>
        ))}
      </div>

      {/* form */}
      <div className="kaona-card">
        <p style={{ margin: '0 0 14px', fontWeight: 700 }}>💰 อัปเดตราคารับซื้อ</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label">ประเภทพืช
            <select className="reg-input" value={cropType} onChange={(e) => setCropType(e.target.value)}>
              <option>ข้าวโพด</option><option>ข้าว</option><option>มันสำปะหลัง</option><option>อื่นๆ</option>
            </select>
          </label>
          <label className="reg-label">ราคา (บาท/กก.) <span className="reg-required">*</span>
            <input className="reg-input" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="8.50" />
          </label>
          <label className="reg-label">ความชื้น
            <select className="reg-input" value={moisturePct} onChange={(e) => setMoisturePct(e.target.value)}>
              {MOISTURE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="reg-label">ประเภทราคา
            <select className="reg-input" value={priceType} onChange={(e) => setPriceType(e.target.value)}>
              <option value="market">ราคาประกาศ (ตลาด)</option>
              <option value="member">ราคาสมาชิก KaonA</option>
            </select>
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
              <thead><tr><th>ประเภท</th><th>ความชื้น</th><th>ราคา</th><th>ประเภทราคา</th><th>วันที่</th><th>หมายเหตุ</th><th>สถานะ</th></tr></thead>
              <tbody>
                {prices.slice(0, 30).map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700 }}>{p.crop_type}</td>
                    <td style={{ color: '#6b7280' }}>{p.moisture_pct !== null ? `${p.moisture_pct}%` : '—'}</td>
                    <td style={{ fontWeight: 800, color: '#1b5e20' }}>{Number(p.price_per_kg).toFixed(2)} บาท/กก.</td>
                    <td style={{ fontSize: 13 }}>{p.price_type === 'member' ? '🏅 สมาชิก' : '📢 ประกาศ'}</td>
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

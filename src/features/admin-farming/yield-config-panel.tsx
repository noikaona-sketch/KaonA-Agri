'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type YieldConfig = {
  id: string; crop_type: string; seed_to_yield_ratio: number;
  yield_per_rai: number; quota_per_seed_kg: number; note: string | null;
  standard_cost_per_rai_burn: number | null;
  standard_cost_per_rai_no_burn: number | null;
  standard_price_per_kg: number | null;
};

type MarketPrice = {
  id: string; crop_type: string; price_per_kg: number;
  effective_date: string; note: string | null; is_active: boolean;
};

type EditingConfig = YieldConfig & { _price: string };

export function YieldConfigPanel() {
  const [configs, setConfigs]   = useState<YieldConfig[]>([]);
  const [prices, setPrices]     = useState<MarketPrice[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [editing, setEditing]   = useState<EditingConfig | null>(null);
  const [saving, setSaving]     = useState(false);
  const [notice, setNotice]     = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState({ crop_type: '', price_per_kg: '', note: '' });
  const [addingPrice, setAddingPrice] = useState(false);

  async function load() {
    const s = createSupabaseBrowserClient();
    const [c, p] = await Promise.all([
      s.from('crop_yield_config').select('*').order('crop_type'),
      s.from('market_prices').select('*').eq('is_active', true).order('crop_type').order('effective_date', { ascending: false }),
    ]);
    if (c.error) { setError(c.error.message); } else {
      setConfigs((c.data as YieldConfig[]) ?? []);
      setPrices((p.data as MarketPrice[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function saveConfig() {
    if (!editing) return;
    setSaving(true); setNotice(null);
    const s = createSupabaseBrowserClient();
    await s.from('crop_yield_config').upsert({
      id: editing.id, crop_type: editing.crop_type,
      seed_to_yield_ratio: Number(editing.seed_to_yield_ratio),
      yield_per_rai: Number(editing.yield_per_rai),
      quota_per_seed_kg: Number(editing.quota_per_seed_kg),
      note: editing.note,
      standard_cost_per_rai_burn:    editing.standard_cost_per_rai_burn    ? Number(editing.standard_cost_per_rai_burn)    : null,
      standard_cost_per_rai_no_burn: editing.standard_cost_per_rai_no_burn ? Number(editing.standard_cost_per_rai_no_burn) : null,
      standard_price_per_kg:         editing.standard_price_per_kg         ? Number(editing.standard_price_per_kg)         : null,
    });
    setSaving(false); setEditing(null);
    setNotice('✅ บันทึกค่า yield แล้ว');
    await load();
  }

  async function addMarketPrice() {
    if (!newPrice.crop_type || !newPrice.price_per_kg) return;
    setAddingPrice(true);
    const s = createSupabaseBrowserClient();
    // deactivate เดิม
    await s.from('market_prices').update({ is_active: false }).eq('crop_type', newPrice.crop_type).eq('is_active', true);
    await s.from('market_prices').insert({
      crop_type: newPrice.crop_type,
      price_per_kg: Number(newPrice.price_per_kg),
      effective_date: new Date().toISOString().slice(0, 10),
      note: newPrice.note || null,
    });
    setAddingPrice(false);
    setNewPrice({ crop_type: '', price_per_kg: '', note: '' });
    setNotice('✅ อัปเดตราคากลางแล้ว');
    await load();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error) return <ErrorState title="โหลดไม่สำเร็จ" detail={error} />;

  // latest price per crop
  const latestPrices: Record<string, number> = {};
  prices.forEach((p) => { if (!latestPrices[p.crop_type]) latestPrices[p.crop_type] = p.price_per_kg; });

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

      {/* Yield Config */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0d3d1f' }}>⚙️ ตั้งค่า Yield ต่อพืช</h2>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>กำหนดอัตราผลผลิตและโควต้าขาย — admin แก้ได้</p>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ชนิดพืช</th><th>ผลผลิต/ไร่</th>
                <th>ต้นทุน/ไร่ (เผา)</th><th>ต้นทุน/ไร่ (ไม่เผา)</th>
                <th>ราคามาตรฐาน</th><th></th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id}>
                  {editing?.id === c.id ? (
                    <>
                      <td style={{ fontWeight:700 }}>{c.crop_type}</td>
                      <td><input className="reg-input" type="number" value={editing.yield_per_rai} onChange={(e) => setEditing((p) => p ? { ...p, yield_per_rai: Number(e.target.value) } : p)} style={{ width:80 }} /></td>
                      <td><input className="reg-input" type="number" placeholder="เช่น 4500" value={editing.standard_cost_per_rai_burn ?? ''} onChange={(e) => setEditing((p) => p ? { ...p, standard_cost_per_rai_burn: e.target.value ? Number(e.target.value) : null } : p)} style={{ width:90 }} /></td>
                      <td><input className="reg-input" type="number" placeholder="เช่น 4200" value={editing.standard_cost_per_rai_no_burn ?? ''} onChange={(e) => setEditing((p) => p ? { ...p, standard_cost_per_rai_no_burn: e.target.value ? Number(e.target.value) : null } : p)} style={{ width:90 }} /></td>
                      <td><input className="reg-input" type="number" step="0.01" placeholder="เช่น 4.50" value={editing.standard_price_per_kg ?? ''} onChange={(e) => setEditing((p) => p ? { ...p, standard_price_per_kg: e.target.value ? Number(e.target.value) : null } : p)} style={{ width:80 }} /></td>
                      <td style={{ display:'flex', gap:4 }}>
                        <button className="admin-btn admin-btn--success" onClick={saveConfig} disabled={saving} style={{ fontSize:12, minHeight:30, padding:'4px 8px' }}>💾</button>
                        <button className="admin-btn admin-btn--secondary" onClick={() => setEditing(null)} style={{ fontSize:12, minHeight:30, padding:'4px 8px' }}>✕</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ fontWeight:700 }}>{c.crop_type}</td>
                      <td>{c.yield_per_rai.toLocaleString()} กก./ไร่</td>
                      <td style={{ color: c.standard_cost_per_rai_burn ? '#111' : '#9ca3af' }}>
                        {c.standard_cost_per_rai_burn ? `฿${c.standard_cost_per_rai_burn.toLocaleString()}` : 'ยังไม่ตั้ง'}
                      </td>
                      <td style={{ color: c.standard_cost_per_rai_no_burn ? '#27500A' : '#9ca3af' }}>
                        {c.standard_cost_per_rai_no_burn ? `฿${c.standard_cost_per_rai_no_burn.toLocaleString()}` : 'ยังไม่ตั้ง'}
                      </td>
                      <td style={{ fontWeight:700, color:'#1b5e20' }}>
                        {c.standard_price_per_kg ? `${c.standard_price_per_kg} บาท/กก.` : (latestPrices[c.crop_type] ? `${latestPrices[c.crop_type]} บาท/กก.` : '—')}
                      </td>
                      <td><button className="admin-btn admin-btn--ghost" onClick={() => setEditing({ ...c, _price:'' })} style={{ fontSize:12, minHeight:30, padding:'4px 8px' }}>✏️</button></td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ margin:'8px 0 0', fontSize:12, color:'#9ca3af' }}>
          💡 ต้นทุนและราคามาตรฐานใช้เป็น fallback เมื่อเกษตรกรไม่ได้กรอกต้นทุนเอง
        </p>
      </section>

      {/* Market Price */}
      <section>
        <h2 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0d3d1f' }}>💰 ราคากลาง (บาท/กก.)</h2>
        <div className="admin-table-wrap" style={{ marginBottom: 14 }}>
          <table className="admin-table">
            <thead><tr><th>พืช</th><th>ราคาปัจจุบัน</th><th>วันที่มีผล</th><th>หมายเหตุ</th></tr></thead>
            <tbody>
              {Object.entries(latestPrices).map(([crop, price]) => {
                const p = prices.find((x) => x.crop_type === crop);
                return (
                  <tr key={crop}>
                    <td style={{ fontWeight: 700 }}>{crop}</td>
                    <td style={{ fontSize: 18, fontWeight: 800, color: '#1b5e20' }}>{price} บาท/กก.</td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{p ? new Date(p.effective_date).toLocaleDateString('th-TH') : '—'}</td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{p?.note ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ background: '#f7faf7', border: '1px solid #e8ede8', borderRadius: 12, padding: 16, display: 'grid', gap: 10 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>ประกาศราคาใหม่</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <label className="reg-label" style={{ fontSize: 12 }}>ชนิดพืช
              <select className="reg-input" value={newPrice.crop_type} onChange={(e) => setNewPrice((p) => ({ ...p, crop_type: e.target.value }))}>
                <option value="">เลือก…</option>
                {configs.map((c) => <option key={c.crop_type} value={c.crop_type}>{c.crop_type}</option>)}
              </select>
            </label>
            <label className="reg-label" style={{ fontSize: 12 }}>ราคา (บาท/กก.)
              <input className="reg-input" type="number" step="0.1" value={newPrice.price_per_kg} onChange={(e) => setNewPrice((p) => ({ ...p, price_per_kg: e.target.value }))} placeholder="8.00" />
            </label>
            <label className="reg-label" style={{ fontSize: 12 }}>หมายเหตุ
              <input className="reg-input" value={newPrice.note} onChange={(e) => setNewPrice((p) => ({ ...p, note: e.target.value }))} placeholder="เหตุผล..." />
            </label>
            <button className="admin-btn admin-btn--primary" onClick={addMarketPrice} disabled={addingPrice || !newPrice.crop_type || !newPrice.price_per_kg} style={{ minHeight: 44 }}>
              {addingPrice ? '…' : '📢 ประกาศ'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type StockRow = {
  id: string; name: string; brand: string | null; category: string;
  unit: string; price_per_unit: number;
  stock_qty: number; min_stock_alert: number; is_low_stock: boolean;
  is_active: boolean; total_sold_qty: number; total_reserved_qty: number;
};

type AdjustModal = { product: StockRow; delta: string; type: 'in' | 'adjust'; note: string } | null;

const CAT_ICON: Record<string, string> = { seed: '🌾', fertilizer: '🧪', pesticide: '💊', equipment: '🔧', other: '📦' };

export function AdminStockList() {
  const [rows, setRows]       = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [adjust, setAdjust]   = useState<AdjustModal>(null);
  const [saving, setSaving]   = useState(false);
  const [notice, setNotice]   = useState<string | null>(null);
  const [showLowOnly, setShowLowOnly] = useState(false);

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const { data, error: err } = await s.from('admin_stock_status').select('*');
    if (err) setError(err.message);
    else setRows((data as StockRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function saveAdjust() {
    if (!adjust) return;
    setSaving(true);
    const s = createSupabaseBrowserClient();
    const delta = adjust.type === 'in' ? Number(adjust.delta) : Number(adjust.delta);
    const { error: err } = await s.rpc('adjust_product_stock', {
      p_product_id: adjust.product.id,
      p_delta: delta,
      p_movement_type: adjust.type,
      p_note: adjust.note || null,
    });
    setSaving(false);
    if (err) { setNotice(`❌ ${err.message}`); return; }
    setNotice(`✅ ปรับสต๊อก ${adjust.product.name} แล้ว`);
    setAdjust(null); await load();
  }

  const filtered = showLowOnly ? rows.filter((r) => r.is_low_stock) : rows;
  const lowCount = rows.filter((r) => r.is_low_stock && r.is_active).length;

  return (
    <div>
      {lowCount > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 16px', marginBottom: 14, fontSize: 14, fontWeight: 600, color: '#e65100', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ สต๊อกต่ำ {lowCount} รายการ</span>
          <button onClick={() => setShowLowOnly((v) => !v)} className="admin-btn admin-btn--secondary" style={{ fontSize: 12, minHeight: 30, padding: '4px 10px' }}>
            {showLowOnly ? 'ดูทั้งหมด' : 'ดูเฉพาะที่ต่ำ'}
          </button>
        </div>
      )}

      {notice && <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontWeight: 600, color: '#1b5e20' }}>{notice}</div>}

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>สินค้า</th><th>คงเหลือ</th><th>Min</th><th>จอง</th><th>ขายแล้ว</th><th>ราคา</th><th style={{ textAlign: 'center' }}>ปรับสต๊อก</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ background: r.is_low_stock ? '#fffde7' : undefined }}>
                  <td>
                    <p style={{ margin: 0, fontWeight: 700 }}>{CAT_ICON[r.category]} {r.name}</p>
                    {r.brand && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{r.brand}</p>}
                  </td>
                  <td>
                    <span className={`status-badge ${r.is_low_stock ? 'status-badge--pending' : 'status-badge--approved'}`} style={{ fontSize: 14, fontWeight: 800 }}>
                      {r.is_low_stock ? '⚠️' : ''} {r.stock_qty.toLocaleString()} {r.unit}
                    </span>
                  </td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>{r.min_stock_alert} {r.unit}</td>
                  <td style={{ color: '#e65100', fontSize: 13 }}>{r.total_reserved_qty > 0 ? `${r.total_reserved_qty} ${r.unit}` : '—'}</td>
                  <td style={{ color: '#6b7280', fontSize: 13 }}>{r.total_sold_qty > 0 ? `${r.total_sold_qty} ${r.unit}` : '—'}</td>
                  <td style={{ fontWeight: 600 }}>{r.price_per_unit.toLocaleString()} บาท/{r.unit}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      <button className="admin-btn admin-btn--success" style={{ fontSize: 12, minHeight: 30, padding: '4px 10px' }}
                        onClick={() => setAdjust({ product: r, delta: '', type: 'in', note: '' })}>
                        + รับสินค้า
                      </button>
                      <button className="admin-btn admin-btn--secondary" style={{ fontSize: 12, minHeight: 30, padding: '4px 10px' }}
                        onClick={() => setAdjust({ product: r, delta: '', type: 'adjust', note: '' })}>
                        ✏️ ปรับ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjust && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setAdjust(null)}>
          <div className="admin-modal" style={{ maxWidth: 380 }}>
            <div className="admin-modal__header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
                {adjust.type === 'in' ? '+ รับสินค้า' : '✏️ ปรับสต๊อก'} — {adjust.product.name}
              </h2>
              <button className="admin-modal__close" onClick={() => setAdjust(null)}>×</button>
            </div>
            <div className="admin-modal__body">
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>สต๊อกปัจจุบัน: <strong>{adjust.product.stock_qty} {adjust.product.unit}</strong></p>
              <label className="reg-label">
                {adjust.type === 'in' ? 'จำนวนที่รับเข้า' : 'สต๊อกใหม่ (ตั้งค่าตรง)'}
                <input className="reg-input" type="number" autoFocus value={adjust.delta}
                  onChange={(e) => setAdjust((p) => p ? { ...p, delta: e.target.value } : p)} placeholder="0" />
              </label>
              <label className="reg-label">หมายเหตุ
                <input className="reg-input" value={adjust.note}
                  onChange={(e) => setAdjust((p) => p ? { ...p, note: e.target.value } : p)} placeholder="เหตุผลการปรับ..." />
              </label>
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setAdjust(null)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" onClick={saveAdjust} disabled={saving || !adjust.delta}>
                {saving ? 'กำลังบันทึก…' : '💾 บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

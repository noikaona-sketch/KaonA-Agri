'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

import { ProductFormModal } from './product-form-modal';

type Product = {
  id: string; name: string; brand: string | null;
  category: string; unit: string; price_per_unit: number;
  stock_qty: number; min_stock_alert: number; is_low_stock: boolean;
  is_active: boolean; is_visible_to_members: boolean;
  crop_type: string | null; seed_variety: string | null;
  days_to_harvest: number | null;
  bag_weight_kg: number | null;
};

const CAT_ICON: Record<string, string> = { seed: '🌾', fertilizer: '🧪', pesticide: '💊', equipment: '🔧', other: '📦' };
const CAT_TH: Record<string, string>   = { seed: 'เมล็ดพันธุ์', fertilizer: 'ปุ๋ย', pesticide: 'ยา/สาร', equipment: 'อุปกรณ์', other: 'อื่นๆ' };

export function AdminProductsList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [editing, setEditing]   = useState<Product | null | 'new'>('new' as unknown as null);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const { data, error: err } = await s
      .from('products')
      .select('id,name,brand,category,unit,price_per_unit,stock_qty,min_stock_alert,is_low_stock,is_active,is_visible_to_members,crop_type,seed_variety,days_to_harvest,bag_weight_kg')
      .is('deleted_at', null)
      .order('sort_order').order('category').order('name')
      .limit(300);
    if (err) setError(err.message);
    else setProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function toggleActive(id: string, val: boolean) {
    const s = createSupabaseBrowserClient();
    await s.from('products').update({ is_active: val }).eq('id', id);
    await load();
  }

  const filtered = products.filter((p) =>
    (!catFilter || p.category === catFilter) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  const lowStockCount = products.filter((p) => p.is_low_stock && p.is_active).length;

  return (
    <div>
      {lowStockCount > 0 && (
        <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600, color: '#e65100' }}>
          ⚠️ สินค้า {lowStockCount} รายการมีสต๊อกต่ำกว่าเกณฑ์
        </div>
      )}

      <div className="admin-filter-bar">
        <input className="admin-search" placeholder="🔍  ค้นหาชื่อสินค้าหรือยี่ห้อ…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="admin-select" value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">ทุกหมวด</option>
          {Object.entries(CAT_TH).map(([k, v]) => <option key={k} value={k}>{CAT_ICON[k]} {v}</option>)}
        </select>
        <button className="admin-btn admin-btn--primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          ➕ เพิ่มสินค้า
        </button>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>{filtered.length} สินค้า</p>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>สินค้า</th><th>หมวด</th><th>ราคา/หน่วย</th><th>สต๊อก</th><th>พืช/พันธุ์</th><th>มือถือ</th><th>สถานะ</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ไม่พบสินค้า</td></tr>}
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td>
                    <p style={{ margin: 0, fontWeight: 700 }}>{p.name}</p>
                    {p.brand && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{p.brand}</p>}
                  </td>
                  <td><span style={{ fontSize: 13 }}>{CAT_ICON[p.category]} {CAT_TH[p.category]}</span></td>
                  <td style={{ fontWeight: 700, color: '#1b5e20' }}>{p.price_per_unit.toLocaleString()} /{p.unit}</td>
                  <td>
                    <span className={`status-badge ${p.is_low_stock ? 'status-badge--pending' : 'status-badge--approved'}`}>
                      {p.is_low_stock ? '⚠️' : '✅'} {p.stock_qty.toLocaleString()} {p.unit}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>
                    {p.crop_type ?? '—'} {p.seed_variety ? `(${p.seed_variety})` : ''}
                    {p.days_to_harvest ? <span style={{ display: 'block', fontSize: 11 }}>{p.days_to_harvest} วัน</span> : null}
                    {p.bag_weight_kg ? <span style={{ display: 'block', fontSize: 11 }}>น้ำหนักถุง {p.bag_weight_kg} กก.</span> : null}
                  </td>
                  <td style={{ textAlign: 'center' }}>{p.is_visible_to_members ? '👁️' : '—'}</td>
                  <td>
                    <button
                      onClick={() => toggleActive(p.id, !p.is_active)}
                      className={`status-badge ${p.is_active ? 'status-badge--approved' : 'status-badge--suspended'}`}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      {p.is_active ? '✅ เปิด' : '⛔ ปิด'}
                    </button>
                  </td>
                  <td>
                    <button className="admin-btn admin-btn--ghost" onClick={() => { setEditing(p as unknown as null); setShowForm(true); }}>
                      ✏️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <ProductFormModal
          product={editing as unknown as Record<string, unknown> | null}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); void load(); }}
        />
      )}
    </div>
  );
}

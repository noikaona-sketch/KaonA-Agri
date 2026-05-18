'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';

type Product = {
  id: string; name: string; brand: string | null;
  category: string; unit: string; price_per_unit: number;
  stock_qty: number; is_low_stock: boolean;
  crop_type: string | null; seed_variety: string | null;
  days_to_harvest: number | null; description: string | null;
  planting_guide: string | null; expiry_months: number | null;
};

type CartItem = { product: Product; qty: number };

const CAT_ICON: Record<string, string> = {
  seed: '🌾', fertilizer: '🧪', pesticide: '💊', equipment: '🔧', other: '📦',
};

type Props = { onCheckout: (items: CartItem[]) => void };

export function MemberShopCatalog({ onCheckout }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [cart, setCart]         = useState<CartItem[]>([]);
  const [detail, setDetail]     = useState<Product | null>(null);
  const [catFilter, setCatFilter] = useState('');

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('member_product_catalog').select('*');
      setProducts((data as Product[]) ?? []);
      setLoading(false);
    })();
  }, []);

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === p.id);
      if (existing) return prev.map((i) => i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== id));
  }

  const cartTotal = cart.reduce((s, i) => s + i.product.price_per_unit * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const filtered = products.filter((p) => !catFilter || p.category === catFilter);
  const categories = [...new Set(products.map((p) => p.category))];

  if (loading) return <LoadingState label="กำลังโหลดสินค้า…" />;

  // Detail modal
  if (detail) {
    const inCart = cart.find((i) => i.product.id === detail.id);
    return (
      <div className="mobile-stack">
        <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: 15, padding: 0, cursor: 'pointer', alignSelf: 'flex-start' }}>
          ← กลับ
        </button>

        <div style={{ background: 'linear-gradient(145deg, #e8f5e9, #fff)', borderRadius: 20, padding: 20, border: '1.5px solid #a5d6a7' }}>
          <div style={{ fontSize: 56, textAlign: 'center', marginBottom: 12 }}>{CAT_ICON[detail.category] ?? '📦'}</div>
          <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>{detail.name}</h2>
          {detail.brand && <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-secondary)' }}>{detail.brand}</p>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {detail.crop_type && <span style={{ padding: '4px 12px', borderRadius: 999, background: '#e8f5e9', color: 'var(--primary)', fontWeight: 600, fontSize: 13 }}>{detail.crop_type}</span>}
            {detail.seed_variety && <span style={{ padding: '4px 12px', borderRadius: 999, background: '#fff3e0', color: '#e65100', fontWeight: 600, fontSize: 13 }}>{detail.seed_variety}</span>}
            {detail.days_to_harvest && <span style={{ padding: '4px 12px', borderRadius: 999, background: '#e3f2fd', color: '#1565c0', fontWeight: 600, fontSize: 13 }}>เก็บเกี่ยว {detail.days_to_harvest} วัน</span>}
          </div>
          <p style={{ fontSize: 24, fontWeight: 900, color: 'var(--primary)', margin: '0 0 4px' }}>
            {detail.price_per_unit.toLocaleString()} บาท/{detail.unit}
          </p>
          <p style={{ fontSize: 13, color: detail.is_low_stock ? '#e65100' : 'var(--text-secondary)', margin: 0 }}>
            {detail.stock_qty <= 0 ? '❌ สินค้าหมด' : detail.is_low_stock ? `⚠️ เหลือน้อย: ${detail.stock_qty} ${detail.unit}` : `✅ มีสินค้า: ${detail.stock_qty} ${detail.unit}`}
          </p>
        </div>

        {detail.description && (
          <div className="kaona-card">
            <p style={{ margin: '0 0 6px', fontWeight: 700, fontSize: 14 }}>รายละเอียด</p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)' }}>{detail.description}</p>
          </div>
        )}

        {detail.planting_guide && (
          <div className="kaona-card" style={{ background: '#f1f8e9', borderColor: '#c5e1a5' }}>
            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>🌱 วิธีการปลูก</p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: '#2e5827' }}>{detail.planting_guide}</p>
          </div>
        )}

        {detail.expiry_months && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
            🗓️ อายุเมล็ดพันธุ์: {detail.expiry_months} เดือน
          </p>
        )}

        {detail.stock_qty > 0 && (
          <button onClick={() => { addToCart(detail); setDetail(null); }}
            style={{ background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 14, padding: '16px', width: '100%', fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>
            {inCart ? `🛒 เพิ่มอีก (มี ${inCart.qty} แล้ว)` : '🛒 เพิ่มลงตะกร้า'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mobile-stack">
      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        <button onClick={() => setCatFilter('')}
          style={{ padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: !catFilter ? 'var(--primary)' : '#f0f4f0', color: !catFilter ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          ทั้งหมด
        </button>
        {categories.map((c) => (
          <button key={c} onClick={() => setCatFilter(c)}
            style={{ padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: catFilter === c ? 'var(--primary)' : '#f0f4f0', color: catFilter === c ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {CAT_ICON[c]} {c === 'seed' ? 'เมล็ดพันธุ์' : c === 'fertilizer' ? 'ปุ๋ย' : c === 'pesticide' ? 'ยา' : c}
          </button>
        ))}
      </div>

      {/* Level 1 UX note — seed order allowed without plot */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        background: '#f0fdf4', border: '1px solid #86efac',
        borderRadius: 10, padding: '10px 14px',
      }}>
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>🌾</span>
        <p style={{ margin: 0, fontSize: 13, color: '#14532d', lineHeight: 1.6 }}>
          ยังไม่เพิ่มแปลงก็จองเมล็ดพันธุ์ได้
        </p>
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '32px 0' }}>ไม่มีสินค้า</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {filtered.map((p) => {
            const inCart = cart.find((i) => i.product.id === p.id);
            return (
              <div key={p.id} onClick={() => setDetail(p)}
                style={{ background: '#fff', border: `1.5px solid ${inCart ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 16, padding: 14, cursor: 'pointer', position: 'relative', transition: 'border-color 0.15s' }}>
                {inCart && (
                  <span style={{ position: 'absolute', top: 8, right: 8, background: 'var(--primary)', color: '#fff', borderRadius: 999, width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                    {inCart.qty}
                  </span>
                )}
                <div style={{ fontSize: 36, marginBottom: 8 }}>{CAT_ICON[p.category] ?? '📦'}</div>
                <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{p.name}</p>
                {p.brand && <p style={{ margin: '0 0 6px', fontSize: 12, color: 'var(--text-secondary)' }}>{p.brand}</p>}
                <p style={{ margin: '0 0 2px', fontWeight: 900, color: 'var(--primary)', fontSize: 16 }}>
                  {p.price_per_unit.toLocaleString()} <span style={{ fontSize: 12, fontWeight: 400 }}>บาท/{p.unit}</span>
                </p>
                <p style={{ margin: 0, fontSize: 11, color: p.stock_qty <= 0 ? '#c62828' : p.is_low_stock ? '#e65100' : '#9e9e9e' }}>
                  {p.stock_qty <= 0 ? '❌ หมด' : p.is_low_stock ? `⚠️ เหลือ ${p.stock_qty}` : `✅ ${p.stock_qty} ${p.unit}`}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Cart bar */}
      {cart.length > 0 && (
        <div style={{ position: 'sticky', bottom: 80, background: 'var(--primary)', borderRadius: 16, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 24px rgba(46,125,50,0.3)' }}>
          <div>
            <p style={{ margin: 0, color: '#fff', fontWeight: 700, fontSize: 14 }}>🛒 {cartCount} รายการ</p>
            <p style={{ margin: 0, color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>{cartTotal.toLocaleString()} บาท</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setCart([])} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>ล้าง</button>
            <button onClick={() => onCheckout(cart)} style={{ background: '#fff', color: 'var(--primary)', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>สั่งซื้อ →</button>
          </div>
        </div>
      )}
    </div>
  );
}

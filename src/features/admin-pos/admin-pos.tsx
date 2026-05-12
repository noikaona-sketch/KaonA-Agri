'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';

import type { CartItem } from './pos-cart';
import { PosCart } from './pos-cart';
import { PosMemberPicker } from './pos-member-picker';
import { PosReceipt } from './pos-receipt';

type Product = {
  id: string; name: string; brand: string | null;
  category: string; unit: string; price_per_unit: number;
  stock_qty: number; is_low_stock: boolean; is_active: boolean;
  crop_type: string | null; seed_variety: string | null;
};

const CAT_ICON: Record<string, string> = { seed: '🌾', fertilizer: '🧪', pesticide: '💊', equipment: '🔧', other: '📦' };
const CAT_TH: Record<string, string>   = { seed: 'เมล็ดพันธุ์', fertilizer: 'ปุ๋ย', pesticide: 'ยา/สาร', equipment: 'อุปกรณ์', other: 'อื่นๆ' };

type OrderResult = { order_id: string; order_number: string; total: number; subtotal: number; discount: number };

export function AdminPos() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch]     = useState('');
  const [cart, setCart]         = useState<CartItem[]>([]);
  const [member, setMember]     = useState<{ id: string; full_name: string } | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [orderType, setOrderType] = useState<'sale' | 'reservation'>('sale');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discount, setDiscount] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice]     = useState<string | null>(null);
  const [receipt, setReceipt]   = useState<(OrderResult & { member: typeof member; items: CartItem[]; paymentMethod: string }) | null>(null);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data, error: err } = await s
        .from('products')
        .select('id,name,brand,category,unit,price_per_unit,stock_qty,is_low_stock,is_active,crop_type,seed_variety')
        .is('deleted_at', null).eq('is_active', true)
        .order('sort_order').order('name');
      if (err) setError(err.message);
      else setProducts((data as Product[]) ?? []);
      setLoading(false);
    })();
  }, []);

  function addToCart(product: Product) {
    if (product.stock_qty <= 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      if (existing) return prev.map((i) => i.product_id === product.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { product_id: product.id, product_name: product.name, unit: product.unit, qty: 1, unit_price: product.price_per_unit }];
    });
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) { setCart((prev) => prev.filter((i) => i.product_id !== productId)); return; }
    setCart((prev) => prev.map((i) => i.product_id === productId ? { ...i, qty } : i));
  }

  async function handleSubmit() {
    if (!member || cart.length === 0) return;
    setSubmitting(true); setNotice(null);
    const s = createSupabaseBrowserClient();
    const items = cart.map((i) => ({ product_id: i.product_id, qty: i.qty, unit_price: i.unit_price }));
    const { data, error: err } = await s.rpc('create_sale_order', {
      p_member_id: member.id,
      p_order_type: orderType,
      p_items: items,
      p_payment_method: paymentMethod,
      p_paid_amount: orderType === 'sale' ? cart.reduce((s, i) => s + i.qty * i.unit_price, 0) - (Number(discount) || 0) : 0,
      p_discount: Number(discount) || 0,
      p_pickup_date: pickupDate || null,
    });
    setSubmitting(false);
    if (err) { setNotice(`❌ ${err.message}`); return; }
    const result = data as OrderResult;
    setReceipt({ ...result, member, items: [...cart], paymentMethod });
    setCart([]); setDiscount(''); setPickupDate('');
  }

  const filteredProducts = products.filter((p) =>
    (!catFilter || p.category === catFilter) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.brand ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  if (receipt) {
    return <PosReceipt receipt={receipt} onNew={() => setReceipt(null)} />;
  }

  if (error) return <ErrorState title="โหลดสินค้าไม่ได้" detail={error} />;

  return (
    <div className="pos-layout">
      {/* Products Panel */}
      <div className="pos-products">
        <div className="admin-filter-bar" style={{ marginBottom: 12 }}>
          <input className="admin-search" placeholder="🔍  ค้นหาสินค้า…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            <button className={`admin-btn ${!catFilter ? 'admin-btn--primary' : 'admin-btn--secondary'}`} onClick={() => setCatFilter('')} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>ทั้งหมด</button>
            {Object.entries(CAT_TH).map(([k, v]) => (
              <button key={k} className={`admin-btn ${catFilter === k ? 'admin-btn--primary' : 'admin-btn--secondary'}`} onClick={() => setCatFilter(k)} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>
                {CAT_ICON[k]} {v}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p style={{ color: '#6b7280', textAlign: 'center', padding: '32px' }}>กำลังโหลดสินค้า…</p> : (
          <div className="pos-product-grid">
            {filteredProducts.map((p) => {
              const inCart = cart.find((i) => i.product_id === p.id);
              return (
                <div key={p.id}
                  className={`pos-product-card ${p.stock_qty <= 0 ? 'pos-product-card--out' : ''} ${p.is_low_stock ? 'pos-product-card--low' : ''}`}
                  onClick={() => addToCart(p)}
                  style={{ position: 'relative', outline: inCart ? '2px solid #2e7d32' : 'none' }}>
                  {inCart && <span style={{ position: 'absolute', top: 8, right: 8, background: '#2e7d32', color: '#fff', borderRadius: 999, width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>{inCart.qty}</span>}
                  <div className="pos-product-card__icon">{CAT_ICON[p.category]}</div>
                  <p className="pos-product-card__name">{p.name}</p>
                  {p.brand && <p className="pos-product-card__brand">{p.brand}</p>}
                  {p.crop_type && <p className="pos-product-card__brand">{p.crop_type} {p.seed_variety ? `· ${p.seed_variety}` : ''}</p>}
                  <p className="pos-product-card__price">{p.price_per_unit.toLocaleString()} <span style={{ fontSize: 11, fontWeight: 400 }}>บาท/{p.unit}</span></p>
                  <p className="pos-product-card__stock">{p.stock_qty <= 0 ? '❌ หมด' : p.is_low_stock ? `⚠️ เหลือ ${p.stock_qty}` : `✅ ${p.stock_qty} ${p.unit}`}</p>
                </div>
              );
            })}
            {filteredProducts.length === 0 && <p style={{ color: '#9ca3af', fontSize: 14 }}>ไม่พบสินค้า</p>}
          </div>
        )}
      </div>

      {/* Cart Panel */}
      <PosCart
        items={cart} member={member} orderType={orderType}
        paymentMethod={paymentMethod} discount={discount} pickupDate={pickupDate}
        submitting={submitting} notice={notice}
        onQtyChange={updateQty} onRemove={(id) => setCart((p) => p.filter((i) => i.product_id !== id))}
        onMemberChange={() => setShowMemberPicker(true)}
        onOrderTypeChange={setOrderType} onPaymentChange={setPaymentMethod}
        onDiscountChange={setDiscount} onPickupDateChange={setPickupDate}
        onSubmit={handleSubmit}
      />

      {showMemberPicker && (
        <PosMemberPicker
          onSelect={(m) => { setMember(m); setShowMemberPicker(false); }}
          onClose={() => setShowMemberPicker(false)}
        />
      )}
    </div>
  );
}

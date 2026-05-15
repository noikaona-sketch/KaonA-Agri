'use client';

import { useEffect, useState } from 'react';

type ProductCategory = 'seed' | 'fertilizer' | 'pesticide' | 'equipment' | 'other';
type ProductType = 'seed' | 'fertilizer' | 'chemical' | 'other';

const PRODUCT_TYPE_BY_CATEGORY: Record<ProductCategory, ProductType> = {
  seed: 'seed',
  fertilizer: 'fertilizer',
  pesticide: 'chemical',
  equipment: 'other',
  other: 'other',
};

type ProductDraft = {
  name: string;
  category: ProductCategory;
  product_type: ProductType;
  unit: string;
  price_per_unit: string;
  crop_type: string;
  seed_variety: string;
  days_to_harvest: string;
  bag_weight_kg: string;
  is_active: boolean;
};

const EMPTY: ProductDraft = {
  name: '',
  category: 'seed',
  product_type: 'seed',
  unit: 'kg',
  price_per_unit: '',
  crop_type: '',
  seed_variety: '',
  days_to_harvest: '',
  bag_weight_kg: '',
  is_active: true,
};

type Props = { product?: Record<string, unknown> | null; onClose: () => void; onSaved: () => void };

export function ProductFormModal({ product, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<ProductDraft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!product;
  const isSeedProduct = draft.product_type === 'seed';

  useEffect(() => {
    if (product) {
      const category = String(product.category ?? 'seed') as ProductCategory;
      setDraft({
        name: String(product.name ?? ''),
        category,
        product_type: (String(product.product_type ?? PRODUCT_TYPE_BY_CATEGORY[category]) as ProductType),
        unit: String(product.unit ?? 'kg'),
        price_per_unit: String(product.price_per_unit ?? ''),
        crop_type: String(product.crop_type ?? ''),
        seed_variety: String(product.seed_variety ?? ''),
        days_to_harvest: String(product.days_to_harvest ?? ''),
        bag_weight_kg: String(product.bag_weight_kg ?? ''),
        is_active: Boolean(product.is_active ?? true),
      });
    }
  }, [product]);

  async function save() {
    if (!draft.name.trim() || !draft.price_per_unit) {
      setError('กรุณากรอกชื่อสินค้าและราคา'); return;
    }
    if (draft.days_to_harvest && Number(draft.days_to_harvest) <= 0) {
      setError('กรุณากรอกอายุเก็บเกี่ยวให้มากกว่า 0 วัน'); return;
    }
    if (draft.bag_weight_kg && Number(draft.bag_weight_kg) <= 0) {
      setError('กรุณากรอกน้ำหนักต่อถุงให้มากกว่า 0 กก.'); return;
    }
    setSaving(true); setError(null);
    const payload = {
      name: draft.name.trim(),
      category: draft.category,
      product_type: draft.product_type,
      unit: draft.unit,
      price_per_unit: Number(draft.price_per_unit),
      crop_type: isSeedProduct ? (draft.crop_type.trim() || null) : null,
      seed_variety: isSeedProduct ? (draft.seed_variety.trim() || null) : null,
      days_to_harvest: isSeedProduct && draft.days_to_harvest ? Number(draft.days_to_harvest) : null,
      bag_weight_kg: isSeedProduct && draft.bag_weight_kg ? Number(draft.bag_weight_kg) : null,
      is_active: draft.is_active,
    };

    const res = await fetch('/api/admin/products', {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEdit ? { id: String(product?.id ?? ''), ...payload } : payload),
    });

    const data = (await res.json()) as { error?: string };

    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'บันทึกสินค้าไม่สำเร็จ'); return; }
    onSaved();
  }

  return (
    <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="admin-modal">
        <div className="admin-modal__header">
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{isEdit ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}</h2>
          <button className="admin-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="admin-modal__body">
          {error && <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: '10px 14px', color: '#c62828', fontSize: 14 }}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="reg-label" style={{ gridColumn: '1/-1' }}>ชื่อสินค้า <span className="reg-required">*</span>
              <input className="reg-input" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="เช่น 789" />
            </label>
            <label className="reg-label">หมวดหมู่ <span className="reg-required">*</span>
              <select className="reg-input" value={draft.category} onChange={(e) => {
                const nextCategory = e.target.value as ProductCategory;
                setDraft((p) => ({ ...p, category: nextCategory, product_type: PRODUCT_TYPE_BY_CATEGORY[nextCategory] }));
              }}>
                <option value="seed">🌾 เมล็ดพันธุ์</option>
                <option value="fertilizer">🧪 ปุ๋ย</option>
                <option value="pesticide">💊 ยา/สารกำจัดศัตรูพืช</option>
                <option value="equipment">🔧 อุปกรณ์</option>
                <option value="other">📦 อื่นๆ</option>
              </select>
            </label>
            <label className="reg-label">Product Type <span className="reg-required">*</span>
              <select className="reg-input" value={draft.product_type} onChange={(e) => {
                const nextType = e.target.value as ProductType;
                setDraft((p) => ({
                  ...p,
                  product_type: nextType,
                  ...(nextType !== 'seed'
                    ? { crop_type: '', seed_variety: '', days_to_harvest: '', bag_weight_kg: '' }
                    : {}),
                }));
              }}>
                <option value="seed">seed</option>
                <option value="fertilizer">fertilizer</option>
                <option value="chemical">chemical</option>
                <option value="other">other</option>
              </select>
            </label>
            <label className="reg-label">ราคา/หน่วย (บาท) <span className="reg-required">*</span>
              <input className="reg-input" type="number" min="0" step="0.01" value={draft.price_per_unit} onChange={(e) => setDraft((p) => ({ ...p, price_per_unit: e.target.value }))} placeholder="0.00" />
            </label>
            <label className="reg-label">หน่วย
              <select className="reg-input" value={draft.unit} onChange={(e) => setDraft((p) => ({ ...p, unit: e.target.value }))}>
                <option value="kg">กิโลกรัม (kg)</option><option value="g">กรัม (g)</option><option value="bag">ถุง/ซอง</option><option value="bottle">ขวด</option><option value="box">กล่อง</option><option value="liter">ลิตร</option><option value="piece">ชิ้น</option>
              </select>
            </label>
            {isSeedProduct && (
              <>
                <label className="reg-label">ชนิดพืช
                  <input className="reg-input" value={draft.crop_type} onChange={(e) => setDraft((p) => ({ ...p, crop_type: e.target.value }))} placeholder="เช่น ข้าวโพด" />
                </label>
                <label className="reg-label">สายพันธุ์เมล็ด
                  <input className="reg-input" value={draft.seed_variety} onChange={(e) => setDraft((p) => ({ ...p, seed_variety: e.target.value }))} placeholder="เช่น 789" />
                </label>
                <label className="reg-label">อายุเก็บเกี่ยว (วัน)
                  <input className="reg-input" type="number" min="0" step="1" value={draft.days_to_harvest} onChange={(e) => setDraft((p) => ({ ...p, days_to_harvest: e.target.value }))} placeholder="เช่น 110" />
                </label>
                <label className="reg-label">น้ำหนักต่อถุง (กก.)
                  <input className="reg-input" type="number" min="0" step="0.01" value={draft.bag_weight_kg} onChange={(e) => setDraft((p) => ({ ...p, bag_weight_kg: e.target.value }))} placeholder="เช่น 10" />
                </label>
              </>
            )}
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer', marginTop: 10 }}>
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((p) => ({ ...p, is_active: e.target.checked }))} />
            เปิดใช้งาน
          </label>
        </div>
        <div className="admin-modal__footer">
          <button className="admin-btn admin-btn--secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก…' : isEdit ? '💾 บันทึก' : '➕ เพิ่มสินค้า'}</button>
        </div>
      </div>
    </div>
  );
}

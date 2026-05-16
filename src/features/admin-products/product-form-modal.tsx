'use client';

import { useEffect, useState }                 from 'react';
import { SeedVarietySelect, type SeedVariety } from './seed-variety-select';

type ProductCategory = 'seed' | 'fertilizer' | 'pesticide' | 'equipment' | 'other';
type ProductType     = 'seed' | 'fertilizer' | 'chemical' | 'other';
const TYPE_BY_CAT: Record<ProductCategory, ProductType> = {
  seed: 'seed', fertilizer: 'fertilizer',
  pesticide: 'chemical', equipment: 'other', other: 'other',
};

type Draft = {
  name: string; product_code: string;
  category: ProductCategory; product_type: ProductType;
  unit: string; price_per_unit: string; is_active: boolean;
  seed_variety_id: string;
  crop_type: string; seed_variety: string;
  days_to_harvest: string; bag_weight_kg: string;
};

const EMPTY: Draft = {
  name: '', product_code: '',
  category: 'seed', product_type: 'seed',
  unit: 'kg', price_per_unit: '', is_active: true,
  seed_variety_id: '',
  crop_type: '', seed_variety: '', days_to_harvest: '', bag_weight_kg: '',
};

const UNITS = [['kg','กิโลกรัม'],['g','กรัม'],['bag','ถุง/ซอง'],['bottle','ขวด'],['box','กล่อง'],['liter','ลิตร'],['piece','ชิ้น']];

type Props = { product?: Record<string, unknown> | null; onClose: () => void; onSaved: () => void };

export function ProductFormModal({ product, onClose, onSaved }: Props) {
  const [draft,  setDraft]  = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const isEdit  = !!product;
  const isSeed  = draft.product_type === 'seed';
  const needVar = isSeed && draft.is_active;   // required when active seed

  useEffect(() => {
    if (!product) return;
    const cat = String(product.category ?? 'seed') as ProductCategory;
    setDraft({
      name:            String(product.name           ?? ''),
      product_code:    String(product.product_code   ?? ''),
      category:        cat,
      product_type:    String(product.product_type   ?? TYPE_BY_CAT[cat]) as ProductType,
      unit:            String(product.unit            ?? 'kg'),
      price_per_unit:  String(product.price_per_unit ?? ''),
      is_active:       Boolean(product.is_active      ?? true),
      seed_variety_id: String(product.seed_variety_id ?? ''),
      crop_type:       String(product.crop_type      ?? ''),
      seed_variety:    String(product.seed_variety   ?? ''),
      days_to_harvest: String(product.days_to_harvest ?? ''),
      bag_weight_kg:   String(product.bag_weight_kg  ?? ''),
    });
  }, [product]);

  function onVarietyPicked(id: string, v: SeedVariety | null) {
    setDraft((p) => ({
      ...p, seed_variety_id: id,
      crop_type:       v?.crop_type        ?? p.crop_type,
      seed_variety:    v?.variety_name     ?? p.seed_variety,
      days_to_harvest: v?.days_to_harvest  != null ? String(v.days_to_harvest) : p.days_to_harvest,
      bag_weight_kg:   v?.bag_weight_kg    != null ? String(v.bag_weight_kg)   : p.bag_weight_kg,
    }));
  }

  function onTypeChange(t: ProductType) {
    setDraft((p) => ({
      ...p, product_type: t,
      ...(t !== 'seed' ? { seed_variety_id: '', crop_type: '', seed_variety: '', days_to_harvest: '', bag_weight_kg: '' } : {}),
    }));
  }

  const set = (k: keyof Draft, v: string | boolean) => setDraft((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!draft.name.trim() || !draft.price_per_unit) { setError('กรุณากรอกชื่อสินค้าและราคา'); return; }
    if (needVar && !draft.seed_variety_id)            { setError('กรุณาเลือกพันธุ์เมล็ด'); return; }
    setSaving(true); setError(null);
    const payload = {
      name: draft.name.trim(), product_code: draft.product_code.trim() || null,
      category: draft.category, product_type: draft.product_type,
      unit: draft.unit, price_per_unit: Number(draft.price_per_unit), is_active: draft.is_active,
      seed_variety_id: isSeed ? (draft.seed_variety_id || null) : null,
      crop_type:       isSeed ? (draft.crop_type.trim()    || null) : null,
      seed_variety:    isSeed ? (draft.seed_variety.trim() || null) : null,
      days_to_harvest: isSeed && draft.days_to_harvest ? Number(draft.days_to_harvest) : null,
      bag_weight_kg:   isSeed && draft.bag_weight_kg   ? Number(draft.bag_weight_kg)   : null,
    };
    const res  = await fetch('/api/admin/products', {
      method:  isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(isEdit ? { id: String(product?.id ?? ''), ...payload } : payload),
    });
    const data = (await res.json()) as { error?: string };
    setSaving(false);
    if (!res.ok) { setError(data.error ?? 'บันทึกไม่สำเร็จ'); return; }
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
          {error && <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: '10px 14px', color: '#c62828', fontSize: 14, marginBottom: 12 }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

            <label className="reg-label" style={{ gridColumn: '1/-1' }}>ชื่อสินค้า <span className="reg-required">*</span>
              <input className="reg-input" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="เช่น เมล็ดพันธุ์ข้าวโพด 789" />
            </label>

            <label className="reg-label">รหัสสินค้า
              <input className="reg-input" value={draft.product_code} onChange={(e) => set('product_code', e.target.value)} placeholder="เช่น SEED-789" />
            </label>

            <label className="reg-label">หมวดหมู่ <span className="reg-required">*</span>
              <select className="reg-input" value={draft.category} onChange={(e) => {
                const cat = e.target.value as ProductCategory;
                setDraft((p) => ({ ...p, category: cat, product_type: TYPE_BY_CAT[cat] }));
              }}>
                <option value="seed">🌾 เมล็ดพันธุ์</option>
                <option value="fertilizer">🧪 ปุ๋ย</option>
                <option value="pesticide">💊 ยา/สารกำจัดศัตรูพืช</option>
                <option value="equipment">🔧 อุปกรณ์</option>
                <option value="other">📦 อื่นๆ</option>
              </select>
            </label>

            <label className="reg-label">Product Type <span className="reg-required">*</span>
              <select className="reg-input" value={draft.product_type} onChange={(e) => onTypeChange(e.target.value as ProductType)}>
                <option value="seed">seed</option><option value="fertilizer">fertilizer</option>
                <option value="chemical">chemical</option><option value="other">other</option>
              </select>
            </label>

            <label className="reg-label">ราคา/หน่วย (บาท) <span className="reg-required">*</span>
              <input className="reg-input" type="number" min="0" step="0.01" value={draft.price_per_unit} onChange={(e) => set('price_per_unit', e.target.value)} placeholder="0.00" />
            </label>

            <label className="reg-label">หน่วย
              <select className="reg-input" value={draft.unit} onChange={(e) => set('unit', e.target.value)}>
                {UNITS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>

            {isSeed && (
              <>
                <SeedVarietySelect value={draft.seed_variety_id} onChange={onVarietyPicked} required={needVar} />
                {!needVar && <p style={{ gridColumn:'1/-1', margin: 0, fontSize: 12, color: '#9ca3af' }}>ℹ️ สินค้าปิดใช้งาน — ไม่บังคับเลือกพันธุ์</p>}
                <label className="reg-label">ชนิดพืช (auto-fill)
                  <input className="reg-input" value={draft.crop_type} onChange={(e) => set('crop_type', e.target.value)} placeholder="เช่น ข้าวโพด" />
                </label>
                <label className="reg-label">สายพันธุ์ (auto-fill)
                  <input className="reg-input" value={draft.seed_variety} onChange={(e) => set('seed_variety', e.target.value)} placeholder="เช่น 789" />
                </label>
                <label className="reg-label">อายุเก็บเกี่ยว (วัน)
                  <input className="reg-input" type="number" min="0" value={draft.days_to_harvest} onChange={(e) => set('days_to_harvest', e.target.value)} placeholder="เช่น 110" />
                </label>
                <label className="reg-label">น้ำหนักต่อถุง (กก.)
                  <input className="reg-input" type="number" min="0" step="0.01" value={draft.bag_weight_kg} onChange={(e) => set('bag_weight_kg', e.target.value)} placeholder="เช่น 10" />
                </label>
              </>
            )}
          </div>
          <label style={{ display:'flex', gap:8, alignItems:'center', fontSize:14, cursor:'pointer', marginTop:10 }}>
            <input type="checkbox" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            เปิดใช้งาน
          </label>
        </div>
        <div className="admin-modal__footer">
          <button className="admin-btn admin-btn--secondary" onClick={onClose} disabled={saving}>ยกเลิก</button>
          <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : isEdit ? '💾 บันทึก' : '➕ เพิ่มสินค้า'}
          </button>
        </div>
      </div>
    </div>
  );
}

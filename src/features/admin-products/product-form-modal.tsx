'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type ProductDraft = {
  name: string; brand: string; category: string;
  description: string; unit: string;
  price_per_unit: string; stock_qty: string; min_stock_alert: string;
  seed_variety: string; crop_type: string; days_to_harvest: string;
  expiry_months: string; planting_guide: string;
  planting_spacing_cm: string; water_requirement: string;
  fertilizer_guide: string; pest_disease_guide: string;
  is_visible_to_members: boolean; is_active: boolean; sort_order: string;
};

const EMPTY: ProductDraft = {
  name: '', brand: '', category: 'seed', description: '',
  unit: 'kg', price_per_unit: '', stock_qty: '0', min_stock_alert: '10',
  seed_variety: '', crop_type: '', days_to_harvest: '', expiry_months: '',
  planting_guide: '', planting_spacing_cm: '', water_requirement: '',
  fertilizer_guide: '', pest_disease_guide: '',
  is_visible_to_members: true, is_active: true, sort_order: '0',
};

type Props = { product?: Record<string, unknown> | null; onClose: () => void; onSaved: () => void };

export function ProductFormModal({ product, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<ProductDraft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const isEdit = !!product;

  useEffect(() => {
    if (product) {
      setDraft({
        name: String(product.name ?? ''), brand: String(product.brand ?? ''),
        category: String(product.category ?? 'seed'),
        description: String(product.description ?? ''),
        unit: String(product.unit ?? 'kg'),
        price_per_unit: String(product.price_per_unit ?? ''),
        stock_qty: String(product.stock_qty ?? '0'),
        min_stock_alert: String(product.min_stock_alert ?? '10'),
        seed_variety: String(product.seed_variety ?? ''),
        crop_type: String(product.crop_type ?? ''),
        days_to_harvest: String(product.days_to_harvest ?? ''),
        expiry_months: String(product.expiry_months ?? ''),
        planting_guide: String(product.planting_guide ?? ''),
        planting_spacing_cm: String(product.planting_spacing_cm ?? ''),
        water_requirement: String(product.water_requirement ?? ''),
        fertilizer_guide: String(product.fertilizer_guide ?? ''),
        pest_disease_guide: String(product.pest_disease_guide ?? ''),
        is_visible_to_members: Boolean(product.is_visible_to_members ?? true),
        is_active: Boolean(product.is_active ?? true),
        sort_order: String(product.sort_order ?? '0'),
      });
    }
  }, [product]);

  function set(field: keyof ProductDraft) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((p) => ({ ...p, [field]: e.target.value }));
  }

  async function save() {
    if (!draft.name.trim() || !draft.price_per_unit) {
      setError('กรุณากรอกชื่อสินค้าและราคา'); return;
    }
    setSaving(true); setError(null);
    const s = createSupabaseBrowserClient();
    const payload = {
      name: draft.name.trim(), brand: draft.brand || null,
      category: draft.category, description: draft.description || null,
      unit: draft.unit, price_per_unit: Number(draft.price_per_unit),
      min_stock_alert: Number(draft.min_stock_alert),
      seed_variety: draft.seed_variety || null, crop_type: draft.crop_type || null,
      days_to_harvest: draft.days_to_harvest ? Number(draft.days_to_harvest) : null,
      expiry_months: draft.expiry_months ? Number(draft.expiry_months) : null,
      planting_guide: draft.planting_guide || null,
      planting_spacing_cm: draft.planting_spacing_cm ? Number(draft.planting_spacing_cm) : null,
      water_requirement: draft.water_requirement || null,
      fertilizer_guide: draft.fertilizer_guide || null,
      pest_disease_guide: draft.pest_disease_guide || null,
      is_visible_to_members: draft.is_visible_to_members,
      is_active: draft.is_active, sort_order: Number(draft.sort_order),
    };

    let err;
    if (isEdit) {
      ({ error: err } = await s.from('products').update(payload).eq('id', product!.id));
    } else {
      ({ error: err } = await s.from('products').insert({ ...payload, stock_qty: Number(draft.stock_qty) }));
    }

    setSaving(false);
    if (err) { setError(err.message); return; }
    onSaved();
  }

  const isSeed = draft.category === 'seed';

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
              <input className="reg-input" value={draft.name} onChange={set('name')} placeholder="เช่น NK48 ข้าวโพดหวาน" />
            </label>
            <label className="reg-label">หมวดหมู่
              <select className="reg-input" value={draft.category} onChange={set('category')}>
                <option value="seed">🌾 เมล็ดพันธุ์</option>
                <option value="fertilizer">🧪 ปุ๋ย</option>
                <option value="pesticide">💊 ยา/สารกำจัดศัตรูพืช</option>
                <option value="equipment">🔧 อุปกรณ์</option>
                <option value="other">📦 อื่นๆ</option>
              </select>
            </label>
            <label className="reg-label">ยี่ห้อ/ผู้ขาย
              <input className="reg-input" value={draft.brand} onChange={set('brand')} placeholder="เช่น Syngenta" />
            </label>
            <label className="reg-label">ราคา/หน่วย (บาท) <span className="reg-required">*</span>
              <input className="reg-input" type="number" min="0" step="0.01" value={draft.price_per_unit} onChange={set('price_per_unit')} placeholder="0.00" />
            </label>
            <label className="reg-label">หน่วย
              <select className="reg-input" value={draft.unit} onChange={set('unit')}>
                <option value="kg">กิโลกรัม (kg)</option>
                <option value="g">กรัม (g)</option>
                <option value="bag">ถุง/ซอง</option>
                <option value="bottle">ขวด</option>
                <option value="box">กล่อง</option>
                <option value="liter">ลิตร</option>
                <option value="piece">ชิ้น</option>
              </select>
            </label>
            {!isEdit && <label className="reg-label">สต๊อกเริ่มต้น
              <input className="reg-input" type="number" min="0" value={draft.stock_qty} onChange={set('stock_qty')} />
            </label>}
            <label className="reg-label">แจ้งเตือนเมื่อสต๊อก ≤
              <input className="reg-input" type="number" min="0" value={draft.min_stock_alert} onChange={set('min_stock_alert')} />
            </label>
          </div>

          {isSeed && (
            <>
              <hr style={{ border: 'none', borderTop: '1px solid #e8ede8' }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#4a6741' }}>ข้อมูลเมล็ดพันธุ์</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="reg-label">ชนิดพืช
                  <input className="reg-input" value={draft.crop_type} onChange={set('crop_type')} placeholder="ข้าวโพด / ข้าว / มันสำปะหลัง" />
                </label>
                <label className="reg-label">พันธุ์
                  <input className="reg-input" value={draft.seed_variety} onChange={set('seed_variety')} placeholder="NK48 / Pioneer 3482" />
                </label>
                <label className="reg-label">วันเก็บเกี่ยว (วัน)
                  <input className="reg-input" type="number" value={draft.days_to_harvest} onChange={set('days_to_harvest')} placeholder="90" />
                </label>
                <label className="reg-label">อายุการเก็บ (เดือน)
                  <input className="reg-input" type="number" value={draft.expiry_months} onChange={set('expiry_months')} placeholder="18" />
                </label>
                <label className="reg-label">ระยะปลูก (ซม.)
                  <input className="reg-input" type="number" value={draft.planting_spacing_cm} onChange={set('planting_spacing_cm')} placeholder="75" />
                </label>
                <label className="reg-label">ความต้องการน้ำ
                  <input className="reg-input" value={draft.water_requirement} onChange={set('water_requirement')} placeholder="ปานกลาง / สูง" />
                </label>
              </div>
              <label className="reg-label">วิธีการปลูก (คู่มือ)
                <textarea className="reg-input reg-textarea" rows={4} value={draft.planting_guide} onChange={set('planting_guide')} placeholder="อธิบายขั้นตอนการปลูก..." />
              </label>
              <label className="reg-label">คำแนะนำปุ๋ย
                <textarea className="reg-input reg-textarea" rows={2} value={draft.fertilizer_guide} onChange={set('fertilizer_guide')} placeholder="สูตรปุ๋ยและช่วงเวลาที่ใส่..." />
              </label>
              <label className="reg-label">โรค/แมลงและการป้องกัน
                <textarea className="reg-input reg-textarea" rows={2} value={draft.pest_disease_guide} onChange={set('pest_disease_guide')} placeholder="โรคและแมลงที่พบบ่อย วิธีป้องกัน..." />
              </label>
            </>
          )}

          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.is_visible_to_members} onChange={(e) => setDraft((p) => ({ ...p, is_visible_to_members: e.target.checked }))} />
              แสดงในมือถือสมาชิก
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((p) => ({ ...p, is_active: e.target.checked }))} />
              เปิดใช้งาน
            </label>
          </div>
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

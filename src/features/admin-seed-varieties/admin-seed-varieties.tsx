'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState } from '@/shared/components/error-state';

type Supplier = { id: string; supplier_name: string };
type Variety = {
  id: string; variety_name: string; crop_type: string;
  supplier_id: string | null; days_to_harvest: number | null;
  seed_per_rai_kg: number | null; yield_per_rai: number | null;
  planting_spacing: string | null; season: string | null;
  bag_weight_kg: number; price_per_bag: number | null;
  yield_ratio: number | null;   // กก.ผลผลิต / กก.เมล็ด
  planting_guide: string | null; notes: string | null;
  active_status: string; show_to_farmer: boolean; sort_order: number;
};
const EMPTY = {
  variety_name: '', crop_type: 'ข้าวโพด', supplier_id: '',
  days_to_harvest: '', seed_per_rai_kg: '', yield_per_rai: '',
  planting_spacing: '', season: '', bag_weight_kg: '1',
  price_per_bag: '', yield_ratio: '600',
  planting_guide: '', notes: '',
  active_status: 'active', show_to_farmer: true, sort_order: '0',
} as {
  variety_name: string; crop_type: string; supplier_id: string;
  days_to_harvest: string; seed_per_rai_kg: string; yield_per_rai: string;
  planting_spacing: string; season: string; bag_weight_kg: string;
  price_per_bag: string; yield_ratio: string;
  planting_guide: string; notes: string;
  active_status: string; show_to_farmer: boolean; sort_order: string;
};

export function AdminSeedVarieties() {
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [notice, setNotice]       = useState<string | null>(null);
  const [editId, setEditId]       = useState<string | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(EMPTY);
  const [saving, setSaving]       = useState(false);

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const [vRes, sRes] = await Promise.all([
      s.from('seed_varieties').select('*').order('sort_order').order('variety_name'),
      s.from('seed_suppliers').select('id,supplier_name').eq('active_status','active').order('supplier_name'),
    ]);
    if (vRes.error) setError(vRes.error.message);
    else { setVarieties((vRes.data as Variety[]) ?? []); setSuppliers((sRes.data as Supplier[]) ?? []); }
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  function startAdd() { setEditId(null); setForm(EMPTY); setShowForm(true); }
  function startEdit(v: Variety) {
    setEditId(v.id);
    setForm({ variety_name: v.variety_name, crop_type: v.crop_type, supplier_id: v.supplier_id ?? '', days_to_harvest: String(v.days_to_harvest ?? ''), seed_per_rai_kg: String(v.seed_per_rai_kg ?? ''), yield_per_rai: String(v.yield_per_rai ?? ''), planting_spacing: v.planting_spacing ?? '', season: v.season ?? '', bag_weight_kg: String(v.bag_weight_kg), price_per_bag: String(v.price_per_bag ?? ''), yield_ratio: String(v.yield_ratio ?? 600), planting_guide: v.planting_guide ?? '', notes: v.notes ?? '', active_status: v.active_status, show_to_farmer: v.show_to_farmer, sort_order: String(v.sort_order) });
    setShowForm(true);
  }

  async function save() {
    if (!form.variety_name.trim()) { setNotice('❌ กรุณากรอกชื่อพันธุ์'); return; }
    setSaving(true); setNotice(null);
    const s = createSupabaseBrowserClient();
    const payload = {
      variety_name: form.variety_name.trim(), crop_type: form.crop_type,
      supplier_id: form.supplier_id || null,
      days_to_harvest: form.days_to_harvest ? Number(form.days_to_harvest) : null,
      seed_per_rai_kg: form.seed_per_rai_kg ? Number(form.seed_per_rai_kg) : null,
      yield_per_rai: form.yield_per_rai ? Number(form.yield_per_rai) : null,
      planting_spacing: form.planting_spacing || null,
      season: form.season || null,
      bag_weight_kg: Number(form.bag_weight_kg) || 1,
      price_per_bag: form.price_per_bag ? Number(form.price_per_bag) : null,
      yield_ratio: form.yield_ratio ? Number(form.yield_ratio) : 600,
      planting_guide: form.planting_guide || null,
      notes: form.notes || null,
      active_status: form.active_status,
      show_to_farmer: form.show_to_farmer,
      sort_order: Number(form.sort_order) || 0,
    };
    const { error: e } = editId
      ? await s.from('seed_varieties').update(payload).eq('id', editId)
      : await s.from('seed_varieties').insert(payload);
    setSaving(false);
    if (e) { setNotice(`❌ ${e.message}`); return; }
    setNotice(`✅ ${editId ? 'แก้ไข' : 'เพิ่ม'} พันธุ์แล้ว`);
    setShowForm(false); setEditId(null); await load();
  }

  return (
    <div>
      {notice && <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>{notice}</div>}

      <div style={{ marginBottom: 14 }}>
        <button className="admin-btn admin-btn--primary" onClick={startAdd}>➕ เพิ่มพันธุ์ใหม่</button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="admin-modal">
            <div className="admin-modal__header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editId ? '✏️ แก้ไขพันธุ์' : '➕ เพิ่มพันธุ์ใหม่'}</h2>
              <button className="admin-modal__close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="admin-modal__body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="reg-label" style={{ gridColumn: '1/-1' }}>ชื่อพันธุ์ <span className="reg-required">*</span>
                  <input className="reg-input" value={form.variety_name} onChange={set('variety_name')} placeholder="PAC339, NK48..." />
                </label>
                <label className="reg-label">ชนิดพืช
                  <input className="reg-input" value={form.crop_type} onChange={set('crop_type')} placeholder="ข้าวโพด" />
                </label>
                <label className="reg-label">Supplier
                  <select className="reg-input" value={form.supplier_id} onChange={set('supplier_id')}>
                    <option value="">— ไม่ระบุ —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                  </select>
                </label>
                <label className="reg-label">วันเก็บเกี่ยว
                  <input className="reg-input" type="number" value={form.days_to_harvest} onChange={set('days_to_harvest')} placeholder="110" />
                </label>
                <label className="reg-label">เมล็ด/ไร่ (กก.)
                  <input className="reg-input" type="number" step="0.1" value={form.seed_per_rai_kg} onChange={set('seed_per_rai_kg')} placeholder="3.5" />
                </label>
                <label className="reg-label">น้ำหนักถุง (กก.) <span className="reg-required">*</span>
                  <input className="reg-input" type="number" step="0.1" value={form.bag_weight_kg} onChange={set('bag_weight_kg')} placeholder="1" />
                </label>
                <label className="reg-label">อัตราผลผลิต (กก./กก.เมล็ด)
                  <input className="reg-input" type="number" step="1" value={form.yield_ratio ?? '600'} onChange={set('yield_ratio')} placeholder="600" />
                  <span className="reg-hint">เช่น 600 = เมล็ด 1 กก. → ข้าวโพด 600 กก.</span>
                </label>
                <label className="reg-label">ราคา/ถุง (บาท)
                  <input className="reg-input" type="number" value={form.price_per_bag} onChange={set('price_per_bag')} placeholder="850" />
                </label>
                <label className="reg-label">ระยะปลูก
                  <input className="reg-input" value={form.planting_spacing} onChange={set('planting_spacing')} placeholder="75×25 ซม." />
                </label>
                <label className="reg-label">ฤดูกาล
                  <input className="reg-input" value={form.season} onChange={set('season')} placeholder="ต้นฝน / ปลายฝน" />
                </label>
                <label className="reg-label">สถานะ
                  <select className="reg-input" value={form.active_status} onChange={set('active_status')}>
                    <option value="active">✅ ใช้งาน</option>
                    <option value="inactive">⛔ ไม่ใช้งาน</option>
                  </select>
                </label>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.show_to_farmer} onChange={(e) => setForm((p) => ({ ...p, show_to_farmer: e.target.checked }))} />
                  แสดงในมือถือสมาชิก
                </label>
                <label className="reg-label" style={{ gridColumn: '1/-1' }}>คู่มือการปลูก
                  <textarea className="reg-input reg-textarea" rows={3} value={form.planting_guide} onChange={set('planting_guide')} placeholder="วิธีการปลูก..." />
                </label>
                <label className="reg-label" style={{ gridColumn: '1/-1' }}>หมายเหตุ
                  <textarea className="reg-input reg-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="คำแนะนำพิเศษ..." />
                </label>
              </div>
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setShowForm(false)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>{saving ? 'กำลังบันทึก…' : '💾 บันทึก'}</button>
            </div>
          </div>
        </div>
      )}

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>พันธุ์</th><th>พืช</th><th>Supplier</th><th>วันเก็บ</th><th>ราคา/ถุง</th><th>มือถือ</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {varieties.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ยังไม่มีพันธุ์</td></tr>}
              {varieties.map((v) => (
                <tr key={v.id} style={{ opacity: v.active_status === 'inactive' ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 700 }}>{v.variety_name}</td>
                  <td>{v.crop_type}</td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>{suppliers.find((s) => s.id === v.supplier_id)?.supplier_name ?? '—'}</td>
                  <td>{v.days_to_harvest ?? '—'} วัน</td>
                  <td style={{ fontWeight: 700, color: '#1b5e20' }}>{v.price_per_bag?.toLocaleString() ?? '—'} บาท</td>
                  <td style={{ textAlign: 'center' }}>{v.show_to_farmer ? '👁️' : '—'}</td>
                  <td><span className={`status-badge ${v.active_status === 'active' ? 'status-badge--approved' : 'status-badge--suspended'}`}>{v.active_status === 'active' ? '✅' : '⛔'}</span></td>
                  <td><button className="admin-btn admin-btn--ghost" onClick={() => startEdit(v)}>✏️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { CareScheduleBuilder } from '@/features/admin-care-schedule/care-schedule-builder';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState } from '@/shared/components/error-state';

type Supplier = { id: string; supplier_name: string };
type Variety = {
  id: string; variety_name: string; crop_type: string;
  supplier_id: string | null; days_to_harvest: number | null;
  seed_per_rai_kg: number | null; yield_per_rai: number | null;
  planting_spacing: string | null; season: string | null;
  bag_weight_kg: number; price_per_bag: number | null;
  yield_ratio: number | null;
  planting_guide: string | null; notes: string | null;
  mentor_name: string | null; mentor_phone: string | null;
  planting_steps: unknown[] | null;
  image_url: string | null;
  active_status: string; show_to_farmer: boolean; sort_order: number;
};
const EMPTY = {
  variety_name: '', crop_type: 'ข้าวโพด', supplier_id: '',
  days_to_harvest: '', seed_per_rai_kg: '', yield_per_rai: '',
  planting_spacing: '', season: '', bag_weight_kg: '1',
  price_per_bag: '', yield_ratio: '600',
  planting_guide: '', notes: '',
  mentor_name: '', mentor_phone: '', planting_steps_json: '[]', care_schedule_json: '[]',
  image_url: '',
  active_status: 'active', show_to_farmer: true, sort_order: '0',
} as {
  variety_name: string; crop_type: string; supplier_id: string;
  days_to_harvest: string; seed_per_rai_kg: string; yield_per_rai: string;
  planting_spacing: string; season: string; bag_weight_kg: string;
  price_per_bag: string; yield_ratio: string;
  planting_guide: string; notes: string;
  mentor_name: string; mentor_phone: string; planting_steps_json: string; care_schedule_json: string;
  image_url: string;
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
    const res = await fetch('/api/admin/seed-varieties', { credentials: 'include' });
    const d = (await res.json()) as { varieties?: Variety[]; suppliers?: Supplier[]; error?: string };
    if (!res.ok) setError(d.error ?? 'โหลดไม่สำเร็จ');
    else { setVarieties(d.varieties ?? []); setSuppliers(d.suppliers ?? []); }
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
    setForm({ variety_name: v.variety_name, crop_type: v.crop_type, supplier_id: v.supplier_id ?? '', days_to_harvest: String(v.days_to_harvest ?? ''), seed_per_rai_kg: String(v.seed_per_rai_kg ?? ''), yield_per_rai: String(v.yield_per_rai ?? ''), planting_spacing: v.planting_spacing ?? '', season: v.season ?? '', bag_weight_kg: String(v.bag_weight_kg), price_per_bag: String(v.price_per_bag ?? ''), yield_ratio: String(v.yield_ratio ?? 600), planting_guide: v.planting_guide ?? '', notes: v.notes ?? '', mentor_name: v.mentor_name as string ?? '', mentor_phone: v.mentor_phone as string ?? '', planting_steps_json: JSON.stringify((v as Record<string,unknown>).planting_steps ?? []), care_schedule_json: JSON.stringify((v as Record<string,unknown>).care_schedule ?? []), image_url: v.image_url ?? '', active_status: v.active_status, show_to_farmer: v.show_to_farmer, sort_order: String(v.sort_order) });
    setShowForm(true);
  }

  async function save() {
    if (!form.variety_name.trim()) { setNotice('❌ กรุณากรอกชื่อพันธุ์'); return; }
    setSaving(true); setNotice(null);
    const payload = {
      ...(editId ? { id: editId } : {}),
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
      mentor_name:  form.mentor_name  || null,
      mentor_phone: form.mentor_phone || null,
      image_url:    form.image_url    || null,
      care_schedule: (() => {
        try { return JSON.parse(form.care_schedule_json ?? '[]'); }
        catch { return []; }
      })(),
      planting_steps: (() => {
        try { return JSON.parse(form.planting_steps_json ?? '[]'); }
        catch { return []; }
      })(),
      active_status: form.active_status,
      show_to_farmer: form.show_to_farmer,
      sort_order: Number(form.sort_order) || 0,
    };
    const res = await fetch('/api/admin/seed-varieties', { credentials: 'include', 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
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
                <label className="reg-label" style={{ gridColumn: '1/-1' }}>พี่เลี้ยง / เจ้าหน้าที่ดูแล
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <input className="reg-input" value={form.mentor_name ?? ''} onChange={(e) => setForm((p) => ({ ...p, mentor_name: e.target.value }))} placeholder="ชื่อพี่เลี้ยง" />
                    <input className="reg-input" type="tel" value={form.mentor_phone ?? ''} onChange={(e) => setForm((p) => ({ ...p, mentor_phone: e.target.value }))} placeholder="เบอร์โทร" />
                  </div>
                </label>
                <label className="reg-label" style={{ gridColumn: '1/-1' }}>รูปภาพเมล็ดพันธุ์
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 4 }}>
                    {form.image_url && (
                      <img src={form.image_url} alt="preview"
                        style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover', border: '1.5px solid #a5d6a7', flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <input type="file" accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          // compress ก่อน upload
                          let uploadFile: File = file;
                          try {
                            const { compressGeneral, blobToFile } = await import('@/lib/image/compress');
                            const blob = await compressGeneral(file, 800);
                            uploadFile = blobToFile(blob, file.name, '_variety');
                          } catch { /* ใช้ file เดิม */ }
                          const fd = new FormData();
                          fd.append('file', uploadFile);
                          fd.append('bucket', 'seed-images');
                          fd.append('folder', 'varieties');
                          const res = await fetch('/api/admin/upload-image', { credentials: 'include',  method: 'POST', body: fd });
                          const d = (await res.json()) as { url?: string; error?: string };
                          if (d.url) setForm((p) => ({ ...p, image_url: d.url! }));
                          else setNotice(`❌ อัปโหลดรูปไม่สำเร็จ: ${d.error}`);
                        }}
                        style={{ display: 'block', fontSize: 13, color: '#4a6741' }} />
                      {form.image_url && (
                        <button type="button" onClick={() => setForm((p) => ({ ...p, image_url: '' }))}
                          style={{ marginTop: 4, fontSize: 12, color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          ✕ ลบรูป
                        </button>
                      )}
                      <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>JPG/PNG ขนาดไม่เกิน 5MB</p>
                    </div>
                  </div>
                </label>
                <label className="reg-label" style={{ gridColumn: '1/-1' }}>คู่มือการปลูก
                  <textarea className="reg-input reg-textarea" rows={3} value={form.planting_guide} onChange={set('planting_guide')} placeholder="วิธีการปลูก..." />
                </label>
                <label className="reg-label" style={{ gridColumn: '1/-1' }}>ขั้นตอนการปลูก (JSON)
                  <textarea className="reg-input reg-textarea" rows={4}
                    value={form.planting_steps_json ?? '[]'}
                    onChange={(e) => setForm((p) => ({ ...p, planting_steps_json: e.target.value }))}
                    placeholder='[{"day":"วันที่ 0","title":"เตรียมดิน","description":"...","icon":"🌱"}]' />
                  <span className="reg-hint">format: JSON array [{'{'}"day","title","description","icon"{'}'}]</span>
                </label>
                <label className="reg-label" style={{ gridColumn: '1/-1' }}>หมายเหตุ
                  <textarea className="reg-input reg-textarea" rows={2} value={form.notes} onChange={set('notes')} placeholder="คำแนะนำพิเศษ..." />
                </label>

                {/* Care Schedule Builder */}
                <CareScheduleBuilder
                  value={form.care_schedule_json}
                  onChange={(json) => setForm((p) => ({ ...p, care_schedule_json: json }))}
                  label="ตารางดูแลพืช (Care Schedule) — ใช้สร้างแจ้งเตือนสมาชิก"
                />
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

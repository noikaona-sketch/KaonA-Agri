'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type Supplier = {
  id: string; supplier_name: string; contact_name: string | null;
  phone: string | null; address: string | null;
  credit_terms: string | null; active_status: string;
};
const EMPTY: Omit<Supplier, 'id'> = {
  supplier_name: '', contact_name: '', phone: '', address: '', credit_terms: '', active_status: 'active',
};

export function AdminSeedSuppliers() {
  const [rows, setRows]     = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm]     = useState<typeof EMPTY>(EMPTY);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const { data, error: e } = await s.from('seed_suppliers').select('*').order('supplier_name');
    if (e) setError(e.message); else setRows((data as Supplier[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  function startEdit(row: Supplier) {
    setEditId(row.id);
    setForm({ supplier_name: row.supplier_name, contact_name: row.contact_name ?? '', phone: row.phone ?? '', address: row.address ?? '', credit_terms: row.credit_terms ?? '', active_status: row.active_status });
  }

  function cancel() { setEditId(null); setForm(EMPTY); }

  async function save() {
    if (!form.supplier_name.trim()) { setNotice('❌ กรุณากรอกชื่อ Supplier'); return; }
    setSaving(true); setNotice(null);
    const s = createSupabaseBrowserClient();
    const payload = { supplier_name: form.supplier_name.trim(), contact_name: form.contact_name || null, phone: form.phone || null, address: form.address || null, credit_terms: form.credit_terms || null, active_status: form.active_status };
    const { error: e } = editId
      ? await s.from('seed_suppliers').update(payload).eq('id', editId)
      : await s.from('seed_suppliers').insert(payload);
    setSaving(false);
    if (e) { setNotice(`❌ ${e.message}`); return; }
    setNotice(`✅ ${editId ? 'แก้ไข' : 'เพิ่ม'} Supplier แล้ว`);
    cancel(); await load();
  }

  async function toggleStatus(id: string, current: string) {
    const s = createSupabaseBrowserClient();
    await s.from('seed_suppliers').update({ active_status: current === 'active' ? 'inactive' : 'active' }).eq('id', id);
    await load();
  }

  return (
    <div>
      {notice && <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>{notice}</div>}

      {/* Form */}
      <div className="kaona-card" style={{ marginBottom: 20 }}>
        <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 15 }}>{editId ? '✏️ แก้ไข Supplier' : '➕ เพิ่ม Supplier ใหม่'}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label" style={{ gridColumn: '1/-1' }}>ชื่อบริษัท/ร้านค้า <span className="reg-required">*</span>
            <input className="reg-input" value={form.supplier_name} onChange={set('supplier_name')} placeholder="บริษัท Pacific Seeds" />
          </label>
          <label className="reg-label">ชื่อผู้ติดต่อ
            <input className="reg-input" value={form.contact_name ?? ''} onChange={set('contact_name')} placeholder="คุณสมชาย" />
          </label>
          <label className="reg-label">เบอร์โทร
            <input className="reg-input" type="tel" value={form.phone ?? ''} onChange={set('phone')} placeholder="08X-XXX-XXXX" />
          </label>
          <label className="reg-label">เงื่อนไขเครดิต
            <input className="reg-input" value={form.credit_terms ?? ''} onChange={set('credit_terms')} placeholder="เงินสด / เครดิต 30 วัน" />
          </label>
          <label className="reg-label">สถานะ
            <select className="reg-input" value={form.active_status} onChange={set('active_status')}>
              <option value="active">✅ ใช้งาน</option>
              <option value="inactive">⛔ ไม่ใช้งาน</option>
            </select>
          </label>
          <label className="reg-label" style={{ gridColumn: '1/-1' }}>ที่อยู่
            <input className="reg-input" value={form.address ?? ''} onChange={set('address')} placeholder="จังหวัด / ที่อยู่" />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          {editId && <button className="admin-btn admin-btn--ghost" onClick={cancel}>ยกเลิก</button>}
          <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : editId ? '💾 บันทึก' : '➕ เพิ่ม'}
          </button>
        </div>
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>ชื่อบริษัท</th><th>ผู้ติดต่อ</th><th>เบอร์</th><th>เครดิต</th><th>สถานะ</th><th></th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ยังไม่มี Supplier</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} style={{ opacity: r.active_status === 'inactive' ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 700 }}>{r.supplier_name}</td>
                  <td>{r.contact_name ?? '—'}</td>
                  <td>{r.phone ?? '—'}</td>
                  <td style={{ fontSize: 13, color: '#6b7280' }}>{r.credit_terms ?? '—'}</td>
                  <td>
                    <button onClick={() => toggleStatus(r.id, r.active_status)}
                      className={`status-badge ${r.active_status === 'active' ? 'status-badge--approved' : 'status-badge--suspended'}`}
                      style={{ border: 'none', cursor: 'pointer' }}>
                      {r.active_status === 'active' ? '✅ ใช้งาน' : '⛔ ไม่ใช้'}
                    </button>
                  </td>
                  <td><button className="admin-btn admin-btn--ghost" onClick={() => startEdit(r)}>✏️</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

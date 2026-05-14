'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';
import { ErrorState } from '@/shared/components/error-state';

type Supplier = { id: string; supplier_name: string };
type Variety  = { id: string; variety_name: string; supplier_id: string | null; bag_weight_kg: number; price_per_bag: number | null; crop_type: string };
type Lot = {
  id: string; lot_no: string; received_date: string;
  variety_name: string; supplier_name: string | null;
  quantity_in: number; quantity_balance: number;
  bag_weight_kg: number; total_weight_kg: number;
  price_per_bag: number; total_cost: number; status: string;
};

const STATUS_MAP: Record<string, { badge: string; label: string }> = {
  available: { badge: 'approved',  label: '✅ มีสต๊อก' },
  low:       { badge: 'pending',   label: '⚠️ สต๊อกต่ำ' },
  depleted:  { badge: 'rejected',  label: '❌ หมด' },
  inactive:  { badge: 'suspended', label: '⛔ ยกเลิก' },
};

export function AdminSeedLots() {
  const [lots, setLots]         = useState<Lot[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [notice, setNotice]     = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [suppFilter, setSuppFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // form state
  const [selSupplier, setSelSupplier] = useState('');
  const [selVariety,  setSelVariety]  = useState('');
  const [lotNo,       setLotNo]       = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [qtyIn,       setQtyIn]       = useState('');
  const [bagWeight,   setBagWeight]   = useState('1');
  const [pricePerBag, setPricePerBag] = useState('');
  const [formNote,    setFormNote]    = useState('');

  async function load() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const [lotRes, sRes, vRes] = await Promise.all([
      s.from('admin_seed_lot_status').select('*').limit(200),
      s.from('seed_suppliers').select('id,supplier_name').eq('active_status','active').order('supplier_name'),
      s.from('seed_varieties').select('id,variety_name,supplier_id,bag_weight_kg,price_per_bag,crop_type').eq('active_status','active').order('variety_name'),
    ]);
    if (lotRes.error) setError(lotRes.error.message);
    else {
      setLots((lotRes.data as Lot[]) ?? []);
      setSuppliers((sRes.data as Supplier[]) ?? []);
      setVarieties((vRes.data as Variety[]) ?? []);
    }
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  // filter varieties by selected supplier
  const filteredVarieties = selSupplier
    ? varieties.filter((v) => v.supplier_id === selSupplier)
    : varieties;

  // auto-fill เมื่อเลือก variety
  function pickVariety(id: string) {
    const v = varieties.find((x) => x.id === id);
    setSelVariety(id);
    if (v) {
      setBagWeight(String(v.bag_weight_kg ?? 1));
      setPricePerBag(String(v.price_per_bag ?? ''));
    }
  }

  async function saveNewLot() {
    if (!selVariety || !lotNo.trim() || !qtyIn) {
      setNotice('❌ กรุณาเลือกพันธุ์ กรอก LOT และจำนวน'); return;
    }
    const qty = Number(qtyIn);
    if (qty <= 0) { setNotice('❌ จำนวนต้องมากกว่า 0'); return; }

    setSaving(true); setNotice(null);
    const s = createSupabaseBrowserClient();
    const v = varieties.find((x) => x.id === selVariety)!;
    const sup = suppliers.find((x) => x.id === selSupplier);

    const lotPayload = {
      variety_id:      selVariety,
      supplier_id:     selSupplier || v.supplier_id || null,
      variety_name:    v.variety_name,
      supplier_name:   sup?.supplier_name ?? null,
      lot_no:          lotNo.trim(),
      received_date:   receivedDate,
      quantity_in:     qty,
      quantity_balance: qty,  // เริ่มต้นเท่ากับ quantity_in
      bag_weight_kg:   Number(bagWeight) || 1,
      price_per_bag:   Number(pricePerBag) || 0,
      note:            formNote || null,
    };
    const res = await fetch('/api/admin/seed-lots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(lotPayload) });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ บันทึก LOT แล้ว');
    setShowForm(false);
    setSelSupplier(''); setSelVariety(''); setLotNo('');
    setQtyIn(''); setBagWeight('1'); setPricePerBag(''); setFormNote('');
    await load();
  }

  async function toggleInactive(id: string) {
    if (!window.confirm('ยกเลิก LOT นี้? ถ้ามีการขายไปแล้วให้ใช้ "ยกเลิก" แทนการลบ')) return;
    await fetch('/api/admin/seed-lots', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    await load();
  }

  const displayed = lots.filter((l) =>
    (!suppFilter || l.supplier_name === suppFilter) &&
    (!statusFilter || l.status === statusFilter)
  );

  const totalBalance = displayed.filter(l => l.status === 'available').reduce((s, l) => s + l.quantity_balance, 0);

  return (
    <div>
      {notice && <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>{notice}</div>}

      <div className="admin-filter-bar">
        <select className="admin-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">ทุกสถานะ</option>
          <option value="available">✅ มีสต๊อก</option>
          <option value="low">⚠️ สต๊อกต่ำ</option>
          <option value="depleted">❌ หมด</option>
        </select>
        <select className="admin-select" value={suppFilter} onChange={(e) => setSuppFilter(e.target.value)}>
          <option value="">ทุก Supplier</option>
          {suppliers.map((s) => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
        </select>
        <button className="admin-btn admin-btn--primary" onClick={() => setShowForm(true)}>📦 รับเข้า Stock</button>
      </div>

      {totalBalance > 0 && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 14, fontWeight: 600, color: '#1b5e20' }}>
          📦 คงเหลือรวม: {totalBalance.toLocaleString()} ถุง ({displayed.filter(l => l.status === 'available').length} LOT)
        </div>
      )}

      {/* New LOT form */}
      {showForm && (
        <div className="admin-modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="admin-modal">
            <div className="admin-modal__header">
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📦 รับเข้า Stock เมล็ดพันธุ์</h2>
              <button className="admin-modal__close" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="admin-modal__body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="reg-label">Supplier
                  <select className="reg-input" value={selSupplier} onChange={(e) => { setSelSupplier(e.target.value); setSelVariety(''); }}>
                    <option value="">— เลือก Supplier —</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                  </select>
                </label>
                <label className="reg-label">พันธุ์ <span className="reg-required">*</span>
                  <select className="reg-input" value={selVariety} onChange={(e) => pickVariety(e.target.value)}>
                    <option value="">— เลือกพันธุ์ —</option>
                    {filteredVarieties.map((v) => <option key={v.id} value={v.id}>{v.variety_name} ({v.crop_type})</option>)}
                  </select>
                </label>
                <label className="reg-label">เลข LOT <span className="reg-required">*</span>
                  <input className="reg-input" value={lotNo} onChange={(e) => setLotNo(e.target.value)} placeholder="LOT-2569-001" />
                </label>
                <label className="reg-label">วันที่รับเข้า
                  <input className="reg-input" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
                </label>
                <label className="reg-label">จำนวน (ถุง) <span className="reg-required">*</span>
                  <input className="reg-input" type="number" min="1" value={qtyIn} onChange={(e) => setQtyIn(e.target.value)} placeholder="0" />
                </label>
                <label className="reg-label">น้ำหนักถุง (กก.)
                  <input className="reg-input" type="number" step="0.1" value={bagWeight} onChange={(e) => setBagWeight(e.target.value)} />
                  <span className="reg-hint">auto-fill จากพันธุ์</span>
                </label>
                <label className="reg-label">ราคา/ถุง (บาท)
                  <input className="reg-input" type="number" value={pricePerBag} onChange={(e) => setPricePerBag(e.target.value)} />
                  <span className="reg-hint">auto-fill จากพันธุ์</span>
                </label>
                {qtyIn && pricePerBag && (
                  <div style={{ gridColumn: '1/-1', background: '#e8f5e9', borderRadius: 10, padding: '10px 14px', fontSize: 14, fontWeight: 600, color: '#1b5e20' }}>
                    💰 ต้นทุน: {(Number(qtyIn) * Number(pricePerBag)).toLocaleString()} บาท
                    &nbsp;|&nbsp; น้ำหนักรวม: {(Number(qtyIn) * Number(bagWeight)).toLocaleString()} กก.
                  </div>
                )}
                <label className="reg-label" style={{ gridColumn: '1/-1' }}>หมายเหตุ
                  <input className="reg-input" value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="รายละเอียดเพิ่มเติม..." />
                </label>
              </div>
            </div>
            <div className="admin-modal__footer">
              <button className="admin-btn admin-btn--secondary" onClick={() => setShowForm(false)}>ยกเลิก</button>
              <button className="admin-btn admin-btn--primary" onClick={saveNewLot} disabled={saving}>{saving ? 'กำลังบันทึก…' : '💾 บันทึก LOT'}</button>
            </div>
          </div>
        </div>
      )}

      {loading && <LoadingState label="กำลังโหลด…" />}
      {error && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}

      {!loading && !error && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>พันธุ์</th><th>Supplier</th><th>LOT</th><th>รับวันที่</th><th>รับเข้า</th><th>คงเหลือ</th><th>ราคา/ถุง</th><th>ต้นทุน</th><th>สถานะ</th><th></th></tr>
            </thead>
            <tbody>
              {displayed.length === 0 && <tr><td colSpan={10} style={{ textAlign: 'center', color: '#9ca3af', padding: 32 }}>ยังไม่มีสต๊อก</td></tr>}
              {displayed.map((l) => {
                const st = STATUS_MAP[l.status] ?? { badge: 'pending', label: l.status };
                return (
                  <tr key={l.id} style={{ background: l.status === 'low' ? '#fffde7' : undefined }}>
                    <td style={{ fontWeight: 700 }}>{l.variety_name}</td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{l.supplier_name ?? '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{l.lot_no}</td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{new Date(l.received_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td>{l.quantity_in.toLocaleString()} ถุง</td>
                    <td style={{ fontWeight: 800, color: l.status === 'low' ? '#e65100' : l.status === 'depleted' ? '#c62828' : '#1b5e20' }}>
                      {l.quantity_balance.toLocaleString()} ถุง
                    </td>
                    <td>{l.price_per_bag.toLocaleString()} บาท</td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{l.total_cost.toLocaleString()} บาท</td>
                    <td><span className={`status-badge status-badge--${st.badge}`}>{st.label}</span></td>
                    <td>
                      {l.status !== 'inactive' && (
                        <button className="admin-btn admin-btn--danger" style={{ fontSize: 12, minHeight: 30, padding: '4px 8px' }} onClick={() => toggleInactive(l.id)}>⛔</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

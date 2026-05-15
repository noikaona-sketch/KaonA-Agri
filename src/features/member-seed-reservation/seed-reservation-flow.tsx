'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

// ── Types ────────────────────────────────────────────────────────────
type Supplier = { id: string; supplier_name: string; contact_name: string | null };
type Lot = {
  id: string; lot_no: string; variety_name: string; variety_id: string;
  quantity_balance: number; bag_weight_kg: number; price_per_bag: number;
  status: string; crop_type: string;
};
type Reservation = {
  id: string; reservation_no: string; status: string;
  variety_name: string; lot_no: string; supplier_name: string | null;
  qty_reserved: number; price_per_bag: number; total_amount: number | null;
  pickup_date: string | null; note: string | null; created_at: string;
  seed_stock_lots: { bag_weight_kg: number }[] | null;
};

// ── Status config ────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { icon: string; label: string; color: string; bg: string; desc: string }> = {
  pending:   { icon: '⏳', label: 'รอยืนยัน',     color: '#e65100', bg: '#fff8e1', desc: 'รอ admin ยืนยันการจอง' },
  confirmed: { icon: '✅', label: 'ยืนยันแล้ว',   color: '#1565c0', bg: '#e3f2fd', desc: 'จองสำเร็จ รอมารับสินค้า' },
  completed: { icon: '💰', label: 'รับสินค้าแล้ว', color: '#2e7d32', bg: '#e8f5e9', desc: 'รับสินค้าและชำระแล้ว' },
  cancelled: { icon: '❌', label: 'ยกเลิก',        color: '#c62828', bg: '#ffebee', desc: 'การจองถูกยกเลิก' },
};

type Step = 'history' | 'supplier' | 'product' | 'confirm' | 'success';

export function SeedReservationFlow() {
  const member = useCurrentMember();
  const [step, setStep]               = useState<Step>('history');
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [lots, setLots]               = useState<Lot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selSupplier, setSelSupplier] = useState<Supplier | null>(null);
  const [selLot, setSelLot]           = useState<Lot | null>(null);
  const [qty, setQty]                 = useState('1');
  const [pickupDate, setPickupDate]   = useState('');
  const [note, setNote]               = useState('');
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ reservation_no: string; total_amount: number } | null>(null);
  const [filter, setFilter]           = useState<'all' | 'active' | 'done'>('all');

  async function loadData() {
    setLoading(true);
    const s = createSupabaseBrowserClient();
    const [supRes, resRes] = await Promise.all([
      s.from('seed_suppliers').select('id,supplier_name,contact_name').eq('active_status','active').order('supplier_name'),
      member?.member_id
        ? fetch(`/api/member/seed-reservation?member_id=${member.member_id}`).then((r) => r.json()) as Promise<{ reservations: Reservation[] }>
        : Promise.resolve({ reservations: [] }),
    ]);
    setSuppliers((supRes.data as Supplier[]) ?? []);
    setReservations(resRes.reservations ?? []);
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, [member?.member_id]);

  async function loadLots(supplierId: string) {
    const s = createSupabaseBrowserClient();
    const { data } = await s
      .from('seed_stock_lots')
      .select('id,lot_no,variety_name,variety_id,quantity_balance,bag_weight_kg,price_per_bag,status,seed_varieties(crop_type)')
      .eq('supplier_id', supplierId)
      .in('status', ['available','low'])
      .gt('quantity_balance', 0)
      .order('variety_name');
    setLots((data ?? []).map((l: Record<string,unknown>) => ({
      ...l,
      crop_type: (l.seed_varieties as { crop_type: string }[] | null)?.[0]?.crop_type ?? 'ข้าวโพด',
    })) as Lot[]);
  }

  async function submit() {
    if (!selLot || !member?.member_id) return;
    setSaving(true); setError(null);
    const res = await fetch('/api/member/seed-reservation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:    member.member_id,
        lot_id:       selLot.id,
        qty_reserved: Number(qty),
        pickup_date:  pickupDate || null,
        note:         note || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string; reservation_no?: string; total_amount?: number };
    setSaving(false);
    if (!res.ok) { setError(d.error ?? 'จองไม่สำเร็จ'); return; }
    setSuccessData({ reservation_no: d.reservation_no ?? '', total_amount: d.total_amount ?? 0 });
    setStep('success');
    await loadData();
  }

  function reset() {
    setStep('history'); setSelSupplier(null); setSelLot(null);
    setQty('1'); setPickupDate(''); setNote(''); setError(null); setSuccessData(null);
  }

  const qtyNum    = Number(qty) || 0;
  const totalBaht = selLot ? qtyNum * selLot.price_per_bag : 0;
  const weightKg  = selLot ? qtyNum * selLot.bag_weight_kg : 0;

  const filteredRes = reservations.filter((r) => {
    if (filter === 'active') return ['pending','confirmed'].includes(r.status);
    if (filter === 'done')   return ['completed','cancelled'].includes(r.status);
    return true;
  });

  // ── Success screen ──────────────────────────────────────────────────
  if (step === 'success' && successData) {
    return (
      <div className="mobile-stack" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 72 }}>🎉</div>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#1b5e20' }}>จองสำเร็จ!</h2>
        <div className="kaona-card" style={{ textAlign: 'left', background: '#e8f5e9' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#4a6741' }}>หมายเลขการจอง</p>
          <p style={{ margin: '4px 0', fontSize: 20, fontWeight: 900, fontFamily: 'monospace', color: '#1b5e20' }}>{successData.reservation_no}</p>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>ยอดรวม {successData.total_amount.toLocaleString()} บาท — ชำระเมื่อรับสินค้า</p>
        </div>
        <div className="kaona-card" style={{ background: '#fff8e1' }}>
          <p style={{ margin: 0, fontSize: 14, color: '#e65100', lineHeight: 1.7 }}>
            ⏳ รอ admin ยืนยันการจอง<br />
            📱 ระบบจะแจ้งเตือนเมื่อพร้อมให้มารับ<br />
            💰 ชำระเงินเมื่อมารับสินค้าที่จุดจ่ายยา
          </p>
        </div>
        <UIButton fullWidth onClick={reset}>← กลับหน้าประวัติ</UIButton>
      </div>
    );
  }

  // ── Confirm screen ─────────────────────────────────────────────────
  if (step === 'confirm' && selLot) {
    return (
      <div className="mobile-stack">
        <button onClick={() => setStep('product')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 15, padding: 0 }}>← กลับ</button>
        <div className="kaona-card" style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>{selSupplier?.supplier_name}</p>
          <p style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 900 }}>🌾 {selLot.variety_name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.85 }}>LOT: {selLot.lot_no}</p>
        </div>

        {error && <div style={{ background: '#ffebee', borderRadius: 12, padding: '10px 14px', color: '#c62828', fontWeight: 600 }}>⚠️ {error}</div>}

        <label className="reg-label">จำนวน (ถุง) <span className="reg-required">*</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
              style={{ width: 44, height: 44, borderRadius: 10, border: '2px solid #e0e0e0', background: '#fff', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>−</button>
            <input className="reg-input" type="number" min="1" max={selLot.quantity_balance}
              value={qty} onChange={(e) => setQty(e.target.value)}
              style={{ textAlign: 'center', fontSize: 18, fontWeight: 800 }} />
            <button onClick={() => setQty(String(Math.min(selLot.quantity_balance, qtyNum + 1)))}
              style={{ width: 44, height: 44, borderRadius: 10, border: '2px solid var(--primary)', background: '#e8f5e9', fontSize: 20, cursor: 'pointer', flexShrink: 0, color: 'var(--primary)' }}>+</button>
          </div>
          <span className="reg-hint">คงเหลือ {selLot.quantity_balance} ถุง · {selLot.bag_weight_kg} กก./ถุง</span>
        </label>

        {/* summary card */}
        <div style={{ background: '#f7faf7', borderRadius: 14, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { label: 'ราคา/ถุง', value: `${selLot.price_per_bag.toLocaleString()} บาท` },
            { label: 'น้ำหนักรวม', value: `${weightKg.toLocaleString()} กก.` },
            { label: 'จำนวนถุง', value: `${qtyNum} ถุง` },
            { label: 'ยอดรวม', value: `${totalBaht.toLocaleString()} บาท`, big: true },
          ].map((s) => (
            <div key={s.label}>
              <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{s.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: s.big ? 20 : 15, fontWeight: s.big ? 900 : 700, color: s.big ? 'var(--primary)' : 'inherit' }}>{s.value}</p>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff8e1', borderRadius: 12, padding: '10px 14px', fontSize: 13, color: '#e65100', fontWeight: 600 }}>
          💰 ชำระเงินเมื่อมารับสินค้า — ไม่ต้องจ่ายตอนจอง
        </div>

        <label className="reg-label">วันที่ต้องการรับสินค้า
          <input className="reg-input" type="date" value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            min={new Date().toISOString().slice(0, 10)} />
        </label>
        <label className="reg-label">หมายเหตุ
          <textarea className="reg-input reg-textarea" rows={2} value={note}
            onChange={(e) => setNote(e.target.value)} placeholder="ข้อมูลเพิ่มเติม..." />
        </label>

        <UIButton fullWidth onClick={submit} loading={saving} disabled={qtyNum < 1 || qtyNum > selLot.quantity_balance || saving}>
          ✅ ยืนยันการจอง {qtyNum} ถุง
        </UIButton>
      </div>
    );
  }

  // ── Product screen ─────────────────────────────────────────────────
  if (step === 'product' && selSupplier) {
    const grouped = lots.reduce<Record<string, Lot[]>>((acc, l) => {
      const key = l.crop_type;
      if (!acc[key]) acc[key] = [];
      acc[key].push(l);
      return acc;
    }, {});

    return (
      <div className="mobile-stack">
        <button onClick={() => setStep('supplier')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 15, padding: 0 }}>← กลับ</button>
        <div style={{ background: '#e3f2fd', borderRadius: 14, padding: '12px 16px' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#1565c0', fontWeight: 700 }}>🏪 Supplier</p>
          <p style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800 }}>{selSupplier.supplier_name}</p>
        </div>

        {lots.length === 0 && <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}><div style={{ fontSize: 48 }}>📦</div><p>ไม่มีสินค้าในสต๊อก</p></div>}

        {Object.entries(grouped).map(([cropType, cropLots]) => (
          <div key={cropType}>
            <p style={{ margin: '4px 0 8px', fontWeight: 800, fontSize: 15, color: '#1b5e20' }}>🌽 {cropType}</p>
            {cropLots.map((lot) => (
              <button key={lot.id}
                onClick={() => { setSelLot(lot); setQty('1'); setStep('confirm'); }}
                style={{ width: '100%', textAlign: 'left', background: '#fff', border: `2px solid ${selLot?.id === lot.id ? 'var(--primary)' : '#e4ebe4'}`, borderRadius: 16, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{lot.variety_name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>LOT: {lot.lot_no}</p>
                  <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{lot.price_per_bag.toLocaleString()} บาท/ถุง</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{lot.bag_weight_kg} กก./ถุง</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: lot.quantity_balance <= 5 ? '#c62828' : '#2e7d32' }}>{lot.quantity_balance}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>ถุงเหลือ</p>
                  {lot.status === 'low' && <span style={{ fontSize: 10, background: '#ffebee', color: '#c62828', padding: '2px 6px', borderRadius: 8, fontWeight: 700 }}>สินค้าใกล้หมด</span>}
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ── Supplier screen ────────────────────────────────────────────────
  if (step === 'supplier') {
    return (
      <div className="mobile-stack">
        <button onClick={() => setStep('history')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 15, padding: 0 }}>← กลับ</button>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>เลือก Supplier</p>
        {suppliers.map((s) => (
          <button key={s.id}
            onClick={async () => { setSelSupplier(s); await loadLots(s.id); setStep('product'); }}
            style={{ width: '100%', textAlign: 'left', background: '#fff', border: '2px solid #e4ebe4', borderRadius: 16, padding: '16px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🏪</div>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{s.supplier_name}</p>
              {s.contact_name && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>ติดต่อ: {s.contact_name}</p>}
            </div>
            <span style={{ marginLeft: 'auto', fontSize: 22, color: '#9ca3af' }}>›</span>
          </button>
        ))}
      </div>
    );
  }

  // ── History screen (default) ────────────────────────────────────────
  if (loading) return <LoadingState label="กำลังโหลด…" />;

  const activeCount = reservations.filter((r) => ['pending','confirmed'].includes(r.status)).length;

  return (
    <div className="mobile-stack">
      {/* header */}
      <UIButton fullWidth onClick={() => setStep('supplier')}>
        🌾 + จองเมล็ดพันธุ์ใหม่
      </UIButton>

      {/* filter tabs */}
      <div style={{ display: 'flex', gap: 6 }}>
        {([
          { key: 'all',    label: `ทั้งหมด (${reservations.length})` },
          { key: 'active', label: `⏳ รอดำเนินการ (${activeCount})` },
          { key: 'done',   label: '✅ เสร็จสิ้น' },
        ] as const).map((f) => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, background: filter === f.key ? 'var(--primary)' : '#f0f4f0', color: filter === f.key ? '#fff' : 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* reservation list */}
      {filteredRes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 48 }}>🌾</div>
          <p style={{ margin: '8px 0 0' }}>ยังไม่มีการจอง</p>
        </div>
      )}

      {filteredRes.map((r) => {
        const st = STATUS_CFG[r.status] ?? STATUS_CFG.pending;
        const bagWeight = r.seed_stock_lots?.[0]?.bag_weight_kg ?? 1;
        return (
          <div key={r.id} className="kaona-card">
            {/* header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>🌾 {r.variety_name}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>{r.reservation_no}</p>
              </div>
              <div style={{ background: st.bg, border: `1px solid ${st.color}44`, borderRadius: 10, padding: '4px 10px', textAlign: 'center', flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: st.color }}>{st.icon} {st.label}</p>
              </div>
            </div>

            {/* info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
              {[
                { label: 'จำนวน', value: `${r.qty_reserved} ถุง` },
                { label: 'น้ำหนัก', value: `${(r.qty_reserved * bagWeight).toLocaleString()} กก.` },
                { label: 'ยอดรวม', value: `${(r.total_amount ?? 0).toLocaleString()} บาท` },
              ].map((s) => (
                <div key={s.label} style={{ background: '#f7faf7', borderRadius: 10, padding: '8px', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{s.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 13, fontWeight: 700 }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* status description */}
            <div style={{ background: st.bg, borderRadius: 10, padding: '8px 12px', marginBottom: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: st.color }}>{st.desc}</p>
            </div>

            {/* supplier + lot */}
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
              🏪 {r.supplier_name ?? '—'} · LOT: {r.lot_no}
              {r.pickup_date && ` · 📅 รับวันที่ ${new Date(r.pickup_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`}
            </p>

            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#9ca3af' }}>
              จองเมื่อ {new Date(r.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        );
      })}
    </div>
  );
}

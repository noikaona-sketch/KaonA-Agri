'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LoadingState } from '@/shared/components/loading-state';

type Warehouse = { id: string; code: string; name: string };
type ClosingLine = {
  warehouse_id: string;
  warehouse_name: string;
  product_id: string | null;
  variety_id: string | null;
  product_name: string;
  unit: string;
  opening_qty: number;
  receive_qty: number;
  out_qty: number;
  transfer_in_qty: number;
  transfer_out_qty: number;
  adjustment_qty: number;
  reserved_qty: number;
  ending_qty: number;
  system_qty_on_hand: number | null;
  variance_qty: number | null;
  movement_count: number;
};
type ClosingPayload = {
  period: { year: number; month: number; start: string; end: string; monthKey: string };
  scope: 'warehouse' | 'all';
  warehouse_id: string | null;
  previous_snapshot: { closing_no: string; period_end: string } | null;
  saved_snapshot: { id: string; closing_no: string; status: string; reviewed_at: string; closed_at: string | null; note: string | null } | null;
  lines: ClosingLine[];
  totals: {
    line_count: number;
    total_opening_qty: number;
    total_receive_qty: number;
    total_out_qty: number;
    total_transfer_in_qty: number;
    total_transfer_out_qty: number;
    total_reserved_qty: number;
    total_ending_qty: number;
  };
};

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function fmt(value: number | null | undefined) {
  if (value == null) return '—';
  return value.toLocaleString('th-TH', { maximumFractionDigits: 2 });
}

export function AdminStockClosingPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [warehouseId, setWarehouseId] = useState('all');
  const [payload, setPayload] = useState<ClosingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [loadingProgress, setLoadingProgress] = useState('กำลังโหลด movement...');
  const loadSeq = useRef(0);

  const selectedWarehouseName = useMemo(() => {
    if (warehouseId === 'all') return 'ทุกคลัง';
    return warehouses.find((w) => w.id === warehouseId)?.name ?? '—';
  }, [warehouseId, warehouses]);

  const load = useCallback(async () => {
    const seq = loadSeq.current + 1;
    loadSeq.current = seq;
    setLoading(true);
    setLoadingProgress('กำลังโหลด movement...');
    setNotice(null);

    const timers = [
      window.setTimeout(() => { if (loadSeq.current === seq) setLoadingProgress('กำลังคำนวณยอดยกมา...'); }, 4000),
      window.setTimeout(() => { if (loadSeq.current === seq) setLoadingProgress('กำลังสร้าง snapshot...'); }, 10000),
      window.setTimeout(() => { if (loadSeq.current === seq) setNotice('กำลังคำนวณนานกว่าปกติ กรุณารอสักครู่'); }, 20000),
    ];

    try {
      const whParam = warehouseId === 'all' ? '' : `&warehouse_id=${encodeURIComponent(warehouseId)}`;
      const [whResponse, closingResponse] = await Promise.all([
        fetch('/api/admin/warehouses', { credentials: 'include' }),
        fetch(`/api/admin/stock-closing?month=${encodeURIComponent(month)}${whParam}`, { credentials: 'include' }),
      ]);
      const [whRes, closingRes] = await Promise.all([
        whResponse.json(),
        closingResponse.json(),
      ]);

      if (loadSeq.current !== seq) return;
      if (!whResponse.ok) throw new Error(whRes.error ?? 'โหลดคลังสินค้าไม่สำเร็จ');
      if (!closingResponse.ok || closingRes.error) throw new Error(closingRes.error ?? 'คำนวณปิดงวดสต๊อกไม่สำเร็จ');

      setWarehouses(whRes.warehouses ?? []);
      setPayload(closingRes);
      setNote(closingRes.saved_snapshot?.note ?? '');
    } catch (error) {
      if (loadSeq.current !== seq) return;
      setPayload(null);
      setNotice(`❌ ${error instanceof Error ? error.message : 'คำนวณปิดงวดสต๊อกไม่สำเร็จ'}`);
    } finally {
      timers.forEach(window.clearTimeout);
      if (loadSeq.current === seq) setLoading(false);
    }
  }, [month, warehouseId]);

  useEffect(() => { void load(); }, [load]);

  async function save(action: 'save_review' | 'close') {
    setSaving(true);
    setNotice(null);
    const slowTimer = window.setTimeout(() => setNotice('กำลังคำนวณนานกว่าปกติ กรุณารอสักครู่'), 20000);
    try {
      const res = await fetch('/api/admin/stock-closing', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          month,
          warehouse_id: warehouseId === 'all' ? null : warehouseId,
          note: note || null,
        }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; status?: string };
      if (!res.ok) {
        setNotice(`❌ ${data.error ?? 'บันทึกไม่สำเร็จ'}`);
        return;
      }
      setNotice(action === 'close' ? '✅ ปิด snapshot สต๊อกแล้ว (ยังไม่บังคับ lock)' : '✅ บันทึก snapshot เพื่อรอ Admin review แล้ว');
      void load();
    } catch (error) {
      setNotice(`❌ ${error instanceof Error ? error.message : 'บันทึกไม่สำเร็จ'}`);
    } finally {
      window.clearTimeout(slowTimer);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {notice && (
          <div style={{ background: '#fff8e1', border: '1px solid #ffcc80', borderRadius: 10, padding: '10px 14px', fontWeight: 700 }}>
            {notice}
          </div>
        )}
        <LoadingState label={loadingProgress} />
      </div>
    );
  }

  if (!payload) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {notice && (
          <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 10, padding: '10px 14px', fontWeight: 700 }}>
            {notice}
          </div>
        )}
        <button className="admin-btn admin-btn--secondary" onClick={load}>🔄 ลองคำนวณใหม่</button>
      </div>
    );
  }

  const canClose = payload.saved_snapshot?.status === 'review';
  const alreadyClosed = payload.saved_snapshot?.status === 'closed';

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 10, padding: '10px 14px', fontWeight: 700 }}>
          {notice}
        </div>
      )}

      <div className="kaona-card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <label className="reg-label">เดือนที่ตรวจ
            <input className="reg-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </label>
          <label className="reg-label">คลังสินค้า
            <select className="reg-input" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="all">ทุกคลัง</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="reg-label">หมายเหตุ Admin review
            <input className="reg-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ตรวจสอบเอกสารแล้ว" />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#4b5563', fontSize: 13 }}>
            <strong>{selectedWarehouseName}</strong> · {payload.period.start} ถึง {payload.period.end} · เปิดจาก {payload.previous_snapshot?.closing_no ?? 'ไม่มีงวดก่อนหน้า'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="admin-btn admin-btn--secondary" onClick={load} disabled={saving}>🔄 คำนวณใหม่</button>
            <button className="admin-btn admin-btn--primary" onClick={() => save('save_review')} disabled={saving || alreadyClosed}>{saving ? 'กำลังบันทึก…' : '💾 บันทึก snapshot รอตรวจ'}</button>
            <button className="admin-btn admin-btn--danger" onClick={() => save('close')} disabled={saving || (!canClose && !alreadyClosed)}>{alreadyClosed ? '✅ ปิดแล้ว' : '🔒 Admin close'}</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {[
          ['ยอดเปิด', payload.totals.total_opening_qty],
          ['รับเข้า', payload.totals.total_receive_qty],
          ['จ่ายออก', payload.totals.total_out_qty],
          ['โอนเข้า', payload.totals.total_transfer_in_qty],
          ['โอนออก', payload.totals.total_transfer_out_qty],
          ['จองสุทธิ', payload.totals.total_reserved_qty],
          ['คงเหลือปลายงวด', payload.totals.total_ending_qty],
        ].map(([label, value]) => (
          <div key={label} className="kaona-card" style={{ padding: 14 }}>
            <p style={{ margin: 0, color: '#6b7280', fontSize: 12 }}>{label}</p>
            <p style={{ margin: '4px 0 0', fontWeight: 900, fontSize: 20 }}>{fmt(Number(value))}</p>
          </div>
        ))}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>สินค้า</th><th>คลัง</th><th>ยอดเปิด</th><th>รับเข้า</th><th>จ่ายออก</th><th>โอนเข้า</th><th>โอนออก</th><th>ปรับปรุง</th><th>จอง</th><th>ปลายงวด</th><th>ในระบบ</th><th>ผลต่าง</th>
            </tr>
          </thead>
          <tbody>
            {payload.lines.length === 0 && <tr><td colSpan={12} style={{ textAlign: 'center', padding: 28, color: '#9ca3af' }}>ไม่มีรายการสำหรับงวดนี้</td></tr>}
            {payload.lines.map((line) => (
              <tr key={`${line.warehouse_id}-${line.product_id ?? line.variety_id}`}>
                <td><strong>{line.product_name}</strong><br /><span style={{ color: '#9ca3af', fontSize: 11 }}>{line.movement_count} movements · {line.unit}</span></td>
                <td>{line.warehouse_name}</td>
                <td>{fmt(line.opening_qty)}</td>
                <td style={{ color: '#1b5e20', fontWeight: 700 }}>{fmt(line.receive_qty)}</td>
                <td style={{ color: '#c62828', fontWeight: 700 }}>{fmt(line.out_qty)}</td>
                <td>{fmt(line.transfer_in_qty)}</td>
                <td>{fmt(line.transfer_out_qty)}</td>
                <td>{fmt(line.adjustment_qty)}</td>
                <td style={{ color: '#e65100' }}>{fmt(line.reserved_qty)}</td>
                <td style={{ fontWeight: 900 }}>{fmt(line.ending_qty)}</td>
                <td>{fmt(line.system_qty_on_hand)}</td>
                <td style={{ fontWeight: 800, color: line.variance_qty === 0 ? '#1b5e20' : '#c62828' }}>{fmt(line.variance_qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

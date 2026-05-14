'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState } from '@/shared/components/loading-state';

type Movement = {
  id: string; movement_type: string;
  qty: number; qty_before: number | null; qty_after: number | null;
  unit: string; ref_type: string | null; note: string | null;
  created_at: string;
  seed_stock_lots: { variety_name: string; lot_no: string }[] | null;
};

const TYPE_CFG: Record<string, { icon: string; label: string; color: string }> = {
  in:     { icon: '📥', label: 'รับเข้า',   color: '#2e7d32' },
  out:    { icon: '📤', label: 'จ่ายออก',   color: '#c62828' },
  adjust: { icon: '🔧', label: 'ปรับยอด',   color: '#1565c0' },
  return: { icon: '↩️', label: 'คืนสินค้า', color: '#e65100' },
};

export function StockMovementPanel() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const s = createSupabaseBrowserClient();
      const start = new Date(dateFilter);
      const end   = new Date(dateFilter);
      end.setDate(end.getDate() + 1);

      const { data } = await s.from('stock_movements')
        .select('id,movement_type,qty,qty_before,qty_after,unit,ref_type,note,created_at,seed_stock_lots(variety_name,lot_no)')
        .gte('created_at', start.toISOString())
        .lt('created_at', end.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      setMovements((data as Movement[]) ?? []);
      setLoading(false);
    })();
  }, [dateFilter]);

  const totalIn  = movements.filter((m) => m.movement_type === 'in').reduce((s, m) => s + m.qty, 0);
  const totalOut = movements.filter((m) => m.movement_type === 'out').reduce((s, m) => s + m.qty, 0);

  return (
    <div>
      <div className="admin-filter-bar">
        <label style={{ fontSize: 13, fontWeight: 600, color: '#4a6741', whiteSpace: 'nowrap' }}>วันที่</label>
        <input type="date" className="admin-select" value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          max={new Date().toISOString().slice(0, 10)} />
        {!loading && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, fontSize: 13 }}>
            <span style={{ color: '#2e7d32', fontWeight: 700 }}>📥 รับเข้า {totalIn.toLocaleString()} ถุง</span>
            <span style={{ color: '#c62828', fontWeight: 700 }}>📤 จ่ายออก {totalOut.toLocaleString()} ถุง</span>
          </div>
        )}
      </div>

      {loading && <LoadingState label="กำลังโหลด…" />}

      {!loading && movements.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: 40 }}>📦</div>
          <p style={{ marginTop: 8 }}>ไม่มีการเคลื่อนไหวในวันนี้</p>
        </div>
      )}

      {!loading && movements.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>เวลา</th><th>พันธุ์ / LOT</th><th>ประเภท</th><th>จำนวน</th><th>ก่อน</th><th>หลัง</th><th>อ้างอิง</th></tr>
            </thead>
            <tbody>
              {movements.map((m) => {
                const cfg = TYPE_CFG[m.movement_type] ?? { icon: '•', label: m.movement_type, color: '#666' };
                const lot = m.seed_stock_lots?.[0];
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      {lot ? (
                        <>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{lot.variety_name}</p>
                          <p style={{ margin: 0, fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>LOT: {lot.lot_no}</p>
                        </>
                      ) : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: cfg.color + '18', color: cfg.color }}>
                        {cfg.icon} {cfg.label}
                      </span>
                    </td>
                    <td style={{ fontWeight: 800, color: cfg.color }}>
                      {m.movement_type === 'out' ? '-' : '+'}{m.qty.toLocaleString()} {m.unit}
                    </td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{m.qty_before?.toLocaleString() ?? '—'}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{m.qty_after?.toLocaleString() ?? '—'}</td>
                    <td style={{ fontSize: 12, color: '#6b7280' }}>{m.ref_type ?? '—'}</td>
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

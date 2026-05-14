'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';
import { LoadingState } from '@/shared/components/loading-state';

type SaleRecord = {
  id: string; appointment_number: string;
  crop_name: string; season_year: number;
  scheduled_date: string | null;
  estimated_qty_kg: number; actual_qty_kg: number | null;
  price_per_kg: number; total_amount: number | null;
  status: string; payment_status: string; paid_amount: number;
  quality_moisture: number | null; quality_grade: string | null; quality_note: string | null;
  quality_recorded_at: string | null;
  created_at: string;
};

const GRADE_CFG: Record<string, { bg: string; color: string; label: string }> = {
  A:      { bg: '#e8f5e9', color: '#1b5e20', label: 'เกรด A' },
  B:      { bg: '#e3f2fd', color: '#1565c0', label: 'เกรด B' },
  C:      { bg: '#fff8e1', color: '#e65100', label: 'เกรด C' },
  reject: { bg: '#ffebee', color: '#c62828', label: 'ปฏิเสธ' },
};

const STATUS_CFG: Record<string, { icon: string; label: string; color: string }> = {
  scheduled:  { icon: '📅', label: 'นัดแล้ว',   color: '#1565c0' },
  confirmed:  { icon: '✅', label: 'ยืนยัน',    color: '#2e7d32' },
  completed:  { icon: '💰', label: 'ขายแล้ว',   color: '#1b5e20' },
  cancelled:  { icon: '❌', label: 'ยกเลิก',    color: '#c62828' },
};

export function SaleHistory() {
  const member = useCurrentMember();
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('member_sale_history')
        .select('*').eq('member_id', member.member_id).limit(50);
      setRecords((data as SaleRecord[]) ?? []);
      setLoading(false);
    })();
  }, [member?.member_id]);

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  if (records.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af' }}>
        <div style={{ fontSize: 48 }}>🌽</div>
        <p style={{ margin: '8px 0 0' }}>ยังไม่มีประวัติการขาย</p>
      </div>
    );
  }

  const totalEarned = records
    .filter((r) => r.status === 'completed')
    .reduce((s, r) => s + (r.total_amount ?? 0), 0);

  return (
    <div className="mobile-stack">
      {/* summary */}
      <div className="kaona-card" style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.85 }}>รายได้รวมจากการขาย</p>
        <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 900 }}>
          {totalEarned.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
        </p>
        <p style={{ margin: '2px 0 0', fontSize: 13, opacity: 0.85 }}>{records.filter((r) => r.status === 'completed').length} รายการที่ขายสำเร็จ</p>
      </div>

      {records.map((r) => {
        const st  = STATUS_CFG[r.status] ?? STATUS_CFG.scheduled;
        const grd = r.quality_grade ? GRADE_CFG[r.quality_grade] : null;
        return (
          <div key={r.id} className="kaona-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>🌽 {r.crop_name} {r.season_year}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280', fontFamily: 'monospace' }}>{r.appointment_number}</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.color + '18', color: st.color, whiteSpace: 'nowrap', height: 'fit-content' }}>
                {st.icon} {st.label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div style={{ background: '#f7faf7', borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>ปริมาณขาย</p>
                <p style={{ margin: '2px 0 0', fontWeight: 700 }}>
                  {(r.actual_qty_kg ?? r.estimated_qty_kg).toLocaleString()} กก.
                  {!r.actual_qty_kg && <span style={{ fontSize: 11, color: '#9ca3af' }}> (ประมาณ)</span>}
                </p>
              </div>
              <div style={{ background: '#f7faf7', borderRadius: 10, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>ราคา/กก.</p>
                <p style={{ margin: '2px 0 0', fontWeight: 700 }}>{r.price_per_kg.toFixed(2)} บาท</p>
              </div>
            </div>

            {/* ยอดเงิน */}
            {r.total_amount && (
              <div style={{ background: '#e8f5e9', borderRadius: 10, padding: '8px 12px', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>💰 ยอดเงิน</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#1b5e20' }}>
                  {r.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท
                </span>
              </div>
            )}

            {/* คุณภาพ */}
            {r.quality_grade && grd && (
              <div style={{ background: grd.bg, border: `1px solid ${grd.color}44`, borderRadius: 10, padding: '8px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: grd.color }}>🔬 คุณภาพสินค้า</p>
                    <p style={{ margin: '2px 0 0', fontSize: 13, color: grd.color }}>
                      {r.quality_moisture != null ? `ความชื้น ${r.quality_moisture}%` : ''}
                      {r.quality_note ? ` · ${r.quality_note}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 22, fontWeight: 900, color: grd.color }}>{r.quality_grade}</span>
                </div>
              </div>
            )}

            {r.scheduled_date && (
              <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9ca3af' }}>
                📅 {new Date(r.scheduled_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

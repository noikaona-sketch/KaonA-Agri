'use client';

// ─────────────────────────────────────────────────────────────────────────────
// MemberHarvestHistory — P2 PR11
// Admin-only read-only view of a member's harvest booking history.
// No scoring, no penalties, no blacklist, no economics.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState }         from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { LoadingState }                from '@/shared/components/loading-state';
import { ErrorState }                  from '@/shared/components/error-state';
import { HarvestEmptyState }           from './harvest-data-quality';

type HistoryRow = {
  id:                     string;
  scheduled_date:         string;
  actual_completed_at:    string | null;
  status:                 string;
  plot_name:              string;
  crop_name:              string;
  actual_yield_kg:        number | null;
  actual_received_kg:     number | null;
  estimated_moisture_pct: number | null;
  actual_moisture_pct:    number | null;
  admin_note:             string | null;
};

const STATUS_TH: Record<string, { label: string; color: string }> = {
  pending:   { label: '⏳ รอ',        color: '#e65100' },
  confirmed: { label: '✅ ยืนยัน',    color: '#2e7d32' },
  completed: { label: '🏁 เสร็จ',     color: '#1b5e20' },
  cancelled: { label: '⛔ ยกเลิก',      color: '#9e9e9e' },
  no_show:   { label: '⚠️ ไม่มาตามนัด', color: '#b45309' },
};

function varPct(est: number | null, act: number | null): string | null {
  if (!est || !act) return null;
  return ((act - est) / est * 100).toFixed(1) + '%';
}

// ── Summary panel ─────────────────────────────────────────────────────────────
function HistorySummary({ rows }: { rows: HistoryRow[] }) {
  const completed  = rows.filter((r) => r.status === 'completed');
  const cancelled  = rows.filter((r) => r.status === 'cancelled').length;
  const active     = rows.filter((r) => r.status === 'pending' || r.status === 'confirmed').length;
  const totalKg    = completed.reduce((s, r) => s + (r.actual_received_kg ?? 0), 0);
  const moistures  = completed.map((r) => r.actual_moisture_pct).filter((v): v is number => v != null);
  const avgMoist   = moistures.length ? (moistures.reduce((s, v) => s + v, 0) / moistures.length).toFixed(1) : null;
  const latestDate = completed.sort((a, b) =>
    (b.actual_completed_at ?? '').localeCompare(a.actual_completed_at ?? ''),
  )[0]?.actual_completed_at ?? null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
      {[
        { label: 'เสร็จสิ้น',    value: completed.length,                       color: '#2e7d32' },
        { label: 'ไม่มาตามนัด',  value: rows.filter((r) => r.status === 'no_show').length, color: '#b45309' },
        { label: 'ยกเลิก',       value: cancelled,                              color: '#9e9e9e' },
        { label: 'รอดำเนินการ', value: active,                                  color: '#e65100' },
        { label: 'รับจริงรวม',  value: totalKg > 0 ? `${totalKg.toLocaleString()} กก.` : '—', color: '#1b5e20' },
        { label: 'ความชื้นเฉลี่ย', value: avgMoist ? `${avgMoist}%` : '—',    color: '#1565c0' },
        { label: 'ล่าสุด',      value: latestDate ? new Date(latestDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '—', color: '#374151' },
      ].map((s) => (
        <div key={s.label} style={{
          background: '#f9fafb', borderRadius: 8,
          padding: '8px 10px', border: `1px solid ${s.color}22`,
        }}>
          <p style={{ margin: 0, fontSize: 10, color: '#6b7280' }}>{s.label}</p>
          <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 14, color: s.color }}>{String(s.value)}</p>
        </div>
      ))}
    </div>
  );
}

// ── History table ─────────────────────────────────────────────────────────────
function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) return <HarvestEmptyState message="ยังไม่มีประวัติการจองเกี่ยว" />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>วันเกี่ยว</th><th>วันเสร็จ</th><th>สถานะ</th>
            <th>แปลง / พืช</th><th>น้ำหนักประมาณ</th><th>น้ำหนักจริง</th>
            <th>ต่าง%</th><th>ชื้น%ประมาณ</th><th>ชื้น%จริง</th><th>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st  = STATUS_TH[r.status] ?? { label: r.status, color: '#6b7280' };
            const kgV = varPct(r.actual_yield_kg, r.actual_received_kg);
            return (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                  {new Date(r.scheduled_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: '#6b7280' }}>
                  {r.actual_completed_at ? new Date(r.actual_completed_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '—'}
                </td>
                <td>
                  <span style={{ fontSize: 11, fontWeight: 700, color: st.color, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>
                  <p style={{ margin: 0 }}>{r.plot_name}</p>
                  <p style={{ margin: 0, color: '#9ca3af', fontSize: 11 }}>{r.crop_name}</p>
                </td>
                <td style={{ fontSize: 12 }}>{r.actual_yield_kg ? `${r.actual_yield_kg.toLocaleString()}` : '—'}</td>
                <td style={{ fontSize: 12, fontWeight: r.actual_received_kg ? 700 : 400 }}>
                  {r.actual_received_kg ? `${r.actual_received_kg.toLocaleString()}` : '—'}
                </td>
                <td style={{ fontSize: 12, color: kgV ? (kgV.startsWith('-') ? '#c62828' : '#2e7d32') : '#9ca3af' }}>
                  {kgV ?? '—'}
                </td>
                <td style={{ fontSize: 12 }}>{r.estimated_moisture_pct ?? '—'}</td>
                <td style={{ fontSize: 12, fontWeight: r.actual_moisture_pct ? 600 : 400 }}>
                  {r.actual_moisture_pct ? `${r.actual_moisture_pct}%` : '—'}
                </td>
                <td style={{ fontSize: 11, color: '#6b7280', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.admin_note ?? '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type Props = {
  memberId:   string;
  memberName: string;
  onClose:    () => void;
};

export function MemberHarvestHistory({ memberId, memberName, onClose }: Props) {
  const [rows,    setRows]    = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data, error: err } = await s
        .from('harvest_bookings_full')
        .select(
          'id,scheduled_date,actual_completed_at,status,plot_name,crop_name,' +
          'actual_yield_kg,actual_received_kg,estimated_moisture_pct,actual_moisture_pct,admin_note',
        )
        .eq('member_id', memberId)
        .order('scheduled_date', { ascending: false })
        .limit(100);
      if (err) setError(err.message);
      else setRows((data as unknown as HistoryRow[]) ?? []);
      setLoading(false);
    })();
  }, [memberId]);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', padding: '20px 8px', overflowY: 'auto',
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 900,
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: '#1b5e20', padding: '14px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#fff' }}>
            🌾 ประวัติการจองเกี่ยว — {memberName}
          </p>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#fff',
            fontSize: 20, cursor: 'pointer', lineHeight: 1,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px' }}>
          {loading && <LoadingState label="กำลังโหลดประวัติ…" />}
          {error   && <ErrorState title="โหลดไม่สำเร็จ" detail={error} />}
          {!loading && !error && (
            <>
              <HistorySummary rows={rows} />
              <HistoryTable rows={rows} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

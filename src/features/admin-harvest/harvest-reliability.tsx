'use client';

// ─────────────────────────────────────────────────────────────────────────────
// Harvest Booking Reliability — P2 PR9
//
// Admin-only visibility. Lightweight operational history.
// No financial credit, no penalties, no blacklist, no AI, no auto-rejection.
//
// NOTE: harvest_bookings has no 'no_show' status in current schema.
//       'cancelled' is used as a proxy for unreliability until a dedicated
//       no_show status or reason column is added in a future migration.
//       Reliability calculation is operational guidance only — not a penalty.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState }         from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ── Types ─────────────────────────────────────────────────────────────────────
export type ReliabilityStats = {
  completed:  number;
  cancelled:  number;
  pending:    number;
  total:      number;
  cancelRate: number; // 0–100
};

export type ReliabilityLevel = 'ดี' | 'เฝ้าระวัง' | 'เสี่ยง';

// ── Calculation ───────────────────────────────────────────────────────────────
export function getReliabilityLevel(stats: ReliabilityStats): ReliabilityLevel {
  if (stats.total === 0) return 'ดี';
  if (stats.cancelRate <= 10) return 'ดี';
  if (stats.cancelRate <= 30) return 'เฝ้าระวัง';
  return 'เสี่ยง';
}

const LEVEL_STYLE: Record<ReliabilityLevel, { color: string; bg: string; icon: string }> = {
  'ดี':         { color: '#2e7d32', bg: '#f0fdf4', icon: '✅' },
  'เฝ้าระวัง': { color: '#e65100', bg: '#fff3e0', icon: '⚠️' },
  'เสี่ยง':     { color: '#c62828', bg: '#ffebee', icon: '🔴' },
};

// ── Badge (compact — for queue row) ──────────────────────────────────────────
export function ReliabilityBadge({ stats }: { stats: ReliabilityStats }) {
  if (stats.total === 0) return null;
  const level = getReliabilityLevel(stats);
  const st    = LEVEL_STYLE[level];
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
      background: st.bg, color: st.color, border: `1px solid ${st.color}33`,
      whiteSpace: 'nowrap',
    }}>
      {st.icon} {level} ({stats.cancelRate}% ยกเลิก)
    </span>
  );
}

// ── Summary card (for member booking detail) ──────────────────────────────────
export function ReliabilitySummaryCard({ stats }: { stats: ReliabilityStats }) {
  if (stats.total === 0) return null;
  const level = getReliabilityLevel(stats);
  const st    = LEVEL_STYLE[level];
  return (
    <div style={{
      background: st.bg, borderRadius: 10,
      padding: '10px 14px', border: `1px solid ${st.color}33`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: st.color }}>
          {st.icon} ความน่าเชื่อถือ: {level}
        </p>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          ยกเลิก {stats.cancelRate}%
        </span>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        {[
          { label: 'เสร็จสิ้น', value: stats.completed, color: '#2e7d32' },
          { label: 'ยกเลิก',   value: stats.cancelled,  color: '#c62828' },
          { label: 'รอดำเนินการ', value: stats.pending, color: '#e65100' },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 18, color: s.color }}>
              {s.value}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: '#6b7280' }}>{s.label}</p>
          </div>
        ))}
      </div>
      <p style={{ margin: '8px 0 0', fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
        * ยกเลิก = proxy สำหรับการไม่มาตามนัด — ไม่ใช่ค่าปรับ
      </p>
    </div>
  );
}

// ── Hook: fetch stats for a member ───────────────────────────────────────────
export function useMemberReliability(memberId: string | null): {
  stats: ReliabilityStats | null;
  loading: boolean;
} {
  const [stats,   setStats]   = useState<ReliabilityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!memberId) { setLoading(false); return; }
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s
        .from('harvest_bookings')
        .select('status')
        .eq('member_id', memberId);
      if (!data) { setLoading(false); return; }
      const completed = data.filter((r) => r.status === 'completed').length;
      const cancelled = data.filter((r) => r.status === 'cancelled').length;
      const pending   = data.filter((r) => r.status === 'pending' || r.status === 'confirmed').length;
      const total     = data.length;
      const cancelRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
      setStats({ completed, cancelled, pending, total, cancelRate });
      setLoading(false);
    })();
  }, [memberId]);

  return { stats, loading };
}

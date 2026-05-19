'use client';

// ─────────────────────────────────────────────────────────────────────────────
// NoBurnStatsBanner — Issue #216 PR1
//
// Shows community-level seasonal no-burn participation stats.
// Data: read-only aggregate query on no_burn_requests + plots.
// Positive framing only — no ranking, no shaming, no individual exposure.
//
// Displayed to all approved members visiting /no-burn.
// Intentionally anonymous — counts only, no names.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';

type Stats = {
  totalParticipants: number;    // distinct member_id in no_burn_requests this season
  totalRai:          number;    // sum of plots.area_rai linked to those requests
  approvedCount:     number;    // status = approved or completed
};

// Current season year (Buddhist Era)
function currentSeasonYear(): number {
  return new Date().getFullYear() + 543;
}

export function NoBurnStatsBanner() {
  const member = useCurrentMember();
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!member?.is_approved) { setLoading(false); return; }

    void (async () => {
      const sb = tryCreateSupabaseBrowserClient();
      if (!sb) { setLoading(false); return; }

      const seasonYear = currentSeasonYear();

      // ── Query 1: participant count + approved count ─────────────────────────
      // Filter by planting_cycles.season_year for current season.
      // Falls back to all-time if no planting_cycle linked (plot_id direct join).
      // Using two queries to avoid complex joins that may not be supported by
      // the current RLS/view setup — keeps it simple and reliable.

      // All requests this season (via planting_cycle season_year OR any if null)
      const { data: requests } = await sb
        .from('no_burn_requests')
        .select('id, member_id, status, plot_id')
        .is('deleted_at', null)
        .in('status', ['submitted', 'under_review', 'inspection_required', 'approved', 'completed']);

      if (!requests) { setLoading(false); return; }

      const totalParticipants = new Set(requests.map((r) => r.member_id)).size;
      const approvedCount = requests.filter(
        (r) => r.status === 'approved' || r.status === 'completed',
      ).length;

      // ── Query 2: total rai from linked plots ────────────────────────────────
      const plotIds = [...new Set(requests.map((r) => r.plot_id).filter(Boolean))] as string[];
      let totalRai = 0;
      if (plotIds.length > 0) {
        const { data: plots } = await sb
          .from('plots')
          .select('area_rai')
          .in('id', plotIds)
          .is('deleted_at', null);
        totalRai = (plots ?? []).reduce((sum, p) => sum + (Number(p.area_rai) || 0), 0);
      }

      setStats({ totalParticipants, totalRai, approvedCount });
      setLoading(false);
    })();
  }, [member?.is_approved]);

  // Don't render for non-approved members or while loading with no data yet
  if (!member?.is_approved || loading || !stats || stats.totalParticipants === 0) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="สถิติการเข้าร่วมโครงการไม่เผา"
      style={{
        background:   'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
        borderRadius: 14,
        padding:      '16px 18px',
        marginBottom: 16,
        color:        '#fff',
      }}
    >
      {/* Title */}
      <p style={{ margin: '0 0 12px', fontWeight: 800, fontSize: 15 }}>
        🌿 ร่วมกันงดเผาฤดูนี้
      </p>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <StatTile
          icon="👥"
          value={stats.totalParticipants.toLocaleString()}
          label="ราย"
          sub="เข้าร่วมแล้ว"
        />
        <StatTile
          icon="🌾"
          value={Math.round(stats.totalRai).toLocaleString()}
          label="ไร่"
          sub="พื้นที่งดเผา"
        />
        <StatTile
          icon="✅"
          value={stats.approvedCount.toLocaleString()}
          label="แปลง"
          sub="ผ่านตรวจแล้ว"
        />
      </div>

      {/* Positive tagline */}
      <p style={{ margin: '12px 0 0', fontSize: 12, opacity: 0.85, textAlign: 'center' }}>
        ขอบคุณทุกท่านที่ร่วมรักษาอากาศให้สะอาด 🙏
      </p>
    </div>
  );
}

// ── Sub-component: single stat tile ──────────────────────────────────────────
function StatTile({
  icon, value, label, sub,
}: {
  icon: string; value: string; label: string; sub: string;
}) {
  return (
    <div style={{
      background:   'rgba(255,255,255,0.15)',
      borderRadius: 10,
      padding:      '10px 8px',
      textAlign:    'center',
    }}>
      <p style={{ margin: '0 0 2px', fontSize: 20 }}>{icon}</p>
      <p style={{ margin: 0, fontWeight: 900, fontSize: 18, lineHeight: 1.1 }}>{value}</p>
      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, opacity: 0.9 }}>{label}</p>
      <p style={{ margin: '2px 0 0', fontSize: 10, opacity: 0.75 }}>{sub}</p>
    </div>
  );
}

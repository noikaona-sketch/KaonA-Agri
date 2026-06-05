'use client';
// MasterpieceBanner — compact entry point ใน PlotCard
// แสดงผลล่าสุด + ปุ่มกดเข้าหน้าเต็ม

import { useEffect, useState } from 'react';
import Link                    from 'next/link';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type LastAnalysis = {
  id: string; ai_grade: string; ai_summary: string;
  analyzed_at: string; storage_path: string;
};

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

const GRADE_CFG = {
  great:   { emoji: '🌟', label: 'ดีมาก!',      color: '#1b5e20', bg: '#e8f5e9', border: '#a5d6a7' },
  good:    { emoji: '✅', label: 'ดี',           color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  warning: { emoji: '⚠️', label: 'ระวังหน่อย',  color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  alert:   { emoji: '🚨', label: 'ต้องแก้ด่วน', color: '#9f1239', bg: '#fff1f2', border: '#fda4af' },
};

function relDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 60)   return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 1440)} วันที่แล้ว`;
}

export function MasterpieceBanner({
  plotId, cycleId,
}: {
  plotId: string;
  cycleId: string | null;
}) {
  const [last, setLast] = useState<LastAnalysis | null>(null);

  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) return;
    // Query by plot_id OR cycle_id to catch all historical photos
    let q = sb.from('crop_photo_analyses')
      .select('id,ai_grade,ai_summary,analyzed_at,storage_path')
      .order('analyzed_at', { ascending: false })
      .limit(1);
    if (cycleId) {
      q = q.or(`plot_id.eq.${plotId},planting_cycle_id.eq.${cycleId}`);
    } else {
      q = q.eq('plot_id', plotId);
    }
    void q.then(({ data }) => setLast((data as LastAnalysis[])?.[0] ?? null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plotId, cycleId]);

  const href = `/plots/${plotId}/masterpiece`;

  // ── Has previous result ────────────────────────────────────────────────────
  if (last) {
    const g = GRADE_CFG[last.ai_grade as keyof typeof GRADE_CFG] ?? GRADE_CFG.good;
    const sb = tryCreateSupabaseBrowserClient();
    const thumbUrl = sb
      ? sb.storage.from(EVIDENCE_BUCKET).getPublicUrl(last.storage_path).data.publicUrl
      : '';

    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{
          margin: '0', padding: '12px 16px',
          borderTop: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', gap: 10,
          background: g.bg,
        }}>
          {/* Thumbnail */}
          {thumbUrl && (
            <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: `2px solid ${g.border}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
          {/* Text */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>{g.emoji}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: g.color }}>🏆 ผลงานชิ้นเอก — {g.label}</span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {last.ai_summary} · {relDate(last.analyzed_at)}
            </p>
          </div>
          <span style={{ color: '#9ca3af', fontSize: 16, flexShrink: 0 }}>›</span>
        </div>
      </Link>
    );
  }

  // ── No result yet ──────────────────────────────────────────────────────────
  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        margin: '0', padding: '12px 16px',
        borderTop: '1px solid #f3f4f6',
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#f9fafb',
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 24 }}>📸</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#1b5e20' }}>🏆 ผลงานชิ้นเอก</p>
          <p style={{ margin: '1px 0 0', fontSize: 12, color: '#9ca3af' }}>ถ่ายรูปแปลง ให้ AI วิเคราะห์ให้ →</p>
        </div>
        <span style={{ color: '#9ca3af', fontSize: 16, flexShrink: 0 }}>›</span>
      </div>
    </Link>
  );
}


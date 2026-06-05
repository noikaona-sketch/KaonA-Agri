'use client';
// MasterpieceBanner — compact entry point ใน PlotCard
// ดึงประวัติผ่าน API route (รองรับ CASE B members ที่ไม่มี browser session)

import { useEffect, useState } from 'react';
import Link                    from 'next/link';
import { useCurrentMember }    from '@/providers/auth-provider';
import { getAuthHeaders }      from '@/lib/auth/get-auth-headers';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type LastAnalysis = {
  id: string; ai_grade: string; ai_summary: string;
  analyzed_at: string; storage_path: string;
};

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

const GRADE_CFG = {
  great:   { emoji: '🌟', label: 'เจ๋งมาก!',        color: '#1b5e20', bg: '#e8f5e9', border: '#a5d6a7' },
  good:    { emoji: '✅', label: 'ดูดีนะ',           color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  warning: { emoji: '⚠️', label: 'ระวังหน่อย',       color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  alert:   { emoji: '🚨', label: 'อันนี้เลี้ยงไม่โตนะ', color: '#9f1239', bg: '#fff1f2', border: '#fda4af' },
  pending: { emoji: '⏳', label: 'รอวิเคราะห์',      color: '#6b7280', bg: '#f8fafc', border: '#e5e7eb' },
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
  const member = useCurrentMember();
  const [last, setLast] = useState<LastAnalysis | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!member?.member_id || tried) return;
    setTried(true);

    void (async () => {
      // ใช้ API route เพื่อรองรับ CASE B members (ไม่มี browser session)
      const { headers, url } = await getAuthHeaders(
        member,
        `/api/member/crop-photo-analysis?plot_id=${plotId}${cycleId ? `&planting_cycle_id=${cycleId}` : ''}&limit=1`
      );
      try {
        const res  = await fetch(url, { headers });
        if (!res.ok) return;
        const data = (await res.json()) as { analyses?: LastAnalysis[] };
        setLast(data.analyses?.[0] ?? null);
      } catch { /* silent */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.member_id, plotId, cycleId]);

  const href = `/plots/${plotId}/masterpiece`;

  if (last) {
    const g   = GRADE_CFG[last.ai_grade as keyof typeof GRADE_CFG] ?? GRADE_CFG.good;
    const sb  = tryCreateSupabaseBrowserClient();
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
          {thumbUrl && (
            <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: `2px solid ${g.border}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
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

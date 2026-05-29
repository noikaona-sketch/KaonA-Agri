'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

// ─────────────────────────────────────────────────────────────────────────────
// Types & config
// ─────────────────────────────────────────────────────────────────────────────
type Request = {
  id:           string;
  status:       string;
  timing:       'before_planting' | 'after_planting' | null;
  submitted_at: string;
  plots:        { name: string }[] | null;
};

const STATUS_CFG: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
  submitted:           { icon: '⏳', label: 'รอตรวจสอบ',     color: '#633806', bg: '#FAEEDA', border: '#854F0B' },
  under_review:        { icon: '🔍', label: 'กำลังตรวจสอบ',   color: '#0C447C', bg: '#E6F1FB', border: '#185FA5' },
  inspection_required: { icon: '📋', label: 'นัดตรวจแปลง',    color: '#3C3489', bg: '#EEEDFE', border: '#534AB7' },
  approved:            { icon: '✅', label: 'อนุมัติแล้ว',     color: '#27500A', bg: '#EAF3DE', border: '#3B6D11' },
  completed:           { icon: '🏁', label: 'เสร็จสิ้น',       color: '#27500A', bg: '#EAF3DE', border: '#3B6D11' },
  rejected:            { icon: '⛔', label: 'ไม่ผ่าน',         color: '#444441', bg: '#F1EFE8', border: '#5F5E5A' },
  anomaly:             { icon: '⚠️', label: 'พบเหตุผิดปกติ',  color: '#633806', bg: '#FAEEDA', border: '#854F0B' },
  seeking_support:     { icon: '🤝', label: 'รับคำแนะนำ',     color: '#0C447C', bg: '#E6F1FB', border: '#185FA5' },
};

const TIMING_LABEL: Record<string, string> = {
  before_planting: '🌱 ก่อนลงแปลง',
  after_planting:  '🌿 หลังลงแปลง',
};

// ─────────────────────────────────────────────────────────────────────────────
export function NoBurnStatusWidget({ memberId }: { memberId: string }) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    if (!memberId) return;
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoading(false); return; }
    void sb
      .from('no_burn_requests')
      .select('id,status,timing,submitted_at,plots(name)')
      .eq('member_id', memberId)
      .is('deleted_at', null)
      .order('submitted_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setRequests((data as Request[]) ?? []);
        setLoading(false);
      });
  }, [memberId]);

  // ── No requests yet — show soft nudge ──────────────────────────────────────
  if (!loading && requests.length === 0) {
    return (
      <Link href="/no-burn" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', borderRadius: 12,
          background: '#f0fdf4', border: '1.5px dashed #86efac',
          marginTop: 8,
        }}>
          <span style={{ fontSize: 20 }}>🌿</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>ยังไม่ได้ลงทะเบียน</p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: '#6b7280' }}>แตะเพื่อยื่นคำของดเผา รับโบนัส +100 ฿/ตัน</p>
          </div>
          <span style={{ color: '#2e7d32', fontSize: 16, fontWeight: 700 }}>›</span>
        </div>
      </Link>
    );
  }

  // ── Has requests — show status cards ──────────────────────────────────────
  if (loading) return null; // silent — don't flash skeleton inside menu group

  return (
    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {requests.map((req) => {
        const cfg      = STATUS_CFG[req.status] ?? STATUS_CFG.submitted;
        const plotName = req.plots?.[0]?.name ?? '—';
        const daysSince = Math.floor((Date.now() - new Date(req.submitted_at).getTime()) / 86400000);
        const dateLabel = daysSince === 0 ? 'วันนี้'
                        : daysSince === 1 ? 'เมื่อวาน'
                        : `${daysSince} วันที่แล้ว`;

        return (
          <Link key={req.id} href="/no-burn" style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 12,
              background: cfg.bg, border: `1px solid ${cfg.border}55`,
            }}>
              {/* status icon bubble */}
              <div style={{
                width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                background: `${cfg.border}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17,
              }}>
                {cfg.icon}
              </div>

              {/* text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: cfg.color }}>
                    {cfg.label}
                  </p>
                  {req.timing && (
                    <span style={{ fontSize: 10, color: cfg.color, opacity: 0.75 }}>
                      · {TIMING_LABEL[req.timing]}
                    </span>
                  )}
                </div>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  แปลง {plotName} · {dateLabel}
                </p>
              </div>

              <span style={{ color: cfg.border, fontSize: 14, flexShrink: 0 }}>›</span>
            </div>
          </Link>
        );
      })}

      {/* see all link when more than shown */}
      <Link href="/no-burn" style={{
        textAlign: 'center', fontSize: 11, color: '#6b7280',
        textDecoration: 'none', padding: '4px 0',
        display: 'block',
      }}>
        ดูทั้งหมด →
      </Link>
    </div>
  );
}

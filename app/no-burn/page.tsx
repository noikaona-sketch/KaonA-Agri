'use client';

import { useEffect, useState } from 'react';
import { useCurrentMember } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type NoBurnRequest = {
  id: string; status: string; submitted_at: string; review_note: string | null;
  plots: { name: string } | null;
};

const STATUS_COLOR: Record<string, { bg: string; color: string; label: string }> = {
  submitted:  { bg: '#fff8e1', color: '#e65100', label: '⏳ รอตรวจสอบ' },
  approved:   { bg: '#e8f5e9', color: '#2e7d32', label: '✅ อนุมัติ' },
  rejected:   { bg: '#ffebee', color: '#c62828', label: '❌ ไม่อนุมัติ' },
  inspecting: { bg: '#e3f2fd', color: '#1565c0', label: '🔍 กำลังตรวจ' },
};

export default function NoBurnPage() {
  const member = useCurrentMember();
  const [requests, setRequests] = useState<NoBurnRequest[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!member?.id) return;
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s
        .from('no_burn_requests')
        .select('id,status,submitted_at,review_note,plots(name)')
        .eq('member_id', member.id)
        .order('submitted_at', { ascending: false });
      setRequests((data as NoBurnRequest[]) ?? []);
      setLoading(false);
    })();
  }, [member?.id]);

  return (
    <MobileAppShell title="งดเผา" subtitle="ยื่นคำขอและดูสถานะการอนุมัติ">
      <div className="mobile-stack">
        {/* ข้อมูล */}
        <div className="kaona-card" style={{ background: '#e8f5e9', borderColor: '#a5d6a7' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: '#1b5e20' }}>🌿 ทำไมต้องงดเผา?</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#4a6741', lineHeight: 1.6 }}>
            การงดเผาตอซังช่วยรักษาหน้าดิน เพิ่มอินทรียวัตถุ และลดมลพิษทางอากาศ
            สมาชิกที่งดเผาได้รับสิทธิ์พิเศษในการสั่งซื้อเมล็ดพันธุ์
          </p>
        </div>

        {loading && <LoadingState label="กำลังโหลด…" />}

        {!loading && requests.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48 }}>🌾</div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: '8px 0' }}>
              ยังไม่มีคำของดเผา
            </p>
          </div>
        )}

        {requests.map((req) => {
          const st = STATUS_COLOR[req.status] ?? { bg: '#f5f5f5', color: '#666', label: req.status };
          return (
            <div key={req.id} className="kaona-card" style={{ background: st.bg, borderColor: st.color + '66' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
                    {req.plots?.name ?? 'แปลงไม่ระบุ'}
                  </p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
                    ยื่นเมื่อ {new Date(req.submitted_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {req.review_note && (
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: st.color }}>
                      หมายเหตุ: {req.review_note}
                    </p>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: st.color + '22', color: st.color, whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {st.label}
                </span>
              </div>
            </div>
          );
        })}

        <UIButton fullWidth variant="secondary">
          + ยื่นคำของดเผาใหม่
        </UIButton>
      </div>
    </MobileAppShell>
  );
}

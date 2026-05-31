'use client';

import { useEffect, useState } from 'react';
import { useCurrentMember }    from '@/providers/auth-provider';
import { MobileAppShell }      from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }      from '@/shared/components/protected-route';
import { LoadingState }        from '@/shared/components/loading-state';

type CreditSummary = { balance: number; used: number; limit: number; transactions: { id: string; type: string; amount: number; note: string | null; created_at: string }[] };

function CreditContent() {
  const member = useCurrentMember();
  const [data, setData]     = useState<CreditSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!member?.member_id) return;
    void fetch(`/api/member/credit?member_id=${member.member_id}`)
      .then(r => r.json()).then((j: { credit?: CreditSummary }) => { setData(j.credit ?? null); setLoading(false); });
  }, [member?.member_id]);

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <MobileAppShell title="💳 เครดิต" subtitle="ยอดเครดิตและประวัติการใช้งาน">
      <div className="mobile-stack">
        {data ? (
          <>
            <div style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', borderRadius: 18, padding: '20px', color: '#fff' }}>
              <p style={{ margin: '0 0 4px', fontSize: 12, opacity: 0.8 }}>ยอดเครดิตคงเหลือ</p>
              <p style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>{data.balance.toLocaleString()} ฿</p>
              <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                <div><p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>วงเงิน</p><p style={{ margin: 0, fontWeight: 700 }}>{data.limit.toLocaleString()} ฿</p></div>
                <div><p style={{ margin: 0, fontSize: 11, opacity: 0.7 }}>ใช้ไปแล้ว</p><p style={{ margin: 0, fontWeight: 700 }}>{data.used.toLocaleString()} ฿</p></div>
              </div>
            </div>
            <p style={{ margin: '4px 0', fontWeight: 800, fontSize: 14 }}>ประวัติการใช้งาน</p>
            {(data.transactions ?? []).length === 0 && (
              <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>ยังไม่มีรายการ</p>
            )}
            {(data.transactions ?? []).map(tx => (
              <div key={tx.id} style={{ background: '#fff', borderRadius: 12, padding: '12px 16px', border: '1px solid #e8ede8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{tx.note ?? tx.type}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
                    {new Date(tx.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </p>
                </div>
                <span style={{ fontSize: 15, fontWeight: 800, color: tx.amount >= 0 ? '#2e7d32' : '#c62828' }}>
                  {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString()} ฿
                </span>
              </div>
            ))}
          </>
        ) : (
          <p style={{ fontSize: 14, color: '#9ca3af', textAlign: 'center', padding: '40px 0' }}>ยังไม่มีข้อมูลเครดิต</p>
        )}
      </div>
    </MobileAppShell>
  );
}

export default function CreditPage() {
  return <ProtectedRoute><CreditContent /></ProtectedRoute>;
}

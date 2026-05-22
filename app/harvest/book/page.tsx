'use client';

import { useRouter }                    from 'next/navigation';
import { useEffect, useState }          from 'react';
import { MobileAppShell }               from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }               from '@/shared/components/protected-route';
import { MemberHarvestBookingForm }     from '@/features/member-harvest/harvest-booking-form';
import { useCurrentMember }             from '@/providers/auth-provider';
import { createSupabaseBrowserClient }  from '@/lib/supabase/client';

type Cycle = { id: string; crop_name: string; season_year: number };

const BOOKABLE = ['planted','growing','flowering','maturing','fruiting','ready'];

function BookContent() {
  const router   = useRouter();
  const member   = useCurrentMember();
  const [cycles, setCycles]   = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState('');

  useEffect(() => {
    if (!member?.member_id) return;
    const s = createSupabaseBrowserClient();
    void s.from('planting_cycles')
      .select('id,crop_name,season_year')
      .eq('member_id', member.member_id)
      .in('status', BOOKABLE)
      .order('season_year', { ascending: false })
      .then(({ data }) => {
        setCycles(data ?? []);
        if (data?.[0]) setCycleId(data[0].id);
      });
  }, [member?.member_id]);

  const selected = cycles.find((c) => c.id === cycleId);

  return (
    <MobileAppShell title="📅 แจ้งวันเก็บเกี่ยว" subtitle="แจ้งวันที่คาดว่าจะเกี่ยวและต้องการเข้าอบ">
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <button className="admin-btn admin-btn--secondary" onClick={() => router.back()}
          style={{ alignSelf:'flex-start', fontSize:13, padding:'7px 14px' }}>← กลับ</button>

        {cycles.length === 0 && (
          <p style={{ color:'var(--color-text-secondary)', fontSize:13, textAlign:'center', padding:24 }}>
            ยังไม่มีรอบปลูกที่พร้อมแจ้งเก็บเกี่ยว
          </p>
        )}

        {cycles.length > 1 && (
          <label className="reg-label">เลือกรอบปลูก
            <select className="reg-input" value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
              {cycles.map((c) => <option key={c.id} value={c.id}>{c.crop_name} ปี {c.season_year}</option>)}
            </select>
          </label>
        )}

        {cycleId && selected && (
          <MemberHarvestBookingForm cycleId={cycleId} cropName={selected.crop_name} />
        )}
      </div>
    </MobileAppShell>
  );
}

export default function HarvestBookPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer','staff','leader']}>
      <BookContent />
    </ProtectedRoute>
  );
}

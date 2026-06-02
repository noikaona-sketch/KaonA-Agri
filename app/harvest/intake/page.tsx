'use client';

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { MobileAppShell }      from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }      from '@/shared/components/protected-route';
import { StaffIntakeForm }     from '@/features/staff-intake/intake-form';
import { IntakeQueueBoard }    from '@/features/staff-intake/intake-queue-board';
import { IntakeCsvPreview }   from '@/features/staff-intake/intake-csv-preview';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Location = { id: string; name: string };
type Tab = 'queue' | 'form' | 'csv';

function IntakeContent() {
  const router    = useRouter();
  const [tab, setTab]               = useState<Tab>('queue');
  const [locations, setLocations]   = useState<Location[]>([]);
  const [locationId, setLocationId] = useState('');

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s.from('pickup_locations').select('id,name').eq('active', true).eq('accepts_wet', true)
      .order('sort_order').then(({ data }) => {
        const locs = data ?? [];
        setLocations(locs);
        if (locs[0]) setLocationId(locs[0].id);
      });
  }, []);

  return (
    <MobileAppShell title="⚖️ รับซื้อ" subtitle="คิวรับและบันทึกน้ำหนักจริง">
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
          <button className="admin-btn admin-btn--secondary" onClick={() => router.back()}
            style={{ fontSize:13, padding:'7px 14px' }}>← กลับ</button>
          {locations.length > 1 && (
            <select className="reg-input" value={locationId} onChange={e => setLocationId(e.target.value)}
              style={{ width:'auto', fontSize:13 }}>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
        </div>

        {/* Tab switcher */}
        <div style={{ display:'flex', gap:6 }}>
          {([{ k:'queue', l:'📋 คิวรับวันนี้' }, { k:'form', l:'⚖️ บันทึกรับซื้อ' }, { k:'csv', l:'📥 CSV Import' }] as const).map(({ k, l }) => (
            <button key={k} onClick={() => setTab(k)}
              className={`admin-btn ${tab===k ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
              style={{ flex:1, fontSize:13 }}>{l}</button>
          ))}
        </div>

        {tab === 'queue' && locationId && <IntakeQueueBoard locationId={locationId} />}
        {tab === 'form'  && <StaffIntakeForm onSuccess={() => setTab('queue')} />}
        {tab === 'csv'   && <IntakeCsvPreview locationId={locationId} />}
      </div>
    </MobileAppShell>
  );
}

export default function StaffIntakePage() {
  return (
    <ProtectedRoute allowedRoles={['staff','admin']}>
      <IntakeContent />
    </ProtectedRoute>
  );
}

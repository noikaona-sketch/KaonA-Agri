'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type TruckMember = { id: string; full_name: string; phone: string | null };
type PlantingCycle = {
  id: string; crop_name: string; season_year: number;
  expected_harvest_at: string | null; estimated_yield_kg: number | null;
  area_planted_rai: number | null; member_id: string;
  members: { full_name: string }[] | null;
  plots: { id: string; name: string; province: string | null }[] | null;
};

type Props = { cycleId?: string; onCreated: () => void };

export function HarvestBookingForm({ cycleId, onCreated }: Props) {
  const [cycles, setCycles]   = useState<PlantingCycle[]>([]);
  const [trucks, setTrucks]   = useState<TruckMember[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<PlantingCycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    planting_cycle_id: cycleId ?? '',
    truck_type: 'internal' as 'internal' | 'external',
    truck_member_id: '',
    external_truck_name: '',
    external_truck_plate: '',
    external_truck_phone: '',
    scheduled_date: '',
    scheduled_time_start: '08:00',
    scheduled_time_end: '17:00',
    note: '',
  });

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const [cRes, tRes] = await Promise.all([
        s.from('planting_cycles')
          .select('id,crop_name,season_year,expected_harvest_at,estimated_yield_kg,area_planted_rai,member_id,members(full_name),plots(id,name,province)')
          .in('status', ['planted','growing','flowering','maturing','fruiting','ready'])
          .order('expected_harvest_at'),
        s.from('members').select('id,full_name,phone').eq('status','approved').limit(100),
      ]);
      setCycles((cRes.data as PlantingCycle[]) ?? []);
      // กรอง truck_owner จาก member_roles
      const allMembers = (tRes.data as TruckMember[]) ?? [];
      const { data: roleData } = await s.from('member_roles').select('member_id').eq('role','truck_owner');
      const truckIds = new Set((roleData ?? []).map((r: { member_id: string }) => r.member_id));
      setTrucks(allMembers.filter((m) => truckIds.has(m.id)));

      if (cycleId && cRes.data) {
        const found = (cRes.data as PlantingCycle[]).find((x) => x.id === cycleId);
        if (found) { setSelectedCycle(found); setForm((p) => ({ ...p, planting_cycle_id: cycleId, scheduled_date: found.expected_harvest_at ?? '' })); }
      }
      setLoading(false);
    })();
  }, [cycleId]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  async function handleSubmit() {
    if (!form.planting_cycle_id || !form.scheduled_date) { setError('กรุณากรอกข้อมูลให้ครบ'); return; }
    if (form.truck_type === 'internal' && !form.truck_member_id) { setError('กรุณาเลือกรถเกี่ยวในระบบ'); return; }
    if (form.truck_type === 'external' && !form.external_truck_plate) { setError('กรุณากรอกทะเบียนรถ'); return; }
    if (!selectedCycle) { setError('กรุณาเลือกรอบปลูก'); return; }

    setSubmitting(true); setError(null);
    const s = createSupabaseBrowserClient();
    const { error: insertErr } = await s.from('harvest_bookings').insert({
      planting_cycle_id: form.planting_cycle_id,
      member_id: selectedCycle.member_id,
      plot_id: selectedCycle.plots?.[0]?.id ?? null,
      truck_type: form.truck_type,
      truck_member_id: form.truck_type === 'internal' ? form.truck_member_id || null : null,
      external_truck_name: form.truck_type === 'external' ? form.external_truck_name || null : null,
      external_truck_plate: form.truck_type === 'external' ? form.external_truck_plate.toUpperCase() : null,
      external_truck_phone: form.truck_type === 'external' ? form.external_truck_phone || null : null,
      scheduled_date: form.scheduled_date,
      scheduled_time_start: form.scheduled_time_start || null,
      scheduled_time_end: form.scheduled_time_end || null,
      status: 'pending',
      note: form.note || null,
    });
    setSubmitting(false);
    if (insertErr) { setError(insertErr.message); return; }
    setSuccess(true);
    onCreated();
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  if (success) return (
    <div style={{ textAlign: 'center', padding: '32px 0' }}>
      <div style={{ fontSize: 56 }}>🚜</div>
      <h2 style={{ margin: '12px 0 4px', color: '#1b5e20' }}>นัดรถเกี่ยวแล้ว!</h2>
      <p style={{ color: '#6b7280' }}>ระบบบันทึกการนัดหมายเรียบร้อย</p>
    </div>
  );

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}

      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#4a6741' }}>1. เลือกรอบการปลูก</h3>
        <select className="reg-input" value={form.planting_cycle_id} onChange={(e) => {
          const c = cycles.find((x) => x.id === e.target.value) ?? null;
          setSelectedCycle(c);
          setForm((p) => ({ ...p, planting_cycle_id: e.target.value, scheduled_date: c?.expected_harvest_at ?? '' }));
        }}>
          <option value="">เลือกรอบปลูก…</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.members?.[0]?.full_name} — {c.crop_name} {c.season_year} · {c.plots?.[0]?.name}{c.plots?.[0]?.province ? ` (${c.plots[0].province})` : ''}
            </option>
          ))}
        </select>
        {selectedCycle && (
          <div style={{ marginTop: 10, background: '#e8f5e9', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {[['แปลง', `${selectedCycle.plots?.[0]?.name ?? '—'} ${selectedCycle.plots?.[0]?.province ? `(${selectedCycle.plots[0].province})` : ''}`],
              ['พื้นที่', `${selectedCycle.area_planted_rai ?? '—'} ไร่`],
              ['คาดผลผลิต', `${(selectedCycle.estimated_yield_kg ?? 0).toLocaleString()} กก.`],
              ['คาดเก็บ', selectedCycle.expected_harvest_at ? new Date(selectedCycle.expected_harvest_at).toLocaleDateString('th-TH') : '—']
            ].map(([k, v]) => (
              <div key={String(k)}><p style={{ margin: 0, fontSize: 11, color: '#4a6741' }}>{k}</p><p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{v}</p></div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#4a6741' }}>2. รถเกี่ยว</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['internal','external'] as const).map((t) => (
            <button key={t} onClick={() => setForm((p) => ({ ...p, truck_type: t }))}
              className={`admin-btn ${form.truck_type === t ? 'admin-btn--primary' : 'admin-btn--secondary'}`} style={{ fontSize: 13 }}>
              {t === 'internal' ? '👥 รถในระบบ' : '🔗 รถภายนอก'}
            </button>
          ))}
        </div>
        {form.truck_type === 'internal' ? (
          <select className="reg-input" value={form.truck_member_id} onChange={set('truck_member_id')}>
            <option value="">เลือก truck owner…</option>
            {trucks.map((t) => <option key={t.id} value={t.id}>{t.full_name} {t.phone ? `(${t.phone})` : ''}</option>)}
          </select>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <label className="reg-label" style={{ fontSize: 13 }}>ชื่อ/บริษัท<input className="reg-input" value={form.external_truck_name} onChange={set('external_truck_name')} placeholder="ชื่อคนขับ/บริษัท" /></label>
            <label className="reg-label" style={{ fontSize: 13 }}>ทะเบียน <span className="reg-required">*</span><input className="reg-input" value={form.external_truck_plate} onChange={set('external_truck_plate')} placeholder="กข 1234" style={{ textTransform: 'uppercase' }} /></label>
            <label className="reg-label" style={{ fontSize: 13 }}>เบอร์ติดต่อ<input className="reg-input" type="tel" value={form.external_truck_phone} onChange={set('external_truck_phone')} placeholder="08X-XXX-XXXX" /></label>
          </div>
        )}
      </section>

      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#4a6741' }}>3. วันและเวลา</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <label className="reg-label" style={{ fontSize: 13 }}>วันนัด <span className="reg-required">*</span><input className="reg-input" type="date" value={form.scheduled_date} onChange={set('scheduled_date')} min={new Date().toISOString().slice(0,10)} /></label>
          <label className="reg-label" style={{ fontSize: 13 }}>เวลาเริ่ม<input className="reg-input" type="time" value={form.scheduled_time_start} onChange={set('scheduled_time_start')} /></label>
          <label className="reg-label" style={{ fontSize: 13 }}>เวลาสิ้นสุด<input className="reg-input" type="time" value={form.scheduled_time_end} onChange={set('scheduled_time_end')} /></label>
        </div>
        <label className="reg-label" style={{ marginTop: 12, fontSize: 13 }}>หมายเหตุ<textarea className="reg-input reg-textarea" rows={2} value={form.note} onChange={set('note')} placeholder="รายละเอียดเพิ่มเติม…" /></label>
      </section>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="admin-btn admin-btn--primary" style={{ padding: '12px 24px', fontSize: 15 }} onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'กำลังนัด…' : '🚜 บันทึกนัดรถเกี่ยว'}
        </button>
      </div>
    </div>
  );
}

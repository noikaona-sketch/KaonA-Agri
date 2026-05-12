'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type TruckMember = { id: string; full_name: string; phone: string | null };
type Cycle = {
  id: string; crop_name: string; area_planted_rai: number | null;
  expected_harvest_at: string | null; estimated_yield_kg: number | null;
  members: { full_name: string } | null;
  plots: { id: string; name: string; province: string | null; lat: number | null; lng: number | null } | null;
};

type QualityGrade = {
  grade_a_moisture_max: number; grade_b_moisture_max: number;
  buyer_spec: string | null; seed_variety: string | null; product_name: string | null;
};

export function HarvestBookingForm() {
  const router = useRouter();
  const params = useSearchParams();
  const cycleIdFromUrl = params.get('cycle');

  const [cycles, setCycles]   = useState<Cycle[]>([]);
  const [trucks, setTrucks]   = useState<TruckMember[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState(cycleIdFromUrl ?? '');
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [qualityInfo, setQualityInfo] = useState<QualityGrade | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [truckType, setTruckType] = useState<'internal' | 'external'>('internal');
  const [form, setForm] = useState({
    truckMemberId: '',
    externalName: '', externalPlate: '', externalPhone: '',
    scheduledDate: '', timeStart: '08:00', timeEnd: '17:00', note: '',
  });

  function setField(f: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, [f]: e.target.value }));
  }

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const [cyc, tr] = await Promise.all([
        s.from('planting_cycles')
          .select('id,crop_name,area_planted_rai,expected_harvest_at,estimated_yield_kg,members(full_name),plots(id,name,province,lat,lng)')
          .in('status', ['growing','flowering','maturing','ready']).order('expected_harvest_at'),
        s.from('members')
          .select('id,full_name,phone')
          .eq('status', 'approved')
          .in('id', (await s.from('member_roles').select('member_id').eq('role','truck_owner').then((r) => r.data?.map((x) => x.member_id) ?? []))),
      ]);
      setCycles((cyc.data as Cycle[]) ?? []);
      setTrucks((tr.data as TruckMember[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const cycle = cycles.find((c) => c.id === selectedCycleId);
    setSelectedCycle(cycle ?? null);
    if (!cycle) { setQualityInfo(null); return; }
    // ดึง quality grade ถ้ามี
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('harvest_bookings_full')
        .select('grade_a_moisture_max,grade_b_moisture_max,buyer_spec,seed_variety,product_name')
        .eq('planting_cycle_id', selectedCycleId).limit(1);
      if (data?.[0]) setQualityInfo(data[0] as QualityGrade);
    })();
  }, [selectedCycleId, cycles]);

  async function handleSubmit() {
    if (!selectedCycleId || !form.scheduledDate) { setError('กรุณาเลือกรอบปลูกและวันนัด'); return; }
    if (truckType === 'internal' && !form.truckMemberId) { setError('กรุณาเลือกรถเกี่ยว'); return; }
    if (truckType === 'external' && !form.externalName) { setError('กรุณากรอกชื่อรถภายนอก'); return; }

    setSubmitting(true); setError(null);
    const s = createSupabaseBrowserClient();
    const cycle = cycles.find((c) => c.id === selectedCycleId);
    const { error: insertError } = await s.from('harvest_bookings').insert({
      planting_cycle_id: selectedCycleId,
      member_id: (await s.from('planting_cycles').select('member_id').eq('id', selectedCycleId).single()).data?.member_id,
      plot_id: cycle?.plots?.id ?? null,
      truck_type: truckType,
      truck_member_id: truckType === 'internal' ? form.truckMemberId : null,
      external_truck_name: truckType === 'external' ? form.externalName : null,
      external_truck_plate: truckType === 'external' ? form.externalPlate : null,
      external_truck_phone: truckType === 'external' ? form.externalPhone : null,
      scheduled_date: form.scheduledDate,
      scheduled_time_start: form.timeStart || null,
      scheduled_time_end: form.timeEnd || null,
      status: 'pending',
      note: form.note || null,
    });

    setSubmitting(false);
    if (insertError) { setError(insertError.message); return; }
    router.push('/admin/harvest');
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <div style={{ maxWidth: 600, display: 'grid', gap: 20 }}>
      {error && <ErrorState title="ไม่สำเร็จ" detail={error} />}

      {/* เลือกรอบปลูก */}
      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#0d3d1f' }}>1. เลือกรอบการปลูก</h3>
        <select className="reg-input" value={selectedCycleId} onChange={(e) => setSelectedCycleId(e.target.value)}>
          <option value="">— เลือกรอบปลูก —</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.members?.full_name} · {c.crop_name} · {c.plots?.name} {c.plots?.province ?? ''}
              {c.expected_harvest_at ? ` · ${new Date(c.expected_harvest_at).toLocaleDateString('th-TH')}` : ''}
            </option>
          ))}
        </select>

        {selectedCycle && (
          <div style={{ background: '#f7faf7', borderRadius: 10, padding: 14, marginTop: 10, display: 'grid', gap: 8 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>🌾 {selectedCycle.crop_name} · {selectedCycle.plots?.name}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {[
                { label: 'พื้นที่', value: `${selectedCycle.area_planted_rai ?? '—'} ไร่` },
                { label: 'คาดเก็บ', value: selectedCycle.expected_harvest_at ? new Date(selectedCycle.expected_harvest_at).toLocaleDateString('th-TH') : '—' },
                { label: 'ผลผลิต', value: `~${(selectedCycle.estimated_yield_kg ?? 0).toLocaleString()} กก.` },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px' }}>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{label}</p>
                  <p style={{ margin: 0, fontWeight: 700 }}>{value}</p>
                </div>
              ))}
            </div>

            {qualityInfo && (
              <div style={{ background: '#e3f2fd', borderRadius: 8, padding: 10, fontSize: 13 }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#1565c0' }}>🔬 เกณฑ์คุณภาพ: {qualityInfo.product_name} {qualityInfo.seed_variety ? `(${qualityInfo.seed_variety})` : ''}</p>
                <p style={{ margin: '4px 0 0', color: '#1565c0' }}>เกรด A: ≤{qualityInfo.grade_a_moisture_max}% · เกรด B: ≤{qualityInfo.grade_b_moisture_max}%</p>
                {qualityInfo.buyer_spec && <p style={{ margin: '4px 0 0', color: '#6b7280' }}>Spec ผู้รับซื้อ: {qualityInfo.buyer_spec}</p>}
              </div>
            )}
          </div>
        )}
      </section>

      {/* เลือกรถเกี่ยว */}
      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#0d3d1f' }}>2. เลือกรถเกี่ยว</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {(['internal', 'external'] as const).map((t) => (
            <button key={t} onClick={() => setTruckType(t)}
              className={`admin-btn ${truckType === t ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
              style={{ fontSize: 13, padding: '8px 16px' }}>
              {t === 'internal' ? '👥 รถในระบบ' : '🚜 รถภายนอก'}
            </button>
          ))}
        </div>

        {truckType === 'internal' ? (
          <label className="reg-label">เลือกรถเกี่ยว (truck_owner) <span className="reg-required">*</span>
            <select className="reg-input" value={form.truckMemberId} onChange={(e) => setForm((p) => ({ ...p, truckMemberId: e.target.value }))}>
              <option value="">— เลือก —</option>
              {trucks.map((t) => <option key={t.id} value={t.id}>{t.full_name} {t.phone ? `(${t.phone})` : ''}</option>)}
            </select>
          </label>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            <label className="reg-label">ชื่อคนขับ/บริษัท <span className="reg-required">*</span>
              <input className="reg-input" value={form.externalName} onChange={setField('externalName')} placeholder="ชื่อคนขับหรือบริษัทรถเกี่ยว" />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label className="reg-label">ทะเบียนรถ
                <input className="reg-input" value={form.externalPlate} onChange={setField('externalPlate')} placeholder="กข 1234" style={{ textTransform: 'uppercase' }} />
              </label>
              <label className="reg-label">เบอร์ติดต่อ
                <input className="reg-input" type="tel" value={form.externalPhone} onChange={setField('externalPhone')} placeholder="0XX-XXX-XXXX" />
              </label>
            </div>
          </div>
        )}
      </section>

      {/* วันนัด */}
      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#0d3d1f' }}>3. กำหนดวันและเวลา</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <label className="reg-label" style={{ gridColumn: '1/-1' }}>วันนัด <span className="reg-required">*</span>
            <input className="reg-input" type="date" value={form.scheduledDate} onChange={setField('scheduledDate')} min={new Date().toISOString().slice(0,10)} />
          </label>
          <label className="reg-label">เวลาเริ่ม
            <input className="reg-input" type="time" value={form.timeStart} onChange={setField('timeStart')} />
          </label>
          <label className="reg-label">เวลาสิ้นสุด
            <input className="reg-input" type="time" value={form.timeEnd} onChange={setField('timeEnd')} />
          </label>
          <label className="reg-label">หมายเหตุ
            <input className="reg-input" value={form.note} onChange={setField('note')} placeholder="หมายเหตุ..." />
          </label>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 10 }}>
        <UIButton variant="ghost" onClick={() => router.back()}>← ย้อนกลับ</UIButton>
        <UIButton onClick={handleSubmit} disabled={!selectedCycleId || !form.scheduledDate || submitting} loading={submitting}>
          🚜 สร้างนัดรถเกี่ยว
        </UIButton>
      </div>
    </div>
  );
}

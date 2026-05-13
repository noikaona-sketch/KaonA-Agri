'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';
import { UIButton } from '@/shared/components/ui-button';

type Cycle = {
  id: string; crop_name: string; planted_at: string | null;
  expected_harvest_at: string | null; estimated_yield_kg: number | null;
  quota_kg: number | null; seed_qty_used: number | null;
  area_planted_rai: number | null;
  members: { full_name: string; phone: string | null }[] | null;
  plots: { name: string; province: string | null }[] | null;
};

type YieldCalc = {
  estimated_yield_kg: number; quota_kg: number;
  price_per_kg: number; estimated_revenue_thb: number;
};

export function NewAppointmentForm() {
  const router = useRouter();
  const params = useSearchParams();
  const cycleIdFromUrl = params.get('cycle');

  const [cycles, setCycles]   = useState<Cycle[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState(cycleIdFromUrl ?? '');
  const [selectedCycle, setSelectedCycle] = useState<Cycle | null>(null);
  const [yieldCalc, setYieldCalc] = useState<YieldCalc | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const [form, setForm] = useState({
    estimatedQtyKg: '',
    appointmentDate: '',
    appointmentTime: '09:00',
    locationNote: '',
    note: '',
  });

  function setField(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  // โหลด planting cycles ที่พร้อมขาย
  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('planting_cycles')
        .select('id,crop_name,planted_at,expected_harvest_at,estimated_yield_kg,quota_kg,seed_qty_used,area_planted_rai,members(full_name,phone),plots(name,province)')
        .in('status', ['planted','growing','flowering','maturing','ready'])
        .order('expected_harvest_at');
      setCycles((data as Cycle[]) ?? []);
      setLoading(false);
    })();
  }, []);

  // เมื่อเลือก cycle → คำนวณ yield
  useEffect(() => {
    if (!selectedCycleId) { setSelectedCycle(null); setYieldCalc(null); return; }
    const cycle = cycles.find((c) => c.id === selectedCycleId);
    setSelectedCycle(cycle ?? null);
    if (!cycle) return;

    void (async () => {
      setCalculating(true);
      const s = createSupabaseBrowserClient();
      const { data } = await s.rpc('calc_estimated_yield', {
        p_crop_type: cycle.crop_name,
        p_area_rai: cycle.area_planted_rai ?? 0,
        p_seed_qty_kg: cycle.seed_qty_used ?? 0,
      });
      setYieldCalc(data as YieldCalc);
      if (data) {
        setForm((p) => ({
          ...p,
          estimatedQtyKg: String(Math.round((data as YieldCalc).quota_kg || (data as YieldCalc).estimated_yield_kg)),
        }));
      }
      setCalculating(false);
    })();
  }, [selectedCycleId, cycles]);

  async function handleSubmit() {
    if (!selectedCycleId || !form.estimatedQtyKg || !form.appointmentDate) {
      setError('กรุณาเลือกรอบปลูก ปริมาณ และวันนัด'); return;
    }
    setSubmitting(true); setError(null);
    const s = createSupabaseBrowserClient();
    const { data, error: rpcError } = await s.rpc('create_sale_appointment', {
      p_planting_cycle_id: selectedCycleId,
      p_estimated_qty_kg: Number(form.estimatedQtyKg),
      p_appointment_date: form.appointmentDate,
      p_appointment_time: form.appointmentTime || null,
      p_location_note: form.locationNote || null,
      p_note: form.note || null,
    });
    setSubmitting(false);
    if (rpcError) { setError(rpcError.message); return; }
    router.push('/admin/appointments');
  }

  if (loading) return <LoadingState label="กำลังโหลดรอบปลูก…" />;

  return (
    <div style={{ maxWidth: 600, display: 'grid', gap: 20 }}>
      {error && <ErrorState title="ไม่สำเร็จ" detail={error} />}

      {/* เลือกรอบปลูก */}
      <section>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#0d3d1f' }}>1. เลือกรอบการปลูก</h3>
        <select className="reg-input" value={selectedCycleId} onChange={(e) => setSelectedCycleId(e.target.value)}>
          <option value="">— เลือกรอบปลูก —</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.members?.[0]?.full_name} · {c.crop_name} · {c.plots?.[0]?.name ?? ''} {c.plots?.[0]?.province ?? ''}
              {c.expected_harvest_at ? ` · เก็บ ${new Date(c.expected_harvest_at).toLocaleDateString('th-TH')}` : ''}
            </option>
          ))}
        </select>
      </section>

      {/* ข้อมูลรอบปลูก */}
      {selectedCycle && (
        <section style={{ background: '#f7faf7', borderRadius: 12, padding: 16, display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: '#0d3d1f' }}>
            🌾 {selectedCycle.crop_name} · {selectedCycle.plots?.[0]?.name}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
            สมาชิก: {selectedCycle.members?.[0]?.full_name} · {selectedCycle.members?.[0]?.phone ?? ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 4 }}>
            {[
              { label: 'พื้นที่', value: `${selectedCycle.area_planted_rai ?? '—'} ไร่` },
              { label: 'ปลูกเมื่อ', value: selectedCycle.planted_at ? new Date(selectedCycle.planted_at).toLocaleDateString('th-TH') : '—' },
              { label: 'คาดเก็บ', value: selectedCycle.expected_harvest_at ? new Date(selectedCycle.expected_harvest_at).toLocaleDateString('th-TH') : '—' },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 8, padding: '8px 10px' }}>
                <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{label}</p>
                <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: 14 }}>{value}</p>
              </div>
            ))}
          </div>

          {calculating && <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>กำลังคำนวณ…</p>}
          {yieldCalc && (
            <div style={{ background: '#e8f5e9', borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'ผลผลิตประมาณ', value: `${yieldCalc.estimated_yield_kg.toLocaleString()} กก.` },
                { label: 'โควต้าขาย', value: `${yieldCalc.quota_kg.toLocaleString()} กก.` },
                { label: 'ราคากลาง', value: `${yieldCalc.price_per_kg} บาท/กก.` },
                { label: 'ประมาณรายได้', value: `${yieldCalc.estimated_revenue_thb.toLocaleString()} บาท` },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p style={{ margin: 0, fontSize: 11, color: '#4a6741' }}>{label}</p>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#1b5e20' }}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* form นัดหมาย */}
      {selectedCycle && (
        <section>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#0d3d1f' }}>2. กำหนดนัดขาย</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="reg-label">ปริมาณที่นัดขาย (กก.) <span className="reg-required">*</span>
                <input className="reg-input" type="number" value={form.estimatedQtyKg} onChange={setField('estimatedQtyKg')} placeholder="0" />
              </label>
              <label className="reg-label">วันนัด <span className="reg-required">*</span>
                <input className="reg-input" type="date" value={form.appointmentDate} onChange={setField('appointmentDate')} min={new Date().toISOString().slice(0,10)} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label className="reg-label">เวลา
                <input className="reg-input" type="time" value={form.appointmentTime} onChange={setField('appointmentTime')} />
              </label>
              <label className="reg-label">สถานที่รับสินค้า
                <input className="reg-input" value={form.locationNote} onChange={setField('locationNote')} placeholder="จุดรับ/โรงงาน/ไซโล" />
              </label>
            </div>
            {yieldCalc && form.estimatedQtyKg && (
              <div style={{ background: '#fff8e1', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}>
                  <span>ยอดประมาณ</span>
                  <span style={{ color: '#1b5e20' }}>{(Number(form.estimatedQtyKg) * yieldCalc.price_per_kg).toLocaleString()} บาท</span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                  {form.estimatedQtyKg} กก. × {yieldCalc.price_per_kg} บาท/กก.
                </p>
              </div>
            )}
            <label className="reg-label">หมายเหตุ
              <textarea className="reg-input reg-textarea" rows={2} value={form.note} onChange={setField('note')} placeholder="หมายเหตุเพิ่มเติม..." />
            </label>
          </div>
        </section>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <UIButton variant="ghost" onClick={() => router.back()}>← ย้อนกลับ</UIButton>
        <UIButton onClick={handleSubmit} disabled={!selectedCycleId || !form.estimatedQtyKg || !form.appointmentDate || submitting} loading={submitting}>
          📅 สร้างนัดขาย
        </UIButton>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type PlantingCycle = {
  id: string; crop_name: string; season_year: number;
  status: string; planted_at: string | null;
  expected_harvest_at: string | null;
  area_planted_rai: number | null;
  estimated_yield_kg: number | null; quota_kg: number | null;
  seed_qty_used: number | null;
  member: { full_name: string }[] | null;
  plot: { name: string; province: string | null }[] | null;
};

type YieldEst = {
  estimated_yield_kg: number; quota_kg: number;
  price_per_kg: number; estimated_revenue_thb: number;
};

type Props = { cycleId?: string; onCreated: (id: string, num: string) => void };

export function AppointmentForm({ cycleId, onCreated }: Props) {
  const [cycles, setCycles]     = useState<PlantingCycle[]>([]);
  const [selectedCycle, setSelectedCycle] = useState<PlantingCycle | null>(null);
  const [yieldEst, setYieldEst] = useState<YieldEst | null>(null);
  const [loading, setLoading]   = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [form, setForm] = useState({
    planting_cycle_id: cycleId ?? '',
    estimated_qty_kg: '',
    appointment_date: '',
    appointment_time: '09:00',
    location_note: '',
    note: '',
  });

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('planting_cycles')
        .select('id,crop_name,season_year,status,planted_at,expected_harvest_at,area_planted_rai,estimated_yield_kg,quota_kg,seed_qty_used,member:members!planting_cycles_member_id_fkey(full_name),plot:plots!planting_cycles_plot_id_fkey(name,province)')
        .in('status', ['planted','growing','flowering','maturing','fruiting','ready'])
        .order('expected_harvest_at');
      setCycles((data as PlantingCycle[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (cycleId && cycles.length > 0) {
      const c = cycles.find((x) => x.id === cycleId);
      if (c) pickCycle(c);
    }
  }, [cycleId, cycles]);

  async function pickCycle(cycle: PlantingCycle) {
    setSelectedCycle(cycle);
    setForm((p) => ({ ...p, planting_cycle_id: cycle.id }));
    // คำนวณ yield estimate
    if (cycle.crop_name) {
      const s = createSupabaseBrowserClient();
      const { data } = await s.rpc('calc_estimated_yield', {
        p_crop_type: cycle.crop_name,
        p_area_rai: cycle.area_planted_rai ?? 0,
        p_seed_qty_kg: cycle.seed_qty_used ?? 0,
      });
      setYieldEst(data as YieldEst);
      // auto fill estimated qty
      if (data) {
        const est = data as YieldEst;
        setForm((p) => ({ ...p, estimated_qty_kg: String(Math.round(Math.min(est.estimated_yield_kg, est.quota_kg))) }));
      }
    }
  }

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [field]: e.target.value }));
  }

  async function handleSubmit() {
    if (!form.planting_cycle_id || !form.estimated_qty_kg || !form.appointment_date) {
      setError('กรุณากรอกข้อมูลให้ครบ'); return;
    }
    setSubmitting(true); setError(null);
    const s = createSupabaseBrowserClient();
    const { data, error: rpcError } = await s.rpc('create_sale_appointment', {
      p_planting_cycle_id: form.planting_cycle_id,
      p_estimated_qty_kg: Number(form.estimated_qty_kg),
      p_appointment_date: form.appointment_date,
      p_appointment_time: form.appointment_time || null,
      p_location_note: form.location_note || null,
      p_note: form.note || null,
    });
    setSubmitting(false);
    if (rpcError) { setError(rpcError.message); return; }
    const result = data as { appointment_id: string; appointment_number: string };
    onCreated(result.appointment_id, result.appointment_number);
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  const canSubmit = form.planting_cycle_id && form.estimated_qty_kg && form.appointment_date;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {error && <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 10, padding: '10px 14px', color: '#c62828', fontSize: 14 }}>⚠️ {error}</div>}

      {/* เลือกรอบปลูก */}
      <section>
        <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#4a6741' }}>เลือกรอบการปลูก</h3>
        {cycles.length === 0 ? (
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '12px 16px', fontSize: 14, color: '#e65100' }}>
            ⚠️ ไม่มีรอบปลูกที่พร้อมนัดขาย (ต้องมีสถานะ planted/growing/maturing/ready)
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th></th><th>สมาชิก</th><th>พืช</th><th>แปลง</th><th>คาดเก็บ</th><th>คาดผลผลิต</th></tr></thead>
              <tbody>
                {cycles.map((c) => (
                  <tr key={c.id} onClick={() => pickCycle(c)}
                    style={{ cursor: 'pointer', background: selectedCycle?.id === c.id ? '#e8f5e9' : undefined }}>
                    <td><input type="radio" readOnly checked={selectedCycle?.id === c.id} /></td>
                    <td style={{ fontWeight: 600 }}>{c.member?.[0]?.full_name ?? '—'}</td>
                    <td>{c.crop_name} {c.season_year}</td>
                    <td>{c.plot?.[0]?.name ?? '—'} {c.plot?.[0]?.province ? `(${c.plot?.[0]?.province})` : ''}</td>
                    <td style={{ fontSize: 13, color: '#6b7280' }}>{c.expected_harvest_at ? new Date(c.expected_harvest_at).toLocaleDateString('th-TH') : '—'}</td>
                    <td>{(c.estimated_yield_kg ?? 0).toLocaleString()} กก.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ประมาณการณ์ */}
      {yieldEst && selectedCycle && (
        <section style={{ background: '#f7faf7', border: '1px solid #e8ede8', borderRadius: 12, padding: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#0d3d1f' }}>📊 ประมาณการณ์ผลผลิต — {selectedCycle.crop_name}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'คาดผลผลิต', value: `${yieldEst.estimated_yield_kg.toLocaleString()} กก.`, icon: '📦' },
              { label: 'โควต้าขาย', value: `${yieldEst.quota_kg.toLocaleString()} กก.`, icon: '🏷️' },
              { label: 'ราคา/กก.', value: `${yieldEst.price_per_kg} บาท`, icon: '💰' },
              { label: 'คาดรายได้', value: `${yieldEst.estimated_revenue_thb.toLocaleString()} บาท`, icon: '🤑' },
            ].map((k) => (
              <div key={k.label} style={{ background: '#fff', border: '1px solid #e8ede8', borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>{k.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0d3d1f' }}>{k.value}</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>{k.label}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ข้อมูลนัด */}
      {selectedCycle && (
        <section>
          <h3 style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 700, color: '#4a6741' }}>รายละเอียดนัดขาย</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <label className="reg-label">ปริมาณที่นัดขาย (กก.) <span className="reg-required">*</span>
              <input className="reg-input" type="number" min="1" value={form.estimated_qty_kg} onChange={set('estimated_qty_kg')} placeholder="0" />
              {yieldEst && <span className="reg-hint">โควต้าคงเหลือ: {yieldEst.quota_kg.toLocaleString()} กก.</span>}
            </label>
            <label className="reg-label">วันนัดขาย <span className="reg-required">*</span>
              <input className="reg-input" type="date" value={form.appointment_date} onChange={set('appointment_date')}
                min={new Date().toISOString().slice(0, 10)} />
            </label>
            <label className="reg-label">เวลา
              <input className="reg-input" type="time" value={form.appointment_time} onChange={set('appointment_time')} />
            </label>
            <label className="reg-label">สถานที่รับสินค้า
              <input className="reg-input" value={form.location_note} onChange={set('location_note')} placeholder="บ้านสมาชิก / โกดัง / อื่นๆ" />
            </label>
            <label className="reg-label" style={{ gridColumn: '1/-1' }}>หมายเหตุ
              <textarea className="reg-input reg-textarea" rows={2} value={form.note} onChange={set('note')} placeholder="เพิ่มเติม…" />
            </label>
          </div>

          {yieldEst && form.estimated_qty_kg && (
            <div style={{ marginTop: 14, background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#1b5e20' }}>
                💰 ยอดประมาณ: {(Number(form.estimated_qty_kg) * yieldEst.price_per_kg).toLocaleString()} บาท
                <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>({Number(form.estimated_qty_kg).toLocaleString()} กก. × {yieldEst.price_per_kg} บาท)</span>
              </p>
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="admin-btn admin-btn--primary" style={{ padding: '12px 24px', fontSize: 15 }}
              onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? 'กำลังสร้าง…' : '📅 สร้างนัดขาย'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

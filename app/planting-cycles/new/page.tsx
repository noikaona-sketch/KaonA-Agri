'use client';

import { useRouter }          from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurrentMember }   from '@/providers/auth-provider';
import { MobileAppShell }     from '@/shared/components/mobile-app-shell';
import { UIButton }           from '@/shared/components/ui-button';
import { ErrorState }         from '@/shared/components/error-state';
import { LoadingState }       from '@/shared/components/loading-state';

/* ── Types ── */
type Plot = { id:string; name:string; province:string|null; area_rai:number };
type SaleItem = {
  id:string; order_number:string; created_at:string;
  product_id:string; product_name:string;
  qty:number; unit_price:number;
  bag_weight_kg:number|null; days_to_harvest:number|null;
  yield_ratio_kg:number|null; crop_type:string|null;
  variety_name:string|null;
};

/* ── คำนวณ season_year จากวันคาดเก็บ ── */
function calcSeasonYear(harvestDate:string): number {
  const d   = new Date(harvestDate);
  const m   = d.getMonth() + 1; // 1-12
  const bey = d.getFullYear() + 543;
  // ต้นฝน (พ.ค.-ต.ค.) = ปีนั้น, ปลายฝน/แล้ง (พ.ย.-เม.ย.) = ปีนั้น
  return bey;
}

const IS_CORN = (crop: string) =>
  ['ข้าวโพด','corn','maize','ข้าวโพดเลี้ยงสัตว์'].some(k => crop.toLowerCase().includes(k.toLowerCase()));

export default function NewPlantingCyclePage() {
  const router  = useRouter();
  const member  = useCurrentMember();

  const [plots,     setPlots]     = useState<Plot[]>([]);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [submitting,setSubmitting]= useState(false);
  const [error,     setError]     = useState<string|null>(null);

  // form state
  const [cropName,     setCropName]     = useState('ข้าวโพด');
  const [plotId,       setPlotId]       = useState('');
  const [areaRai,      setAreaRai]      = useState('');
  const [plantedDate,  setPlantedDate]  = useState('');
  const [notes,        setNotes]        = useState('');

  // ข้าวโพด: เลือกบิล
  const [selItemId,    setSelItemId]    = useState('');
  // พืชอื่น: ระบุวันเก็บเอง
  const [harvestManual,setHarvestManual]= useState('');

  /* ── Load plots + sale items ── */
  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      const [pRes, sRes] = await Promise.all([
        fetch(`/api/member/plots?member_id=${member.member_id}`).then(r => r.json()) as Promise<{ plots?:Plot[] }>,
        fetch(`/api/member/sale-items?member_id=${member.member_id}`).then(r => r.json()) as Promise<{ items?:SaleItem[] }>,
      ]);
      setPlots(pRes.plots ?? []);
      setSaleItems(sRes.items ?? []);
      setLoading(false);
    })();
  }, [member?.member_id]);

  /* ── Derived ── */
  const isCorn     = IS_CORN(cropName);
  const selItem    = saleItems.find(x => x.id === selItemId);

  // คำนวณวันเก็บเกี่ยว
  const harvestDate = (() => {
    if (!plantedDate) return null;
    if (isCorn && selItem?.days_to_harvest) {
      const d = new Date(plantedDate);
      d.setDate(d.getDate() + selItem.days_to_harvest);
      return d.toISOString().slice(0, 10);
    }
    if (!isCorn && harvestManual) return harvestManual;
    return null;
  })();

  // คำนวณ quota
  const quotaKg = (() => {
    if (!isCorn || !selItem) return null;
    const bagKg    = selItem.bag_weight_kg ?? 10;
    const ratio    = selItem.yield_ratio_kg ?? 600;
    const totalSeedKg = selItem.qty * bagKg;
    return totalSeedKg * ratio;
  })();

  const seasonYear = harvestDate ? calcSeasonYear(harvestDate) : new Date().getFullYear() + 543;

  /* ── Submit ── */
  async function handleSubmit() {
    if (!member?.member_id || !cropName || !plotId || !plantedDate) {
      setError('กรุณากรอกข้อมูลให้ครบ'); return;
    }
    if (isCorn && !selItemId) {
      setError('กรุณาเลือกบิลขาย/จองเมล็ดพันธุ์'); return;
    }
    if (!harvestDate) {
      setError('กรุณาระบุวันที่คาดว่าจะเก็บเกี่ยว'); return;
    }
    setSubmitting(true); setError(null);

    const res = await fetch('/api/member/planting-cycles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        member_id:           member.member_id,
        crop_name:           cropName,
        plot_id:             plotId,
        product_id:          selItem?.product_id ?? null,
        planted_at:          plantedDate,
        expected_harvest_at: harvestDate,
        area_planted_rai:    areaRai ? Number(areaRai) : null,
        season_year:         seasonYear,
        quota_kg:            quotaKg ?? null,
        status:              'planted',
        source:              'manual',
        member_note:         notes || null,
        confirmed_at:        new Date().toISOString(),
      }),
    });
    const d = (await res.json()) as { id?:string; error?:string };
    setSubmitting(false);
    if (!res.ok) { setError(d.error ?? 'บันทึกไม่สำเร็จ'); return; }
    router.replace(`/planting-cycles/${d.id}`);
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <MobileAppShell title="สร้างรอบปลูกใหม่" subtitle="บันทึกข้อมูลการเพาะปลูก">
      <div className="mobile-stack" style={{ paddingBottom:24 }}>
        {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}

        {/* ชนิดพืช */}
        <label className="reg-label">ชนิดพืช <span className="reg-required">*</span>
          <input className="reg-input" value={cropName}
            onChange={e => { setCropName(e.target.value); setSelItemId(''); }}
            placeholder="ข้าวโพด / ข้าว / มันสำปะหลัง" />
        </label>

        {/* เลือกแปลง */}
        <label className="reg-label">เลือกแปลง <span className="reg-required">*</span>
          <select className="reg-input" value={plotId}
            onChange={e => { setPlotId(e.target.value); const p=plots.find(x=>x.id===e.target.value); if(p&&!areaRai) setAreaRai(String(p.area_rai)); }}>
            <option value="">— เลือกแปลง —</option>
            {plots.map(p => <option key={p.id} value={p.id}>{p.name}{p.province?` (${p.province})`:''} · {p.area_rai} ไร่</option>)}
          </select>
          {plots.length === 0 && (
            <span className="reg-hint">ยังไม่มีแปลง — <a href="/plots/add" style={{ color:'var(--primary)' }}>เพิ่มแปลงก่อน</a></span>
          )}
        </label>

        {/* พื้นที่ */}
        <label className="reg-label">พื้นที่ปลูก (ไร่)
          <input className="reg-input" type="number" step="0.5" value={areaRai}
            onChange={e => setAreaRai(e.target.value)} placeholder="0.0" />
        </label>

        {/* วันที่ปลูก */}
        <label className="reg-label">วันที่ปลูก <span className="reg-required">*</span>
          <input className="reg-input" type="date" value={plantedDate}
            onChange={e => setPlantedDate(e.target.value)}
            max={new Date().toISOString().slice(0,10)} />
        </label>

        {/* ── ข้าวโพด: เลือกบิลขาย ── */}
        {isCorn && (
          <label className="reg-label">บิลขาย / จองเมล็ดพันธุ์ <span className="reg-required">*</span>
            <select className="reg-input" value={selItemId} onChange={e => setSelItemId(e.target.value)}>
              <option value="">— เลือกบิล —</option>
              {saleItems.length === 0 && <option disabled>ยังไม่มีประวัติซื้อเมล็ด</option>}
              {saleItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.order_number} · {item.product_name} · {item.qty} ถุง · {new Date(item.created_at).toLocaleDateString('th-TH')}
                </option>
              ))}
            </select>
            {selItem && (
              <div style={{ marginTop:8, background:'#F0FDF4', borderRadius:8, padding:'10px 12px', fontSize:13 }}>
                <p style={{ margin:'0 0 4px', fontWeight:700, color:'#065F46' }}>{selItem.product_name}</p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                  <span style={{ color:'#6B7280' }}>🌽 {selItem.qty} ถุง × {selItem.bag_weight_kg??10} กก.</span>
                  <span style={{ color:'#6B7280' }}>📅 อายุ {selItem.days_to_harvest??'—'} วัน</span>
                  <span style={{ color:'#059669', fontWeight:600 }}>
                    📦 โควต้า: {quotaKg?.toLocaleString('th-TH') ?? '—'} กก.
                  </span>
                  <span style={{ color:'#6B7280' }}>อัตรา {selItem.yield_ratio_kg??600} กก./กก.</span>
                </div>
              </div>
            )}
          </label>
        )}

        {/* ── พืชอื่น: ระบุวันเก็บเอง ── */}
        {!isCorn && (
          <label className="reg-label">วันที่คาดว่าจะเก็บเกี่ยว <span className="reg-required">*</span>
            <input className="reg-input" type="date" value={harvestManual}
              onChange={e => setHarvestManual(e.target.value)} />
          </label>
        )}

        {/* ── สรุปวันเก็บ + season ── */}
        {harvestDate && (
          <div style={{ background:'#E8F5E9', border:'1px solid #A5D6A7', borderRadius:10, padding:'12px 16px' }}>
            <p style={{ margin:'0 0 4px', fontSize:14, fontWeight:700, color:'#1B5E20' }}>
              🌾 คาดเก็บเกี่ยว: {new Date(harvestDate).toLocaleDateString('th-TH', { day:'numeric', month:'long', year:'numeric' })}
            </p>
            <p style={{ margin:0, fontSize:12, color:'#388E3C' }}>
              ฤดูกาล พ.ศ. {seasonYear}
              {quotaKg && ` · โควต้า ${quotaKg.toLocaleString('th-TH')} กก.`}
            </p>
          </div>
        )}

        {/* หมายเหตุ */}
        <label className="reg-label">หมายเหตุ
          <textarea className="reg-input reg-textarea" rows={2} value={notes}
            onChange={e => setNotes(e.target.value)} placeholder="บันทึกเพิ่มเติม…" />
        </label>

        <UIButton fullWidth onClick={handleSubmit} loading={submitting}
          disabled={submitting || !cropName || !plotId || !plantedDate}>
          🌱 สร้างรอบปลูก
        </UIButton>
        <UIButton variant="ghost" fullWidth onClick={() => router.back()}>← ยกเลิก</UIButton>
      </div>
    </MobileAppShell>
  );
}

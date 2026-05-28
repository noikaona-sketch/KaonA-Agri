'use client';

import { useRouter }           from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurrentMember }    from '@/providers/auth-provider';
import { MobileAppShell }      from '@/shared/components/mobile-app-shell';
import { UIButton }            from '@/shared/components/ui-button';
import { ErrorState }          from '@/shared/components/error-state';
import { LoadingState }        from '@/shared/components/loading-state';

/* ── Types ── */
type Plot = { id:string; name:string; province:string|null; area_rai:number };
type SaleItem = {
  id:string; order_number:string; created_at:string;
  product_id:string; product_name:string; qty:number;
  bag_weight_kg:number|null; days_to_harvest:number|null;
  yield_ratio_kg:number|null; crop_type:string|null; variety_name:string|null;
};
type CropConfig = { crop_type:string; yield_per_rai:number; quota_per_seed_kg:number };

/* ── Config ── */
const CORN_KEYWORDS = ['ข้าวโพด','corn','maize'];
const IS_CORN = (crop:string) => CORN_KEYWORDS.some(k => crop.toLowerCase().includes(k.toLowerCase()));

const CROP_ICONS: Record<string,string> = {
  'ข้าวโพด':'🌽', 'ข้าว':'🌾', 'มันสำปะหลัง':'🥔',
  'อ้อย':'🎋', 'ถั่วเหลือง':'🫘', 'ข้าวโพดหวาน':'🌽',
};

function calcSeasonYear(harvestDate:string): number {
  return new Date(harvestDate).getFullYear() + 543;
}

export default function NewPlantingCyclePage() {
  const router  = useRouter();
  const member  = useCurrentMember();

  const [plots,      setPlots]      = useState<Plot[]>([]);
  const [saleItems,  setSaleItems]  = useState<SaleItem[]>([]);
  const [cropConfigs,setCropConfigs]= useState<CropConfig[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string|null>(null);

  /* form */
  const [cropName,      setCropName]      = useState('ข้าวโพด');
  const [plotId,        setPlotId]        = useState('');
  const [areaRai,       setAreaRai]       = useState('');
  const [plantedDate,   setPlantedDate]   = useState('');
  const [notes,         setNotes]         = useState('');
  const [selItemIds,    setSelItemIds]     = useState<Set<string>>(new Set()); // หลายบิล
  const [harvestManual, setHarvestManual] = useState('');

  /* ── Load ── */
  useEffect(() => {
    if (!member?.member_id) return;
    setLoading(true);
    void (async () => {
      const [pRes, sRes, cRes] = await Promise.all([
        fetch(`/api/member/plots?member_id=${member.member_id}`).then(r=>r.json()) as Promise<{plots?:Plot[]}>,
        fetch(`/api/member/sale-items?member_id=${member.member_id}`).then(r=>r.json()) as Promise<{items?:SaleItem[]}>,
        fetch('/api/member/crop-types').then(r=>r.json()) as Promise<{crops?:CropConfig[]}>,
      ]);
      setPlots(pRes.plots ?? []);
      setSaleItems(sRes.items ?? []);
      setCropConfigs([...(cRes.crops ?? []), { crop_type:'อื่นๆ', yield_per_rai:0, quota_per_seed_kg:0 }]);
      setLoading(false);
    })();
  }, [member?.member_id]);

  /* ── Derived ── */
  const isCorn    = IS_CORN(cropName);
  const selItems  = saleItems.filter(x => selItemIds.has(x.id));

  // วันเก็บ = วันปลูก + days_to_harvest น้อยสุดจากบิลที่เลือก
  const harvestDate = (() => {
    if (!plantedDate) return null;
    if (isCorn && selItems.length > 0) {
      const minDays = Math.min(...selItems.map(s => s.days_to_harvest ?? 999).filter(d => d < 999));
      if (minDays < 999) {
        const d = new Date(plantedDate);
        d.setDate(d.getDate() + minDays);
        return d.toISOString().slice(0, 10);
      }
    }
    if (!isCorn && harvestManual) return harvestManual;
    return null;
  })();

  // quota รวมจากทุกบิล
  const quotaKg = (() => {
    if (!isCorn || selItems.length === 0) return null;
    return selItems.reduce((sum, item) => {
      const bagKg  = item.bag_weight_kg ?? 10;
      const ratio  = item.yield_ratio_kg ?? 600;
      return sum + (item.qty * bagKg * ratio);
    }, 0);
  })();

  const seasonYear = harvestDate ? calcSeasonYear(harvestDate) : (new Date().getFullYear() + 543);

  // product_id จากบิลแรก (ถ้ามี)
  const primaryProductId = selItems[0]?.product_id ?? null;

  function toggleItem(id:string) {
    setSelItemIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  /* ── Submit ── */
  async function handleSubmit() {
    if (!member?.member_id || !cropName || !plotId || !plantedDate) {
      setError(!plotId ? 'กรุณาเลือกแปลงก่อน' : 'กรุณากรอกข้อมูลให้ครบ'); return;
    }
    if (isCorn && selItemIds.size === 0) {
      setError('กรุณาเลือกรายการขายเมล็ดพันธุ์ที่สำเร็จแล้วอย่างน้อย 1 รายการ'); return;
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
        product_id:          primaryProductId,
        planted_at:          plantedDate,
        expected_harvest_at: harvestDate,
        area_planted_rai:    areaRai ? Number(areaRai) : null,
        season_year:         seasonYear,
        quota_kg:            quotaKg ?? null,
        status:              'growing',
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

  if (loading || !member?.member_id) return <LoadingState label="กำลังโหลด…" />;

  /* ── UI ── */
  return (
    <MobileAppShell title="สร้างรอบปลูกใหม่" subtitle="บันทึกข้อมูลการเพาะปลูก">
      <div className="mobile-stack" style={{ paddingBottom:24 }}>
        {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}

        {/* ชนิดพืช — dropdown จาก yield_config */}
        <label className="reg-label">ชนิดพืช <span className="reg-required">*</span>
          <select className="reg-input" value={cropName}
            onChange={e => { setCropName(e.target.value); setSelItemIds(new Set()); setHarvestManual(''); }}>
            {cropConfigs.map(c => (
              <option key={c.crop_type} value={c.crop_type}>
                {CROP_ICONS[c.crop_type] ?? '🌿'} {c.crop_type}
              </option>
            ))}
          </select>
        </label>

        {/* เลือกแปลง */}
        <label className="reg-label">เลือกแปลง <span className="reg-required">*</span>
          <select className="reg-input" value={plotId}
            onChange={e => { setPlotId(e.target.value); const p=plots.find(x=>x.id===e.target.value); if(p&&!areaRai) setAreaRai(String(p.area_rai)); }}>
            <option value="">— เลือกแปลง —</option>
            {plots.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}{p.province?` (${p.province})`:''} · {p.area_rai} ไร่
              </option>
            ))}
          </select>
          {plots.length === 0 && (
            <span className="reg-hint">ยังไม่มีแปลง — <a href="/plots/add" style={{ color:'var(--primary)' }}>เพิ่มแปลงก่อน</a></span>
          )}
        </label>

        {/* พื้นที่ + วันปลูก */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <label className="reg-label">พื้นที่ (ไร่)
            <input className="reg-input" type="number" step="0.5" value={areaRai}
              onChange={e => setAreaRai(e.target.value)} placeholder="0.0" />
          </label>
          <label className="reg-label">วันที่ปลูก <span className="reg-required">*</span>
            <input className="reg-input" type="date" value={plantedDate}
              onChange={e => setPlantedDate(e.target.value)}
              max={new Date().toISOString().slice(0,10)} />
          </label>
        </div>

        {/* ── ข้าวโพด: เลือกบิล (หลายบิล) ── */}
        {isCorn && (
          <div>
            <p className="reg-label" style={{ marginBottom:8 }}>
              รายการขายเมล็ดพันธุ์ที่สำเร็จแล้ว <span className="reg-required">*</span>
              <span style={{ fontSize:11, fontWeight:400, color:'#6B7280', marginLeft:6 }}>เลือกได้หลายรายการ</span>
            </p>

            {saleItems.length === 0 ? (
              <div style={{ padding:'14px 16px', background:'#FEF3C7', borderRadius:10, fontSize:13, color:'#92400E' }}>
                ⚠️ ยังไม่มีประวัติซื้อเมล็ดพันธุ์ข้าวโพดที่ขายสำเร็จแล้ว
              </div>
            ) : (
              <div style={{ border:'1.5px solid #E5E7EB', borderRadius:10, overflow:'hidden' }}>
                {saleItems.map((item, i) => {
                  const checked = selItemIds.has(item.id);
                  const bagKg   = item.bag_weight_kg ?? 10;
                  const ratio   = item.yield_ratio_kg ?? 600;
                  const itemQuota = item.qty * bagKg * ratio;
                  return (
                    <div key={item.id}
                      onClick={() => toggleItem(item.id)}
                      style={{ display:'flex', gap:12, padding:'12px 14px', cursor:'pointer', background:checked?'#F0FDF4':'#fff', borderBottom:i<saleItems.length-1?'1px solid #F3F4F6':'none', transition:'background .1s' }}>
                      <input type="checkbox" readOnly checked={checked}
                        style={{ width:16, height:16, accentColor:'#2D6A4F', flexShrink:0, marginTop:2 }} />
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                          <div>
                            <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#111' }}>
                              {item.product_name}
                            </p>
                            <p style={{ margin:'1px 0 0', fontSize:11, color:'#9CA3AF' }}>
                              {item.order_number} · {new Date(item.created_at).toLocaleDateString('th-TH')}
                            </p>
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <p style={{ margin:0, fontSize:13, fontWeight:700, color:'#2D6A4F' }}>
                              {item.qty} ถุง
                            </p>
                            <p style={{ margin:0, fontSize:10, color:'#9CA3AF' }}>
                              {bagKg} กก./ถุง
                            </p>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:12, marginTop:4 }}>
                          <span style={{ fontSize:11, color:'#6B7280' }}>📅 {item.days_to_harvest??'—'} วัน</span>
                          <span style={{ fontSize:11, color:'#059669', fontWeight:600 }}>
                            โควต้า {itemQuota.toLocaleString('th-TH')} กก.
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* สรุปบิลที่เลือก */}
            {selItems.length > 0 && (
              <div style={{ marginTop:8, background:'#F0FDF4', border:'1px solid #D1FAE5', borderRadius:8, padding:'10px 14px', fontSize:13 }}>
                <p style={{ margin:'0 0 4px', fontWeight:700, color:'#065F46' }}>
                  ✅ เลือก {selItems.length} รายการขาย
                </p>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                  <span style={{ color:'#374151' }}>
                    🌽 รวม {selItems.reduce((s,x)=>s+(x.qty*(x.bag_weight_kg??10)),0)} กก.เมล็ด
                  </span>
                  <span style={{ color:'#7C3AED', fontWeight:600 }}>
                    📦 โควต้ารวม {quotaKg?.toLocaleString('th-TH')} กก.
                  </span>
                  <span style={{ color:'#6B7280' }}>
                    📅 อายุน้อยสุด {Math.min(...selItems.map(s=>s.days_to_harvest??999).filter(d=>d<999))} วัน
                  </span>
                </div>
              </div>
            )}
          </div>
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
              {quotaKg ? ` · โควต้า ${quotaKg.toLocaleString('th-TH')} กก.` : ''}
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

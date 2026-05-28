'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCurrentMember } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { UIButton } from '@/shared/components/ui-button';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

type Plot = { id: string; name: string; province: string | null; area_rai: number };
type Variety = { id: string; variety_name: string; crop_type: string; days_to_harvest: number | null };

export default function NewPlantingCyclePage() {
  const router  = useRouter();
  const member  = useCurrentMember();
  const [plots, setPlots]         = useState<Plot[]>([]);
  const [varieties, setVarieties] = useState<Variety[]>([]);
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [cropName,    setCropName]    = useState('ข้าวโพด');
  const [plotId,      setPlotId]      = useState('');
  const [varietyId,   setVarietyId]   = useState('');
  const [plantedDate, setPlantedDate] = useState('');
  const [areaRai,     setAreaRai]     = useState('');
  const [seasonYear,  setSeasonYear]  = useState(String(new Date().getFullYear() + 543));
  const [notes,       setNotes]       = useState('');

  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      const s = createSupabaseBrowserClient();
      // ดึง plots ผ่าน API route (ข้าม RLS) แทน browser client
      const [pRes, vRes] = await Promise.all([
        fetch(`/api/member/plots?member_id=${member.member_id}`)
          .then(r => r.json()) as Promise<{ plots?: Plot[] }>,
        s.from('member_seed_variety_catalog').select('id,variety_name,crop_type,days_to_harvest'),
      ]);
      setPlots((pRes.plots as Plot[]) ?? []);
      setVarieties((vRes.data as Variety[]) ?? []);
      setLoading(false);
    })();
  }, [member?.member_id]);

  const selectedVariety = varieties.find((v) => v.id === varietyId);
  const harvestDate = plantedDate && selectedVariety?.days_to_harvest
    ? new Date(new Date(plantedDate).getTime() + selectedVariety.days_to_harvest * 86400000).toISOString().slice(0, 10)
    : null;

  async function handleSubmit() {
    if (!member?.member_id || !cropName || !plotId || !plantedDate) {
      setError('กรุณากรอกข้อมูลให้ครบ'); return;
    }
    setSubmitting(true); setError(null);
    const s = createSupabaseBrowserClient();
    const { data, error: e } = await s.from('planting_cycles').insert({
      member_id:          member.member_id,
      crop_name:          cropName,
      plot_id:            plotId,
      product_id:         varietyId || null,
      planted_at:         plantedDate,
      expected_harvest_at: harvestDate,
      area_planted_rai:   areaRai ? Number(areaRai) : null,
      season_year:        Number(seasonYear),
      status:             'planted',
      source:             'manual',
      member_note:        notes || null,
      confirmed_at:       new Date().toISOString(),
    }).select('id').single();
    setSubmitting(false);
    if (e) { setError(e.message); return; }
    router.replace(`/planting-cycles/${(data as { id: string }).id}`);
  }

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <MobileAppShell title="สร้างรอบปลูกใหม่" subtitle="บันทึกข้อมูลการเพาะปลูกของคุณ">
      <div className="mobile-stack" style={{ paddingBottom: 24 }}>
        {error && <ErrorState title="เกิดข้อผิดพลาด" detail={error} />}

        <label className="reg-label">ชนิดพืช <span className="reg-required">*</span>
          <input className="reg-input" value={cropName} onChange={(e) => setCropName(e.target.value)} placeholder="ข้าวโพด / ข้าว / มันสำปะหลัง" />
        </label>

        <label className="reg-label">เลือกแปลง <span className="reg-required">*</span>
          <select className="reg-input" value={plotId} onChange={(e) => { setPlotId(e.target.value); const p = plots.find((x) => x.id === e.target.value); if (p && !areaRai) setAreaRai(String(p.area_rai)); }}>
            <option value="">— เลือกแปลง —</option>
            {plots.map((p) => <option key={p.id} value={p.id}>{p.name} {p.province ? `(${p.province})` : ''} · {p.area_rai} ไร่</option>)}
          </select>
          {plots.length === 0 && <span className="reg-hint">ยังไม่มีแปลง — <a href="/plots/add" style={{ color: 'var(--primary)' }}>เพิ่มแปลงก่อน</a></span>}
        </label>

        <label className="reg-label">พันธุ์เมล็ด (ถ้ามี)
          <select className="reg-input" value={varietyId} onChange={(e) => { setVarietyId(e.target.value); const v = varieties.find((x) => x.id === e.target.value); if (v) setCropName(v.crop_type); }}>
            <option value="">— ไม่ระบุ —</option>
            {varieties.map((v) => <option key={v.id} value={v.id}>{v.variety_name} ({v.crop_type})</option>)}
          </select>
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="reg-label">วันที่ปลูก <span className="reg-required">*</span>
            <input className="reg-input" type="date" value={plantedDate} onChange={(e) => setPlantedDate(e.target.value)} max={new Date().toISOString().slice(0,10)} />
          </label>
          <label className="reg-label">พื้นที่ (ไร่)
            <input className="reg-input" type="number" step="0.5" value={areaRai} onChange={(e) => setAreaRai(e.target.value)} placeholder="0.0" />
          </label>
          <label className="reg-label">ฤดูกาล (ปี พ.ศ.)
            <input className="reg-input" type="number" value={seasonYear} onChange={(e) => setSeasonYear(e.target.value)} />
          </label>
        </div>

        {harvestDate && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontWeight: 600, color: '#1b5e20' }}>
            🌽 คาดเก็บเกี่ยว: {new Date(harvestDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
            <span style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>({selectedVariety?.days_to_harvest} วัน)</span>
          </div>
        )}

        <label className="reg-label">หมายเหตุ
          <textarea className="reg-input reg-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="บันทึกเพิ่มเติม…" />
        </label>

        <UIButton fullWidth onClick={handleSubmit} loading={submitting} disabled={submitting || !cropName || !plotId || !plantedDate}>
          🌱 สร้างรอบปลูก
        </UIButton>
        <UIButton variant="ghost" fullWidth onClick={() => router.back()}>← ยกเลิก</UIButton>
      </div>
    </MobileAppShell>
  );
}

'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember }            from '@/providers/auth-provider';
import { MobileAppShell }              from '@/shared/components/mobile-app-shell';
import { LoadingState }                from '@/shared/components/loading-state';
import { ErrorState }                  from '@/shared/components/error-state';
import { UIButton }                    from '@/shared/components/ui-button';
import { NoBurnObservationForm }       from '@/features/no-burn-community/no-burn-observation-form';
import { InspectorSoilForm }           from '@/features/inspection-tasks/inspector-soil-form';

type Task = {
  id: string; result_status: string; result_note: string | null;
  assigned_at: string; visited_at: string | null;
  gps_lat: number | null; gps_lng: number | null;
  // Soil A
  soil_color: string | null; soil_texture: string | null;
  soil_drainage: string | null; soil_moisture: string | null;
  soil_issues: string[] | null; soil_note: string | null;
  // Cert C
  cert_agency: string | null; cert_number: string | null;
  cert_issued_date: string | null; cert_expires_date: string | null;
  // Lab
  lab_submitted: boolean; lab_name: string | null;
  lab_submitted_at: string | null; lab_tracking_no: string | null;
  lab_result_at: string | null; lab_ph: number | null; lab_om_pct: number | null;
  lab_result_note: string | null;
  plots:            { id: string; name: string; province: string | null; area_rai: number | null; lat: number | null; lng: number | null }[] | null;
  members:          { full_name: string; phone: string | null }[] | null;
  no_burn_requests: { id: string; status: string; timing: 'before_planting' | 'after_planting' | null; note: string | null }[] | null;
};

const RESULT_CFG: Record<string, { label: string; color: string; bg: string }> = {
  passed:       { label: '✅ ผ่านการตรวจ',         color: '#1b5e20', bg: '#e8f5e9' },
  failed:       { label: '❌ ไม่ผ่านการตรวจ',      color: '#c62828', bg: '#ffebee' },
  needs_update: { label: '📋 ต้องแก้ไขเพิ่มเติม', color: '#e65100', bg: '#fff8e1' },
  completed:    { label: '✓ ปิดงานแล้ว',            color: '#2e7d32', bg: '#e8f5e9' },
};

const SOIL_COLOR_LABEL: Record<string, string> = {
  dark_brown: '🟫 น้ำตาลเข้ม', brown: '🟤 น้ำตาล', red: '🔴 แดง',
  grey: '⚫ เทา', black: '⬛ ดำ', other: '— อื่นๆ',
};
const SOIL_TEXTURE_LABEL: Record<string, string> = {
  sandy: '🏖️ ทราย', loamy: '✅ ร่วน', clay: '🧱 เหนียว', silty: '💧 ตะกอน', rocky: '🪨 กรวด',
};
const SOIL_DRAINAGE_LABEL: Record<string, string> = {
  good: '✅ ดี', moderate: '🟡 ปานกลาง', poor: '🟠 แย่', waterlogged: '🔴 น้ำขัง',
};
const SOIL_MOISTURE_LABEL: Record<string, string> = {
  dry: '☀️ แห้ง', moist: '✅ ชื้น', wet: '💧 เปียก', saturated: '🌊 อิ่มตัว',
};
const SOIL_ISSUE_LABEL: Record<string, string> = {
  erosion: '🌀 กัดเซาะ', compaction: '🧱 อัดแน่น',
  saline: '🧂 เค็ม', acidic: '🧪 เป็นกรด', weed: '🌿 วัชพืช',
};

const TIMING_LABEL: Record<string, { icon: string; label: string; color: string; bg: string }> = {
  before_planting: { icon: '🌱', label: 'ก่อนลงแปลง',     color: '#1565c0', bg: '#e3f2fd' },
  after_planting:  { icon: '🌿', label: 'หลังลงแปลงแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
};

const S = {
  card: { background: '#fff', border: '1px solid var(--border,#d8e0db)', borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 10 } as React.CSSProperties,
  sectionTitle: { margin: 0, fontWeight: 700, fontSize: 14 } as React.CSSProperties,
  row: { display: 'flex', gap: 8, flexWrap: 'wrap' as const },
  chip: { fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#14532d' } as React.CSSProperties,
  chipWarn: { fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' } as React.CSSProperties,
};

type Props = { params: { id: string } };

export default function InspectionTaskDetailPage({ params }: Props) {
  const member  = useCurrentMember();
  const router  = useRouter();
  const [task,    setTask]    = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [notice,  setNotice]  = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data, error: e } = await s.from('inspections')
        .select(`id,result_status,result_note,assigned_at,visited_at,gps_lat,gps_lng,
          soil_color,soil_texture,soil_drainage,soil_moisture,soil_issues,soil_note,
          cert_agency,cert_number,cert_issued_date,cert_expires_date,
          lab_submitted,lab_name,lab_submitted_at,lab_tracking_no,
          lab_result_at,lab_ph,lab_om_pct,lab_result_note,
          plots(id,name,province,area_rai,lat,lng),
          members:inspector_member_id(full_name,phone),
          no_burn_requests(id,status,timing,note)`)
        .eq('id', params.id).maybeSingle();
      if (e) setError(e.message);
      else   setTask(data as Task);
      setLoading(false);
    })();
  }, [params.id]);

  if (loading) return <LoadingState label="กำลังโหลด…" />;
  if (error || !task) return <ErrorState title="ไม่พบข้อมูล" detail={error ?? ''} />;

  const isDone    = ['passed','failed','needs_update','completed'].includes(task.result_status);
  const resultCfg = RESULT_CFG[task.result_status];
  const noBurnReq = task.no_burn_requests?.[0] ?? null;
  const timingCfg = noBurnReq?.timing ? TIMING_LABEL[noBurnReq.timing] : null;
  const plot      = task.plots?.[0] ?? null;
  const farmer    = task.members?.[0] ?? null;
  const hasSoil   = task.soil_color || task.soil_texture || task.soil_drainage || task.soil_moisture;
  const hasCert   = task.cert_agency || task.cert_number;
  const hasLabPending = task.lab_submitted && !task.lab_result_at;
  const hasLabResult  = task.lab_submitted && task.lab_result_at;

  return (
    <MobileAppShell title="บันทึกผลตรวจ" subtitle="ตรวจสอบและบันทึกผลการตรวจแปลง">
      <div className="mobile-stack" style={{ paddingBottom: 24 }}>
        <Link href="/inspection/tasks"
          style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
          ← กลับรายการ
        </Link>

        {notice && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>
            {notice}
          </div>
        )}

        {/* ── Plot hero ── */}
        <div className="kaona-card" style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff' }}>
          <p style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>{plot?.name ?? '—'}</p>
          {plot?.province  && <p style={{ margin: '2px 0 0', fontSize: 14, opacity: .85 }}>{plot.province}</p>}
          {plot?.area_rai  && <p style={{ margin: '2px 0 0', fontSize: 13, opacity: .8 }}>พื้นที่ {plot.area_rai} ไร่</p>}
          <p style={{ margin: '8px 0 0', fontSize: 14, opacity: .85 }}>
            👤 {farmer?.full_name ?? '—'}{farmer?.phone ? ` · ${farmer.phone}` : ''}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 12, opacity: .75 }}>
            📅 มอบหมาย {new Date(task.assigned_at).toLocaleDateString('th-TH',{ day:'numeric', month:'short', year:'numeric' })}
          </p>
        </div>

        {/* ── No-burn context ── */}
        {noBurnReq && (
          <div className="kaona-card" style={{ background: '#fafffe', border: '1px solid #bbf7d0' }}>
            <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700 }}>🔥 คำขอดเผา</p>
            {timingCfg && (
              <span style={{ display:'inline-block', fontSize:12, fontWeight:700, padding:'3px 12px', borderRadius:999, background:timingCfg.bg, color:timingCfg.color }}>
                {timingCfg.icon} {timingCfg.label}
              </span>
            )}
            {noBurnReq.note && <p style={{ margin:'4px 0 0', fontSize:12, color:'#6b7280' }}>📝 {noBurnReq.note}</p>}
          </div>
        )}

        {/* ── Google Maps link ── */}
        {plot?.lat && plot?.lng && (
          <a href={`https://maps.google.com/?q=${plot.lat},${plot.lng}`}
            target="_blank" rel="noopener noreferrer" className="kaona-card"
            style={{ display:'flex', alignItems:'center', gap:12, textDecoration:'none', color:'var(--text-primary)' }}>
            <span style={{ fontSize:24 }}>📍</span>
            <div>
              <p style={{ margin:0, fontWeight:700, fontSize:14 }}>เปิดใน Google Maps</p>
              <p style={{ margin:0, fontSize:12, color:'var(--text-secondary)' }}>{plot.lat.toFixed(5)}, {plot.lng.toFixed(5)}</p>
            </div>
            <span style={{ marginLeft:'auto', fontSize:18, color:'var(--text-secondary)' }}>›</span>
          </a>
        )}

        {/* ── Result badge ── */}
        {isDone && resultCfg && (
          <div className="kaona-card" style={{ background: resultCfg.bg }}>
            <p style={{ margin:0, fontWeight:800, fontSize:16, color:resultCfg.color }}>{resultCfg.label}</p>
            {task.result_note && <p style={{ margin:'6px 0 0', fontSize:14, color:'var(--text-secondary)' }}>{task.result_note}</p>}
            {task.visited_at && (
              <p style={{ margin:'4px 0 0', fontSize:12, color:'var(--text-secondary)' }}>
                ตรวจเมื่อ {new Date(task.visited_at).toLocaleDateString('th-TH',{ day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
              </p>
            )}
            {task.gps_lat && task.gps_lng && (
              <p style={{ margin:'4px 0 0', fontSize:11, color:resultCfg.color, opacity:.7 }}>
                📍 GPS: {task.gps_lat.toFixed(5)}, {task.gps_lng.toFixed(5)}
              </p>
            )}
          </div>
        )}

        {/* ── A: ผลประเมินดิน ── */}
        {isDone && hasSoil && (
          <div style={S.card}>
            <p style={S.sectionTitle}>🪱 สภาพดิน</p>
            <div style={S.row}>
              {task.soil_color    && <span style={S.chip}>{SOIL_COLOR_LABEL[task.soil_color]    ?? task.soil_color}</span>}
              {task.soil_texture  && <span style={S.chip}>{SOIL_TEXTURE_LABEL[task.soil_texture]  ?? task.soil_texture}</span>}
              {task.soil_drainage && <span style={S.chip}>{SOIL_DRAINAGE_LABEL[task.soil_drainage] ?? task.soil_drainage}</span>}
              {task.soil_moisture && <span style={S.chip}>{SOIL_MOISTURE_LABEL[task.soil_moisture] ?? task.soil_moisture}</span>}
            </div>
            {(task.soil_issues?.length ?? 0) > 0 && (
              <div style={S.row}>
                {task.soil_issues!.map((v) => (
                  <span key={v} style={S.chipWarn}>{SOIL_ISSUE_LABEL[v] ?? v}</span>
                ))}
              </div>
            )}
            {task.soil_note && <p style={{ margin:0, fontSize:13, color:'var(--text-secondary,#4e5a53)' }}>📝 {task.soil_note}</p>}
          </div>
        )}

        {/* ── C: ใบรับรอง ── */}
        {isDone && hasCert && (
          <div style={S.card}>
            <p style={S.sectionTitle}>🏛️ ใบรับรองหน่วยงาน</p>
            {task.cert_agency  && <p style={{ margin:0, fontSize:13 }}>หน่วยงาน: <strong>{task.cert_agency}</strong></p>}
            {task.cert_number  && <p style={{ margin:0, fontSize:13 }}>เลขที่: <strong>{task.cert_number}</strong></p>}
            {task.cert_issued_date  && <p style={{ margin:0, fontSize:12, color:'var(--text-secondary,#4e5a53)' }}>ออกเมื่อ: {task.cert_issued_date}</p>}
            {task.cert_expires_date && <p style={{ margin:0, fontSize:12, color:'var(--text-secondary,#4e5a53)' }}>หมดอายุ: {task.cert_expires_date}</p>}
          </div>
        )}

        {/* ── Lab: รอผล ── */}
        {isDone && hasLabPending && (
          <div style={{ ...S.card, background:'#fffbeb', borderColor:'#fde68a' }}>
            <p style={{ margin:0, fontWeight:700, fontSize:14, color:'#92400e' }}>🧪 ส่งดินตรวจแล็บ — รอผล</p>
            {task.lab_name         && <p style={{ margin:0, fontSize:13 }}>แล็บ: <strong>{task.lab_name}</strong></p>}
            {task.lab_submitted_at && <p style={{ margin:0, fontSize:12, color:'#92400e' }}>ส่งเมื่อ: {task.lab_submitted_at}</p>}
            {task.lab_tracking_no  && <p style={{ margin:0, fontSize:12, color:'#92400e' }}>เลขติดตาม: {task.lab_tracking_no}</p>}
            <p style={{ margin:0, fontSize:11, color:'#92400e', opacity:.8 }}>⏳ รอผลจากห้องปฏิบัติการ — admin จะอัปเดตเมื่อได้รับรายงาน</p>
          </div>
        )}

        {/* ── Lab: มีผลแล้ว ── */}
        {isDone && hasLabResult && (
          <div style={{ ...S.card, background:'#f0fdf4', borderColor:'#86efac' }}>
            <p style={{ margin:0, fontWeight:700, fontSize:14, color:'#14532d' }}>🧪 ผลวิเคราะห์ดิน</p>
            {task.lab_name && <p style={{ margin:0, fontSize:13 }}>แล็บ: <strong>{task.lab_name}</strong></p>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:4 }}>
              {task.lab_ph !== null && (
                <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:'1px solid #86efac' }}>
                  <p style={{ margin:0, fontSize:11, color:'var(--text-secondary,#4e5a53)' }}>pH ดิน</p>
                  <p style={{ margin:'2px 0 0', fontSize:22, fontWeight:800, color:'#14532d' }}>{task.lab_ph}</p>
                </div>
              )}
              {task.lab_om_pct !== null && (
                <div style={{ background:'#fff', borderRadius:10, padding:'10px 12px', border:'1px solid #86efac' }}>
                  <p style={{ margin:0, fontSize:11, color:'var(--text-secondary,#4e5a53)' }}>อินทรียวัตถุ</p>
                  <p style={{ margin:'2px 0 0', fontSize:22, fontWeight:800, color:'#14532d' }}>{task.lab_om_pct}%</p>
                </div>
              )}
            </div>
            {task.lab_result_note && <p style={{ margin:0, fontSize:13, color:'var(--text-secondary,#4e5a53)' }}>📝 {task.lab_result_note}</p>}
            {task.lab_result_at && <p style={{ margin:0, fontSize:11, color:'var(--text-secondary,#4e5a53)' }}>ได้รับผลเมื่อ: {task.lab_result_at}</p>}
          </div>
        )}

        {/* ── Form (if not done) ── */}
        {!isDone && (
          <>
            {!showForm ? (
              <UIButton fullWidth onClick={() => setShowForm(true)}>
                📝 บันทึกผลการตรวจ
              </UIButton>
            ) : (
              <div className="kaona-card">
                <InspectorSoilForm
                  inspectionId={task.id}
                  plotName={plot?.name}
                  farmerName={farmer?.full_name}
                  noBurnRequestId={noBurnReq?.id}
                  memberId={member?.member_id}
                  plotId={plot?.id}
                  onSuccess={() => {
                    setShowForm(false);
                    setNotice('✅ บันทึกผลการตรวจแล้ว รอแอดมินอนุมัติขั้นสุดท้าย');
                    setTask((p) => p ? { ...p, result_status: 'passed' } : p);
                    setTimeout(() => router.refresh(), 1200);
                  }}
                />
                <UIButton variant="ghost" fullWidth onClick={() => setShowForm(false)}
                  style={{ marginTop: 8, fontSize: 13 }}>
                  ยกเลิก
                </UIButton>
              </div>
            )}
          </>
        )}

        {/* ── No-burn observation ── */}
        {noBurnReq?.id && <NoBurnObservationForm noBurnRequestId={noBurnReq.id} />}
      </div>
    </MobileAppShell>
  );
}

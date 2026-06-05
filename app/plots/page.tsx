'use client';

import Link                    from 'next/link';
import { type CSSProperties, useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth, useCurrentMember }      from '@/providers/auth-provider';
import type { AuthBootstrapResult }         from '@/shared/auth/auth-types';
import { getAuthHeaders }                 from '@/lib/auth/get-auth-headers';
import { MasterpieceCard }                from '@/features/member-planting/masterpiece-card';
import { MobileAppShell }                 from '@/shared/components/mobile-app-shell';
import { LoadingState }                   from '@/shared/components/loading-state';
import { ProtectedRoute }                 from '@/shared/components/protected-route';
import { Weather7Day }                    from '@/features/weather/weather-widget';

type Plot = {
  id: string; name: string; area_rai: number;
  province: string | null; district: string | null;
  subdistrict: string | null; village: string | null;
  status: string; land_doc_type: string | null;
  land_doc_number: string | null; description: string | null;
  lat: number | null; lng: number | null;
};
type ActiveCycle = { id: string; crop_name: string; season_year: number; status: string; plot_id: string | null; planted_at?: string | null };
type LastLog = { activity_type: string; recorded_at: string };
type NoBurnStatus = { plot_id: string; status: string };

const QUICK_LOG = [
  { type: 'water',        icon: '💧', label: 'น้ำ' },
  { type: 'fertilize',    icon: '🌿', label: 'ปุ๋ย' },
  { type: 'growth_check', icon: '📏', label: 'วัด' },
  { type: 'pest_found',   icon: '🐛', label: 'แมลง', alert: true },
  { type: 'heavy_rain',   icon: '🌧️', label: 'ฝน' },
  { type: 'other',        icon: '📝', label: 'อื่นๆ' },
];
const CYCLE_STATUS_TH: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'วางแผน',     color: '#6b7280', bg: '#f3f4f6' },
  growing:   { label: 'กำลังโต',    color: '#2e7d32', bg: '#e8f5e9' },
  confirmed: { label: 'ยืนยันแล้ว', color: '#2e7d32', bg: '#e8f5e9' },
  flowering: { label: 'ออกดอก',     color: '#7b1fa2', bg: '#f3e5f5' },
  maturing:  { label: 'กำลังแก่',   color: '#e65100', bg: '#fff3e0' },
  ready:     { label: 'พร้อมเก็บ',  color: '#c62828', bg: '#ffebee' },
};
const NO_BURN_TH: Record<string, { icon: string; color: string }> = {
  submitted: { icon: '⏳', color: '#854F0B' }, under_review: { icon: '🔍', color: '#0C447C' },
  approved:  { icon: '✅', color: '#27500A' }, completed:    { icon: '✅', color: '#27500A' },
  rejected:  { icon: '⛔', color: '#444441' },
};
const DOC_TH: Record<string, string> = {
  title_deed: 'โฉนด', ns3k: 'นส.3ก', ns3: 'นส.3',
  sk1: 'สค.1', por_btor_6: 'ภบท.6', other: 'อื่นๆ',
};
const LAND_DOC_TYPES = [
  { value: 'title_deed', label: 'โฉนด (นส.4)' }, { value: 'ns3k', label: 'นส.3ก' },
  { value: 'ns3', label: 'นส.3' },               { value: 'sk1',  label: 'สค.1' },
  { value: 'por_btor_6', label: 'ภบท.6' },        { value: 'other', label: 'อื่นๆ' },
];

function relDate(d: string) {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (diff < 1) return 'เมื่อกี้';
  if (diff < 60) return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 1440)} วันที่แล้ว`;
}

// ── QuickLogBar ───────────────────────────────────────────────────────────────
function QuickLogBar({ cycleId, plotId, memberId, onLogged }: { cycleId: string; plotId: string; memberId: string; onLogged: (type: string) => void }) {
  const [saving, setSaving] = useState<string | null>(null);
  const [done,   setDone]   = useState<string | null>(null);
  async function tap(type: string) {
    if (saving) return;
    setSaving(type);
    const sb = tryCreateSupabaseBrowserClient()!;
    await sb.from('farm_activity_logs').insert({ planting_cycle_id: cycleId, member_id: memberId, plot_id: plotId, activity_type: type, recorded_at: new Date().toISOString() });
    setSaving(null); setDone(type); onLogged(type);
    setTimeout(() => setDone(null), 2000);
  }
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
      {QUICK_LOG.map((q) => {
        const isDone = done === q.type; const isSaving = saving === q.type;
        return (
          <button key={q.type} onClick={() => tap(q.type)} disabled={!!saving}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 20, border: `1.5px solid ${q.alert ? '#854F0B55' : isDone ? '#2e7d32' : '#e5e7eb'}`, background: isDone ? '#e8f5e9' : q.alert ? '#fff8f0' : '#fafafa', cursor: saving ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, color: isDone ? '#2e7d32' : q.alert ? '#854F0B' : '#374151', opacity: saving && !isSaving ? 0.5 : 1 }}>
            <span>{isSaving ? '⏳' : isDone ? '✓' : q.icon}</span>{q.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Edit Modal (inline, pending_review only) ──────────────────────────────────
function EditPlotModal({ plot, onSave, onClose }: { plot: Plot; onSave: (updated: Partial<Plot>) => void; onClose: () => void }) {
  const [name,        setName]        = useState(plot.name);
  const [areaRai,     setAreaRai]     = useState(String(plot.area_rai));
  const [province,    setProvince]    = useState(plot.province ?? '');
  const [district,    setDistrict]    = useState(plot.district ?? '');
  const [subdistrict, setSubdistrict] = useState(plot.subdistrict ?? '');
  const [village,     setVillage]     = useState(plot.village ?? '');
  const [landDocType, setLandDocType] = useState(plot.land_doc_type ?? '');
  const [landDocNum,  setLandDocNum]  = useState(plot.land_doc_number ?? '');
  const [description, setDescription] = useState(plot.description ?? '');
  const [saving,      setSaving]      = useState(false);
  const [err,         setErr]         = useState<string | null>(null);

  const member = useCurrentMember();
  const INP = { padding: '9px 12px', border: '1.5px solid #E5E7EB', borderRadius: 8, fontSize: 13, width: '100%', boxSizing: 'border-box' as const };
  const LBL = { display: 'grid', gap: 4, fontSize: 12, fontWeight: 600, color: '#374151' } as CSSProperties;

  async function save() {
    if (!name.trim()) { setErr('กรุณาระบุชื่อแปลง'); return; }
    if (!areaRai || Number(areaRai) <= 0) { setErr('กรุณาระบุพื้นที่'); return; }
    if (!member) return;
    setSaving(true); setErr(null);
    const { headers, url } = await getAuthHeaders(member, '/api/member/plots');
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plot_id: plot.id, name: name.trim(), area_rai: Number(areaRai),
        province: province || null, district: district || null,
        subdistrict: subdistrict || null, village: village || null,
        land_doc_type: landDocType || null, land_doc_number: landDocNum || null,
        description: description || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setErr(d.error ?? 'บันทึกไม่สำเร็จ'); return; }
    onSave({ name: name.trim(), area_rai: Number(areaRai), province: province || null, district: district || null, subdistrict: subdistrict || null, village: village || null, land_doc_type: landDocType || null, land_doc_number: landDocNum || null, description: description || null });
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>✏️ แก้ไขแปลง: {plot.name}</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fee2e2', color: '#991b1b', fontSize: 13 }}>{err}</div>}
          <label style={LBL}>ชื่อแปลง *<input style={INP} value={name} onChange={e => setName(e.target.value)} /></label>
          <label style={LBL}>พื้นที่ (ไร่) *<input style={INP} type="number" step="0.25" value={areaRai} onChange={e => setAreaRai(e.target.value)} /></label>
          <label style={LBL}>จังหวัด<input style={INP} value={province} onChange={e => setProvince(e.target.value)} placeholder="อุบลราชธานี" /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={LBL}>อำเภอ<input style={INP} value={district} onChange={e => setDistrict(e.target.value)} /></label>
            <label style={LBL}>ตำบล<input style={INP} value={subdistrict} onChange={e => setSubdistrict(e.target.value)} /></label>
          </div>
          <label style={LBL}>หมู่บ้าน<input style={INP} value={village} onChange={e => setVillage(e.target.value)} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={LBL}>เอกสารสิทธิ์
              <select style={INP} value={landDocType} onChange={e => setLandDocType(e.target.value)}>
                <option value="">ไม่มี</option>
                {LAND_DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>
            <label style={LBL}>เลขที่<input style={INP} value={landDocNum} onChange={e => setLandDocNum(e.target.value)} /></label>
          </div>
          <label style={LBL}>หมายเหตุ<textarea style={{ ...INP, resize: 'vertical' }} rows={2} value={description} onChange={e => setDescription(e.target.value)} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, paddingBottom: 8 }}>
            <button onClick={onClose} style={{ padding: 12, borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 14, cursor: 'pointer' }}>ยกเลิก</button>
            <button onClick={save} disabled={saving} style={{ padding: 12, borderRadius: 10, border: 'none', background: saving ? '#d1fae5' : '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              {saving ? 'กำลังบันทึก…' : '💾 บันทึก'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Sheet ──────────────────────────────────────────────────────
function DeleteConfirmSheet({ plotName, onConfirm, onClose, deleting }: { plotName: string; onConfirm: () => void; onClose: () => void; deleting: boolean }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: '24px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗑️</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>ลบแปลง "{plotName}"?</h3>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>แปลงจะถูกซ่อน ไม่ลบข้อมูลจริง<br/>สามารถติดต่อแอดมินเพื่อกู้คืนได้</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={onClose} disabled={deleting} style={{ padding: 14, borderRadius: 12, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>ยกเลิก</button>
          <button onClick={onConfirm} disabled={deleting} style={{ padding: 14, borderRadius: 12, border: 'none', background: deleting ? '#fca5a5' : '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            {deleting ? 'กำลังลบ…' : '🗑️ ลบแปลง'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PlotCard ──────────────────────────────────────────────────────────────────
function PlotCard({ plot, cycle, lastLog, noBurnStatus, memberId, onLogged, onDeleted, onEdited }: {
  plot: Plot; cycle: ActiveCycle | null; lastLog: LastLog | null;
  noBurnStatus: string | null; memberId: string;
  onLogged: (plotId: string, type: string) => void;
  onDeleted: (plotId: string) => void;
  onEdited: (plotId: string, updated: Partial<Plot>) => void;
  member: AuthBootstrapResult;
}) {
  const router = useRouter();
  const member = useCurrentMember();
  const [notice,      setNotice]      = useState<string | null>(null);
  const [showEdit,    setShowEdit]    = useState(false);
  const [showDelete,  setShowDelete]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);

  const st = cycle ? (CYCLE_STATUS_TH[cycle.status] ?? CYCLE_STATUS_TH.growing) : null;
  const noBurnCfg = noBurnStatus ? NO_BURN_TH[noBurnStatus] : null;
  const isPending = plot.status === 'pending_review';

  async function confirmDelete() {
    if (!member) return;
    setDeleting(true);
    const { headers, url } = await getAuthHeaders(member, '/api/member/plots');
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plot_id: plot.id }),
    });
    setDeleting(false);
    if (res.ok) { setShowDelete(false); onDeleted(plot.id); }
  }

  return (
    <>
      <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #e8ede8', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f5f5f5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: '#111' }}>{plot.name}</p>
                {isPending && (
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 99, background: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                    รอตรวจ
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#6b7280' }}>📐 {plot.area_rai} ไร่</span>
                {plot.province && <span style={{ fontSize: 11, color: '#6b7280' }}>📍 {[plot.province, plot.district, plot.subdistrict].filter(Boolean).join(' · ')}</span>}
                {plot.village  && <span style={{ fontSize: 11, color: '#9ca3af' }}>🏡 {plot.village}</span>}
                {plot.land_doc_type && <span style={{ fontSize: 11, color: '#6b7280' }}>{DOC_TH[plot.land_doc_type] ?? plot.land_doc_type}</span>}
              </div>
            </div>
            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 8 }}>
              {isPending && (
                <button onClick={() => setShowEdit(true)}
                  style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #d1d5db', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#374151' }}>
                  ✏️ แก้ไข
                </button>
              )}
              <button onClick={() => setShowDelete(true)}
                style={{ padding: '5px 10px', borderRadius: 8, border: '1.5px solid #fca5a5', background: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: '#dc2626' }}>
                🗑️
              </button>
            </div>
          </div>
          {!noBurnCfg && (
            <Link href="/no-burn" style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: '#9ca3af', textDecoration: 'none' }}>
              🌿 สมัครงดเผา
            </Link>
          )}
          {noBurnCfg && (
            <span style={{ display: 'inline-block', marginTop: 6, fontSize: 11, fontWeight: 700, color: noBurnCfg.color }}>
              {noBurnCfg.icon} งดเผา
            </span>
          )}
        </div>

        {/* Cycle */}
        {/* MasterpieceCard — AI วิเคราะห์รูปแปลง */}
        <MasterpieceCard plotId={plot.id} cycle={cycle} member={member!} />

        {/* Quick log ถ้ามี cycle */}
        {cycle && (
          <div style={{ padding: '6px 16px 10px', borderTop: '1px solid #f5f5f5' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Link href={`/planting-cycles/${cycle.id}`} style={{ textDecoration: 'none', fontSize: 13, color: '#2e7d32', fontWeight: 700 }}>
                🌱 {cycle.crop_name} {cycle.season_year} →
              </Link>
              <Link href={`/planting-cycles/${cycle.id}/activity`}
                style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: '#e8f5e9', color: '#2e7d32', textDecoration: 'none', border: '1px solid #a5d6a7' }}>
                ดูบันทึก
              </Link>
            </div>
            <QuickLogBar cycleId={cycle.id} plotId={plot.id} memberId={memberId} onLogged={(type) => onLogged(plot.id, type)} />
            {lastLog && (
              <p style={{ margin: '6px 0 0', fontSize: 11, color: '#9ca3af' }}>
                ล่าสุด: {QUICK_LOG.find(q => q.type === lastLog.activity_type)?.icon ?? '📝'} {QUICK_LOG.find(q => q.type === lastLog.activity_type)?.label ?? lastLog.activity_type} · {relDate(lastLog.recorded_at)}
              </p>
            )}
          </div>
        )}

        {/* Action row */}
        <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!cycle ? (
            <Link href={`/planting-cycles/new?plot_id=${plot.id}`} style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 10, background: '#2e7d32', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              🌱 เปิดรอบปลูก
            </Link>
          ) : (
            <Link href={`/planting-cycles/${cycle.id}`} style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 10, background: '#f0f4f0', color: '#374151', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              📋 รอบปลูก
            </Link>
          )}
          <Link href={`/service/reservations?plot_id=${plot.id}`} style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 10, background: '#fff8e1', color: '#e65100', fontSize: 12, fontWeight: 700, textDecoration: 'none', border: '1px solid #ffe082' }}>
            🌽 จองเมล็ด
          </Link>
          {cycle && (
            <Link href={`/harvest/book?cycle_id=${cycle.id}`} style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 10, background: '#e3f2fd', color: '#1565c0', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              🚜 เกี่ยว
            </Link>
          )}
        </div>

        {plot.lat && plot.lng && (
          <div style={{ padding: '0 14px 14px' }}>
            <Weather7Day lat={plot.lat} lng={plot.lng} location={plot.province ?? plot.name} />
          </div>
        )}
      </div>

      {/* Edit modal */}
      {showEdit && isPending && (
        <EditPlotModal
          plot={plot}
          onSave={(updated) => { setShowEdit(false); onEdited(plot.id, updated); }}
          onClose={() => setShowEdit(false)}
        />
      )}

      {/* Delete confirm */}
      {showDelete && (
        <DeleteConfirmSheet
          plotName={plot.name}
          deleting={deleting}
          onConfirm={confirmDelete}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function PlotsContent() {
  const { status } = useAuth();
  const member = useCurrentMember();
  const router = useRouter();

  const [plots,     setPlots]     = useState<Plot[]>([]);
  const [cycles,    setCycles]    = useState<ActiveCycle[]>([]);
  const [lastLogs,  setLastLogs]  = useState<Record<string, LastLog>>({});
  const [noBurnMap, setNoBurnMap] = useState<Record<string, string>>({});
  const [loading,   setLoading]   = useState(true);
  const [notice,    setNotice]    = useState<string | null>(null);

  async function load() {
    if (!member?.member_id) return;
    setLoading(true);
    const { headers, url: plotsUrl } = await getAuthHeaders(member, '/api/member/plots');
    const cyclesUrl = new URL('/api/member/planting-cycles', window.location.origin);
    cyclesUrl.searchParams.set('line_user_id', member.line_user_id);

    const [plotsRes, cyclesRes] = await Promise.all([
      fetch(plotsUrl, { headers }).then(r => r.json() as Promise<{ plots?: Plot[] }>),
      fetch(cyclesUrl.toString(), { headers }).then(r => r.json() as Promise<{ cycles?: ActiveCycle[] }>),
    ]);

    const loadedPlots  = plotsRes.plots ?? [];
    const loadedCycles = cyclesRes.cycles ?? [];
    setPlots(loadedPlots);
    setCycles(loadedCycles);

    if (loadedPlots.length > 0) {
      const sb = tryCreateSupabaseBrowserClient();
      if (sb) {
        const plotIds = loadedPlots.map(p => p.id);
        const [logsRes, nbRes] = await Promise.all([
          sb.from('farm_activity_logs').select('plot_id,activity_type,recorded_at').in('plot_id', plotIds).eq('member_id', member.member_id).order('recorded_at', { ascending: false }).limit(50),
          sb.from('no_burn_requests').select('plot_id,status').in('plot_id', plotIds).eq('member_id', member.member_id).is('deleted_at', null).not('status', 'in', '(rejected,completed)'),
        ]);
        const logMap: Record<string, LastLog> = {};
        for (const row of (logsRes.data ?? []) as (LastLog & { plot_id: string })[]) {
          if (!logMap[row.plot_id]) logMap[row.plot_id] = row;
        }
        setLastLogs(logMap);
        const nbMap: Record<string, string> = {};
        for (const row of (nbRes.data ?? []) as NoBurnStatus[]) nbMap[row.plot_id] = row.status;
        setNoBurnMap(nbMap);
      }
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [member?.member_id]);

  if (status === 'loading' || loading) return <LoadingState label="กำลังโหลดแปลง…" />;

  function handleDeleted(plotId: string) {
    setPlots(prev => prev.filter(p => p.id !== plotId));
    setNotice('🗑️ ลบแปลงแล้ว');
    setTimeout(() => setNotice(null), 3000);
  }

  function handleEdited(plotId: string, updated: Partial<Plot>) {
    setPlots(prev => prev.map(p => p.id === plotId ? { ...p, ...updated } : p));
    setNotice('✅ อัปเดตแปลงแล้ว');
    setTimeout(() => setNotice(null), 3000);
  }

  return (
    <div className="mobile-stack">
      {notice && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#e8f5e9', color: '#1b5e20', fontSize: 13, fontWeight: 600 }}>
          {notice}
        </div>
      )}

      {plots.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 56 }}>🌾</div>
          <h3 style={{ margin: '12px 0 4px' }}>ยังไม่มีแปลง</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>เพิ่มแปลงเกษตรเพื่อเริ่มติดตามการเพาะปลูก</p>
          <button onClick={() => router.push('/plots/add')} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: '#2e7d32', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            + เพิ่มแปลงแรก
          </button>
        </div>
      )}

      {plots.map((plot) => (
        <PlotCard
          key={plot.id}
          plot={plot}
          cycle={cycles.find(c => c.plot_id === plot.id) ?? null}
          lastLog={lastLogs[plot.id] ?? null}
          noBurnStatus={noBurnMap[plot.id] ?? null}
          memberId={member!.member_id}
          member={member!}
          onLogged={(plotId, type) => setLastLogs(prev => ({ ...prev, [plotId]: { activity_type: type, recorded_at: new Date().toISOString() } }))}
          onDeleted={handleDeleted}
          onEdited={handleEdited}
        />
      ))}

      <button onClick={() => router.push('/plots/add')} style={{ width: '100%', padding: '13px', borderRadius: 14, border: '1.5px dashed #d1d5db', background: '#fafafa', color: '#6b7280', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        + เพิ่มแปลงใหม่
      </button>
    </div>
  );
}

export default function PlotsPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer', 'leader', 'admin']}>
      <MobileAppShell title="🌾 ไร่ของฉัน" subtitle="แปลง · รอบปลูก · กิจกรรม">
        <PlotsContent />
      </MobileAppShell>
    </ProtectedRoute>
  );
}

function actionButtonStyle(background: string, color: string, borderColor?: string): CSSProperties {
  return { border: borderColor ? `1.5px solid ${borderColor}` : 'none', borderRadius: 12, background, color, padding: '10px 8px', fontSize: 12, fontWeight: 800, cursor: 'pointer', minHeight: 44, textAlign: 'center' };
}




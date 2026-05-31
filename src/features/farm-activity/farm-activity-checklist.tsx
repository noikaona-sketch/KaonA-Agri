'use client';

import { type ChangeEvent, useEffect, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember } from '@/providers/auth-provider';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ActivityType =
  | 'water' | 'fertilize' | 'growth_check'
  | 'pest_found' | 'disease_found'
  | 'heavy_rain' | 'other';

type Log = {
  id:            string;
  activity_type: ActivityType;
  note:          string | null;
  plant_height_cm: number | null;
  pest_name:     string | null;
  severity:      'low' | 'medium' | 'high' | null;
  alert_sent:    boolean;
  recorded_at:   string;
};

type SeedHint = {
  fertilizer_guide: string | null | undefined;
  pest_guide?:      string | null | undefined;
  planting_guide:   string | null | undefined;
};

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY_CFG: Record<ActivityType, { icon: string; label: string; color: string; bg: string; isAlert?: boolean }> = {
  water:         { icon: '💧', label: 'ให้น้ำ',            color: '#1565c0', bg: '#e3f2fd' },
  fertilize:     { icon: '🌿', label: 'ใส่ปุ๋ย',            color: '#2e7d32', bg: '#e8f5e9' },
  growth_check:  { icon: '📏', label: 'วัดความสูง/เจริญ',   color: '#6a1b9a', bg: '#f3e5f5' },
  pest_found:    { icon: '🐛', label: 'พบแมลง',             color: '#c62828', bg: '#ffebee', isAlert: true },
  disease_found: { icon: '🍂', label: 'พบโรคพืช',           color: '#e65100', bg: '#fff3e0', isAlert: true },
  heavy_rain:    { icon: '🌧️', label: 'ฝนตกหนัก',          color: '#0277bd', bg: '#e1f5fe' },
  other:         { icon: '📝', label: 'อื่นๆ',              color: '#546e7a', bg: '#eceff1' },
};

const SEVERITY_OPTS = [
  { value: 'low',    label: '🟡 น้อย',    color: '#f57f17' },
  { value: 'medium', label: '🟠 ปานกลาง', color: '#e65100' },
  { value: 'high',   label: '🔴 มาก',     color: '#c62828' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
function relativeDate(d: string) {
  const diff = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (diff < 1)    return 'เมื่อกี้';
  if (diff < 60)   return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชม.ที่แล้ว`;
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
type Props = {
  cycleId:  string;
  plotId?:  string | null;
  seedHint?: SeedHint | null;   // from seed_varieties for inline hints
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function FarmActivityChecklist({ cycleId, plotId, seedHint }: Props) {
  const member = useCurrentMember();
  const [logs,      setLogs]      = useState<Log[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [notice,    setNotice]    = useState<string | null>(null);

  // Form state
  const [actType,   setActType]   = useState<ActivityType | ''>('');
  const [note,      setNote]      = useState('');
  const [height,    setHeight]    = useState('');
  const [pestName,  setPestName]  = useState('');
  const [severity,  setSeverity]  = useState<'low' | 'medium' | 'high' | ''>('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [gps,       setGps]       = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoad,   setGpsLoad]   = useState(false);
  const [showAll,   setShowAll]   = useState(false);

  // ── Load logs ──────────────────────────────────────────────────────────────
  async function load() {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) return;
    const { data } = await sb.from('farm_activity_logs')
      .select('id,activity_type,note,plant_height_cm,pest_name,severity,alert_sent,recorded_at')
      .eq('planting_cycle_id', cycleId)
      .order('recorded_at', { ascending: false })
      .limit(50);
    setLogs((data as Log[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [cycleId]);

  // ── GPS ────────────────────────────────────────────────────────────────────
  function getGps() {
    setGpsLoad(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setGps({ lat: p.coords.latitude, lng: p.coords.longitude }); setGpsLoad(false); },
      ()  => { setGpsLoad(false); },
      { timeout: 8000, enableHighAccuracy: true },
    );
  }

  // ── Reset form ─────────────────────────────────────────────────────────────
  function resetForm() {
    setActType(''); setNote(''); setHeight(''); setPestName('');
    setSeverity(''); setPhotoFile(null); setGps(null); setShowForm(false);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function submit() {
    if (!actType || !member?.member_id) return;
    setSaving(true);
    setNotice(null);

    const sb = tryCreateSupabaseBrowserClient()!;
    const now = new Date().toISOString();

    // 1) Upload photo if any
    let storagePath: string | null = null;
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${member.member_id}/farm-log/${cycleId}_${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('member-photos').upload(path, photoFile, { upsert: true });
      if (!upErr) storagePath = path;
    }

    // 2) Insert log
    const { data: inserted, error: logErr } = await sb.from('farm_activity_logs').insert({
      planting_cycle_id: cycleId,
      member_id:         member.member_id,
      plot_id:           plotId ?? null,
      activity_type:     actType,
      note:              note.trim() || null,
      plant_height_cm:   height ? Number(height) : null,
      pest_name:         pestName.trim() || null,
      severity:          severity || null,
      gps_lat:           gps?.lat ?? null,
      gps_lng:           gps?.lng ?? null,
      recorded_at:       now,
    }).select('id').single();

    if (logErr || !inserted) {
      setSaving(false);
      setNotice('❌ บันทึกไม่สำเร็จ กรุณาลองใหม่');
      return;
    }

    // 3) If photo, insert photos metadata
    if (storagePath) {
      await sb.from('photos').insert({
        member_id:    member.member_id,
        plot_id:      plotId ?? null,
        storage_path: storagePath,
        photo_type:   'other',
        lat:          gps?.lat ?? null,
        lng:          gps?.lng ?? null,
        captured_at:  now,
        uploaded_by:  member.member_id,
      });
    }

    // 4) If pest/disease → call alert API
    const isAlert = actType === 'pest_found' || actType === 'disease_found';
    let alertSent = false;
    if (isAlert) {
      const res = await fetch('/api/member/farm-activity-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id:        inserted.id,
          activity_type: actType,
          pest_name:     pestName.trim() || null,
          severity:      severity || null,
          note:          note.trim() || null,
          plot_id:       plotId ?? null,
        }),
      });
      if (res.ok) alertSent = true;
    }

    setSaving(false);
    const cfg = ACTIVITY_CFG[actType];
    const alertNote = isAlert
      ? alertSent
        ? ' 🔔 แจ้งสมาชิกใกล้เคียงแล้ว'
        : ' (ยังไม่ได้แจ้ง — ลองใหม่)'
      : '';
    setNotice(`✅ บันทึก ${cfg.icon} ${cfg.label} แล้ว${alertNote}`);
    resetForm();
    void load();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const cfg = actType ? ACTIVITY_CFG[actType] : null;
  const isAlertType = actType === 'pest_found' || actType === 'disease_found';
  const displayLogs = showAll ? logs : logs.slice(0, 5);

  return (
    <div style={{ marginTop: 16 }}>

      {/* Section header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#374151' }}>
          📋 บันทึกกิจกรรม
        </h3>
        {!showForm && (
          <button onClick={() => { setShowForm(true); setNotice(null); }}
            style={{ fontSize: 13, fontWeight: 700, padding: '7px 14px', borderRadius: 20,
              border: 'none', background: 'var(--primary,#2e7d32)', color: '#fff', cursor: 'pointer' }}>
            + บันทึก
          </button>
        )}
      </div>

      {/* Notice */}
      {notice && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, marginBottom: 10,
          background: notice.startsWith('✅') ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${notice.startsWith('✅') ? '#86efac' : '#fca5a5'}`,
          color:  notice.startsWith('✅') ? '#14532d' : '#991b1b',
          fontSize: 13, fontWeight: 600,
          display: 'flex', justifyContent: 'space-between',
        }}>
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
      )}

      {/* ── Form ── */}
      {showForm && (
        <div className="kaona-card" style={{ marginBottom: 12 }}>

          {/* Activity type buttons */}
          <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#374151' }}>
            กิจกรรมที่ทำ <span style={{ color: '#c62828' }}>*</span>
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {(Object.entries(ACTIVITY_CFG) as [ActivityType, typeof ACTIVITY_CFG[ActivityType]][]).map(([type, c]) => (
              <button key={type} onClick={() => setActType(type)}
                style={{
                  padding: '8px 12px', borderRadius: 20, border: `2px solid ${actType === type ? c.color : '#e5e7eb'}`,
                  background: actType === type ? c.bg : '#fff', cursor: 'pointer',
                  fontSize: 13, fontWeight: actType === type ? 700 : 400,
                  color: actType === type ? c.color : '#374151',
                }}>
                {c.icon} {c.label}
              </button>
            ))}
          </div>

          {/* Alert warning */}
          {isAlertType && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fff3e0', border: '1px solid #ffcc02', marginBottom: 10, fontSize: 12, color: '#e65100', fontWeight: 600 }}>
              ⚠️ ระบบจะแจ้งเตือนสมาชิกในพื้นที่ใกล้เคียงด้วย
            </div>
          )}

          {/* Seed hint */}
          {actType === 'fertilize' && seedHint?.fertilizer_guide && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#e8f5e9', fontSize: 12, color: '#2e7d32', marginBottom: 10 }}>
              📋 คำแนะนำ: {seedHint.fertilizer_guide}
            </div>
          )}
          {(actType === 'pest_found' || actType === 'disease_found') && seedHint?.pest_guide && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: '#fff3e0', fontSize: 12, color: '#e65100', marginBottom: 10 }}>
              📋 คำแนะนำจากพันธุ์เมล็ด: {seedHint.pest_guide}
            </div>
          )}

          {/* Pest name + severity */}
          {isAlertType && (
            <>
              <label style={{ display: 'block', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                  ชื่อแมลง/โรค <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ถ้าทราบ)</span>
                </span>
                <input type="text" value={pestName} onChange={(e) => setPestName(e.target.value)}
                  placeholder="เช่น หนอนกระทู้ข้าวโพด, ราน้ำค้าง"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13 }} />
              </label>
              <div style={{ marginBottom: 10 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#374151' }}>ระดับความรุนแรง</p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {SEVERITY_OPTS.map((s) => (
                    <button key={s.value} onClick={() => setSeverity(s.value as 'low' | 'medium' | 'high')}
                      style={{
                        flex: 1, padding: '8px 4px', borderRadius: 8, border: `2px solid ${severity === s.value ? s.color : '#e5e7eb'}`,
                        background: severity === s.value ? s.color + '22' : '#fff',
                        color: severity === s.value ? s.color : '#374151',
                        cursor: 'pointer', fontSize: 12, fontWeight: severity === s.value ? 700 : 400,
                      }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Height for growth check */}
          {actType === 'growth_check' && (
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>ความสูงต้น (ซม.)</span>
              <input type="number" inputMode="decimal" value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="เช่น 45"
                style={{ display: 'block', width: '80px', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14 }} />
            </label>
          )}

          {/* Note */}
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>หมายเหตุ <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ไม่บังคับ)</span></span>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="รายละเอียดเพิ่มเติม…"
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }} />
          </label>

          {/* Photo */}
          <div style={{ marginBottom: 10 }}>
            <p style={{ margin: '0 0 5px', fontSize: 13, fontWeight: 600, color: '#374151' }}>
              📷 ถ่ายรูป <span style={{ fontWeight: 400, color: '#9ca3af' }}>(ไม่บังคับ)</span>
            </p>
            <input type="file" accept="image/*" capture="environment"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPhotoFile(e.target.files?.[0] ?? null)}
              disabled={saving} />
            {photoFile && (
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>📷 {photoFile.name}</p>
            )}
          </div>

          {/* GPS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <button onClick={getGps} disabled={gpsLoad}
              style={{ fontSize: 12, padding: '6px 12px', borderRadius: 8, border: '1px solid #e0e0e0', background: gps ? '#e8f5e9' : '#fafafa', cursor: 'pointer', color: gps ? '#2e7d32' : '#374151' }}>
              {gpsLoad ? '📡 กำลังดึง…' : gps ? `📍 ${gps.lat.toFixed(4)}` : '📍 GPS (ไม่บังคับ)'}
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={resetForm} disabled={saving}
              style={{ padding: '10px 16px', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fafafa', cursor: 'pointer', fontSize: 13 }}>
              ยกเลิก
            </button>
            <button onClick={submit} disabled={saving || !actType}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 700,
                background: cfg ? cfg.color : '#e0e0e0',
                color: actType ? '#fff' : '#9ca3af',
                opacity: !actType ? 0.5 : 1,
              }}>
              {saving ? 'กำลังบันทึก…' : cfg ? `${cfg.icon} บันทึก${cfg.label}` : 'บันทึก'}
            </button>
          </div>
        </div>
      )}

      {/* ── Log list ── */}
      {loading && <p style={{ fontSize: 13, color: '#9ca3af', padding: '8px 0' }}>กำลังโหลด…</p>}

      {!loading && logs.length === 0 && !showForm && (
        <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
          ยังไม่มีบันทึก — กด <strong>+ บันทึก</strong> เพื่อเริ่ม
        </p>
      )}

      {displayLogs.map((log) => {
        const c = ACTIVITY_CFG[log.activity_type] ?? ACTIVITY_CFG.other;
        return (
          <div key={log.id} style={{
            display: 'flex', gap: 10, padding: '10px 0',
            borderBottom: '1px solid #f0f0f0',
          }}>
            <span style={{
              width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 18, background: c.bg, flexShrink: 0,
            }}>{c.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.color }}>{c.label}</span>
                <span style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: 8 }}>
                  {relativeDate(log.recorded_at)}
                </span>
              </div>
              {log.pest_name && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#374151' }}>🐛 {log.pest_name}{log.severity ? ` — ${log.severity === 'high' ? 'มาก' : log.severity === 'medium' ? 'ปานกลาง' : 'น้อย'}` : ''}</p>}
              {log.plant_height_cm && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#374151' }}>📏 {log.plant_height_cm} ซม.</p>}
              {log.note && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{log.note}</p>}
              {log.alert_sent && <span style={{ fontSize: 10, color: '#0277bd', fontWeight: 600 }}>🔔 แจ้งเตือนส่งแล้ว</span>}
            </div>
          </div>
        );
      })}

      {logs.length > 5 && (
        <button onClick={() => setShowAll((p) => !p)}
          style={{ width: '100%', marginTop: 8, padding: '8px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fafafa', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>
          {showAll ? 'ย่อ' : `ดูทั้งหมด ${logs.length} รายการ`}
        </button>
      )}
    </div>
  );
}

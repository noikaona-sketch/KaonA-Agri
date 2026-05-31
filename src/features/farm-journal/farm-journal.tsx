'use client';

import { type ChangeEvent, useEffect, useId, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember }            from '@/providers/auth-provider';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ScheduleItem = {
  day:          number;
  activity:     string;
  label:        string;
  icon:         string;
  note?:        string;
  warning_days?: number;
};

type LogEntry = {
  id:             string;
  activity_type:  string;
  note:           string | null;
  plant_height_cm: number | null;
  pest_name:      string | null;
  severity:       string | null;
  alert_sent:     boolean;
  recorded_at:    string;
  scheduled_day:  number | null;
  is_scheduled:   boolean;
};

type TimelineEntry = {
  key:          string;
  type:         'scheduled' | 'logged' | 'upcoming' | 'overdue';
  day:          number;
  dueDate:      Date | null;
  schedule?:    ScheduleItem;
  log?:         LogEntry;
  isDone:       boolean;
  isToday:      boolean;
  isOverdue:    boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY_COLOR: Record<string, { color: string; bg: string }> = {
  plant:        { color: '#2e7d32', bg: '#e8f5e9' },
  water:        { color: '#1565c0', bg: '#e3f2fd' },
  fertilize:    { color: '#2e7d32', bg: '#f0fdf4' },
  pest_check:   { color: '#c62828', bg: '#ffebee' },
  growth_check: { color: '#6a1b9a', bg: '#f3e5f5' },
  check:        { color: '#0277bd', bg: '#e1f5fe' },
  harvest:      { color: '#e65100', bg: '#fff3e0' },
  other:        { color: '#546e7a', bg: '#eceff1' },
};

const SEVERITY_COLOR: Record<string, string> = {
  low: '#f59e0b', medium: '#e65100', high: '#c62828',
};

function dayLabel(d: Date): string {
  const diff = Math.round((d.getTime() - Date.now()) / 86400000);
  if (diff === 0)  return 'วันนี้';
  if (diff === 1)  return 'พรุ่งนี้';
  if (diff === -1) return 'เมื่อวาน';
  if (diff > 0)   return `อีก ${diff} วัน`;
  return `${Math.abs(diff)} วันที่แล้ว`;
}

function relDate(s: string): string {
  const diff = Math.round((Date.now() - new Date(s).getTime()) / 60000);
  if (diff < 1)    return 'เมื่อกี้';
  if (diff < 60)   return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชม.ที่แล้ว`;
  if (diff < 10080) return `${Math.floor(diff / 1440)} วันที่แล้ว`;
  return new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────
type Props = {
  cycleId:    string;
  plotId?:    string | null;
  plantedAt:  string | null;   // ISO date string
  cropType:   string;          // ข้าวโพด / ข้าว
  daysToHarvest?: number | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export function FarmJournal({ cycleId, plotId, plantedAt, cropType, daysToHarvest }: Props) {
  const member  = useCurrentMember();
  const fileId  = useId();

  const [schedule, setSchedule]   = useState<ScheduleItem[]>([]);
  const [logs,     setLogs]       = useState<LogEntry[]>([]);
  const [loading,  setLoading]    = useState(true);

  // Quick-log state
  const [logging,    setLogging]   = useState<string | null>(null); // schedule key being logged
  const [logNote,    setLogNote]   = useState('');
  const [logHeight,  setLogHeight] = useState('');
  const [photoFile,  setPhotoFile] = useState<File | null>(null);
  const [saving,     setSaving]    = useState(false);
  const [notice,     setNotice]    = useState<string | null>(null);

  // ── Load schedule + logs ──────────────────────────────────────────────────
  useEffect(() => {
    if (!cycleId) return;
    void (async () => {
      const sb = createSupabaseBrowserClient();

      // Load crop_care_defaults schedule
      const [schedRes, logsRes] = await Promise.all([
        sb.from('crop_care_defaults').select('care_schedule').eq('crop_type', cropType).maybeSingle(),
        sb.from('farm_activity_logs')
          .select('id,activity_type,note,plant_height_cm,pest_name,severity,alert_sent,recorded_at,scheduled_day,is_scheduled')
          .eq('planting_cycle_id', cycleId)
          .order('recorded_at', { ascending: true }),
      ]);

      setSchedule((schedRes.data?.care_schedule as ScheduleItem[]) ?? []);
      setLogs((logsRes.data as LogEntry[]) ?? []);
      setLoading(false);
    })();
  }, [cycleId, cropType]);

  // ── Build timeline ────────────────────────────────────────────────────────
  const plantedDate = plantedAt ? new Date(plantedAt) : null;

  const timeline: TimelineEntry[] = [];

  if (plantedDate && schedule.length > 0) {
    for (const item of schedule) {
      const dueDate = new Date(plantedDate);
      dueDate.setDate(dueDate.getDate() + item.day);

      const daysSincePlanted = Math.floor((Date.now() - plantedDate.getTime()) / 86400000);
      const warningDays = item.warning_days ?? 1;
      const isRelevant  = item.day <= daysSincePlanted + warningDays + 3;
      if (!isRelevant && item.day > (daysToHarvest ?? 120)) continue;

      // Find matching log — ต้องเป็น log ที่ user บันทึกจริง (ไม่ใช่ auto-seeded placeholder)
      const matchLog = logs.find(l =>
        (l.scheduled_day === item.day || (
          l.activity_type === item.activity &&
          Math.abs(new Date(l.recorded_at).getTime() - dueDate.getTime()) < 5 * 86400000
        )) && !l.is_scheduled  // is_scheduled=true = placeholder, ยังไม่นับว่าทำแล้ว
      );

      const now = new Date();
      const isOverdue = !matchLog && dueDate < now && item.day <= daysSincePlanted;
      const isToday   = Math.abs(dueDate.getTime() - now.getTime()) < 86400000;

      timeline.push({
        key:       `sched-${item.day}`,
        type:      matchLog ? 'logged' : isOverdue ? 'overdue' : 'upcoming',
        day:       item.day,
        dueDate,
        schedule:  item,
        log:       matchLog,
        isDone:    !!matchLog,
        isToday,
        isOverdue,
      });
    }
  }

  // Add extra logs not tied to schedule
  for (const log of logs) {
    if (log.is_scheduled) continue;
    if (timeline.some(t => t.log?.id === log.id)) continue;
    timeline.push({
      key:     `log-${log.id}`,
      type:    'logged',
      day:     log.scheduled_day ?? 0,
      dueDate: new Date(log.recorded_at),
      log,
      isDone:  true,
      isToday: false,
      isOverdue: false,
    });
  }

  timeline.sort((a, b) => a.day - b.day || (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0));

  // ── Next upcoming item ────────────────────────────────────────────────────
  const nextItem = timeline.find(t => !t.isDone);
  const overdueItems = timeline.filter(t => t.isOverdue);

  // ── Quick log ─────────────────────────────────────────────────────────────
  async function quickLog(entry: TimelineEntry) {
    if (!member?.member_id || saving) return;
    setSaving(true);
    const sb = createSupabaseBrowserClient()!;
    const now = new Date().toISOString();

    let storagePath: string | null = null;
    if (photoFile) {
      const ext  = photoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${member.member_id}/journal/${cycleId}_d${entry.day}_${Date.now()}.${ext}`;
      const { error: upErr } = await sb.storage.from('member-photos').upload(path, photoFile, { upsert: true });
      if (!upErr) storagePath = path;
    }

    const { data: inserted } = await sb.from('farm_activity_logs').insert({
      planting_cycle_id: cycleId,
      member_id:         member.member_id,
      plot_id:           plotId ?? null,
      activity_type:     entry.schedule?.activity ?? 'other',
      note:              logNote.trim() || entry.schedule?.note || null,
      plant_height_cm:   logHeight ? Number(logHeight) : null,
      scheduled_day:     entry.schedule?.day ?? null,
      is_scheduled:      !!entry.schedule,
      reminder_due_at:   entry.dueDate?.toISOString() ?? null,
      recorded_at:       now,
    }).select('id').single();

    if (storagePath && inserted) {
      await sb.from('photos').insert({
        member_id: member.member_id, plot_id: plotId ?? null,
        storage_path: storagePath, photo_type: 'farm_journal',
        captured_at: now, uploaded_by: member.member_id,
      });
    }

    // Refresh logs
    const { data: newLogs } = await sb.from('farm_activity_logs')
      .select('id,activity_type,note,plant_height_cm,pest_name,severity,alert_sent,recorded_at,scheduled_day,is_scheduled')
      .eq('planting_cycle_id', cycleId).order('recorded_at', { ascending: true });
    setLogs((newLogs as LogEntry[]) ?? []);

    setSaving(false);
    setLogging(null);
    setLogNote('');
    setLogHeight('');
    setPhotoFile(null);
    setNotice(`✅ บันทึก${entry.schedule ? ` "${entry.schedule.label}"` : ''} แล้วค่ะ`);
    setTimeout(() => setNotice(null), 3000);
  }

  if (loading) return <div style={{ padding: '16px 0', color: '#9ca3af', fontSize: 13 }}>กำลังโหลดสมุดแปลง…</div>;

  const plantedDayCount = plantedDate ? Math.floor((Date.now() - plantedDate.getTime()) / 86400000) : null;

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#111' }}>📔 สมุดแปลง</h3>
          {plantedDayCount !== null && (
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
              วันที่ {plantedDayCount} หลังปลูก
              {daysToHarvest && plantedDayCount < daysToHarvest && (
                <span style={{ marginLeft: 6, color: '#e65100', fontWeight: 600 }}>
                  เหลือ {daysToHarvest - plantedDayCount} วัน
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Notice */}
      {notice && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#e8f5e9', border: '1px solid #a5d6a7', color: '#1b5e20', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
          {notice}
        </div>
      )}

      {/* ── Reminder banner ── */}
      {overdueItems.length > 0 && (
        <div style={{ padding: '11px 14px', borderRadius: 12, background: '#ffebee', border: '1px solid #ef9a9a', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 18 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#c62828' }}>
              ค้างดำเนินการ {overdueItems.length} รายการ
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: '#c62828' }}>
              {overdueItems.slice(0, 2).map(t => t.schedule?.label).join(' · ')}
            </p>
          </div>
        </div>
      )}

      {nextItem && !nextItem.isOverdue && (
        <div style={{ padding: '11px 14px', borderRadius: 12, background: '#e3f2fd', border: '1px solid #90caf9', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 20 }}>{nextItem.schedule?.icon ?? '📅'}</span>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#1565c0' }}>
              ถัดไป: {nextItem.schedule?.label ?? 'กิจกรรม'}
            </p>
            <p style={{ margin: '1px 0 0', fontSize: 11, color: '#1565c0' }}>
              {nextItem.dueDate ? dayLabel(nextItem.dueDate) : ''}
              {nextItem.schedule?.note && ` · ${nextItem.schedule.note}`}
            </p>
          </div>
          <button onClick={() => setLogging(logging === nextItem.key ? null : nextItem.key)}
            style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 8, border: 'none', background: '#1565c0', color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
            บันทึก
          </button>
        </div>
      )}

      {/* ── Quick-log panel ── */}
      {logging && (() => {
        const entry = timeline.find(t => t.key === logging);
        if (!entry) return null;
        return (
          <div style={{ background: '#fff', borderRadius: 14, border: '1.5px solid #2e7d32', padding: '14px', marginBottom: 12 }}>
            <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: '#1b5e20' }}>
              {entry.schedule?.icon} บันทึก: {entry.schedule?.label ?? 'กิจกรรม'}
            </p>
            {entry.schedule?.activity === 'growth_check' && (
              <input type="number" inputMode="decimal" value={logHeight} onChange={e => setLogHeight(e.target.value)}
                placeholder="ความสูงต้น (ซม.)" className="reg-input" style={{ marginBottom: 8 }} />
            )}
            <textarea rows={2} value={logNote} onChange={e => setLogNote(e.target.value)}
              placeholder={entry.schedule?.note ?? 'หมายเหตุ (ไม่บังคับ)…'}
              className="reg-input" style={{ resize: 'none', marginBottom: 8, fontFamily: 'inherit' }} />
            <div style={{ marginBottom: 10 }}>
              <label htmlFor={fileId} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 10, border: '1.5px dashed #d1d5db',
                background: '#fafafa', cursor: 'pointer', fontSize: 12, color: '#6b7280',
              }}>
                📷 แนบรูป {photoFile && <span style={{ color: '#2e7d32' }}>✓ {photoFile.name}</span>}
              </label>
              <input id={fileId} type="file" accept="image/*" capture="environment"
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPhotoFile(e.target.files?.[0] ?? null)}
                style={{ display: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setLogging(null); setLogNote(''); setLogHeight(''); setPhotoFile(null); }}
                style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid #e0e0e0', background: '#fafafa', cursor: 'pointer', fontSize: 13 }}>
                ยกเลิก
              </button>
              <button onClick={() => quickLog(entry)} disabled={saving}
                style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: saving ? '#e0e0e0' : '#2e7d32', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'กำลังบันทึก…' : '✓ บันทึก'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Timeline ── */}
      <div style={{ position: 'relative' }}>
        {/* Vertical line */}
        <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: '#e8ede8', zIndex: 0 }} />

        {timeline.length === 0 && (
          <p style={{ fontSize: 13, color: '#9ca3af', padding: '16px 0 16px 48px' }}>
            {!plantedAt ? 'ยังไม่ระบุวันปลูก — ไม่สามารถแสดง timeline ได้' : 'ยังไม่มีข้อมูล'}
          </p>
        )}

        {timeline.map((entry) => {
          const ac = ACTIVITY_COLOR[entry.schedule?.activity ?? entry.log?.activity_type ?? 'other']
                    ?? ACTIVITY_COLOR.other;
          const isOpen = logging === entry.key;

          return (
            <div key={entry.key} style={{ display: 'flex', gap: 12, marginBottom: 10, position: 'relative', zIndex: 1 }}>
              {/* Dot */}
              <div style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                background: entry.isDone ? ac.bg : entry.isOverdue ? '#ffebee' : '#f5f5f5',
                border: `2px solid ${entry.isDone ? ac.color : entry.isOverdue ? '#ef9a9a' : '#e0e0e0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17,
              }}>
                {entry.isDone
                  ? (entry.schedule?.icon ?? '📝')
                  : entry.isOverdue ? '⚠️'
                  : entry.isToday ? '📍'
                  : (entry.schedule?.icon ?? '○')}
              </div>

              {/* Content */}
              <div style={{
                flex: 1, background: '#fff', borderRadius: 12,
                border: `1px solid ${entry.isOverdue ? '#ffcdd2' : entry.isToday ? '#90caf9' : '#f0f0f0'}`,
                padding: '10px 12px',
                opacity: (!entry.isDone && !entry.isOverdue && !entry.isToday) ? 0.65 : 1,
              }}>
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: entry.isDone || entry.isOverdue || entry.isToday ? 700 : 500, color: entry.isDone ? ac.color : '#374151' }}>
                      {entry.schedule?.label ?? entry.log?.activity_type ?? 'กิจกรรม'}
                    </span>
                    {entry.isDone && <span style={{ marginLeft: 5, fontSize: 10, color: '#2e7d32' }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0, marginLeft: 6 }}>
                    {entry.isDone && entry.log
                      ? relDate(entry.log.recorded_at)
                      : entry.dueDate ? dayLabel(entry.dueDate) : `D+${entry.day}`}
                  </span>
                </div>

                {/* Log details */}
                {entry.log?.note && (
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: '#6b7280' }}>{entry.log.note}</p>
                )}
                {entry.log?.plant_height_cm && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>
                    📏 {entry.log.plant_height_cm} ซม.
                  </p>
                )}
                {entry.log?.pest_name && (
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: SEVERITY_COLOR[entry.log.severity ?? 'low'] }}>
                    🐛 {entry.log.pest_name}
                    {entry.log.severity && ` · ${entry.log.severity === 'high' ? 'รุนแรงมาก' : entry.log.severity === 'medium' ? 'ปานกลาง' : 'น้อย'}`}
                  </p>
                )}
                {entry.log?.alert_sent && (
                  <span style={{ fontSize: 10, color: '#0277bd' }}>🔔 แจ้งเตือนส่งแล้ว</span>
                )}

                {/* Schedule hint (not done) */}
                {!entry.isDone && entry.schedule?.note && (
                  <p style={{ margin: '3px 0 0', fontSize: 11, color: '#9ca3af' }}>{entry.schedule.note}</p>
                )}

                {/* Log button — for overdue or today */}
                {!entry.isDone && (entry.isOverdue || entry.isToday) && (
                  <button onClick={() => setLogging(isOpen ? null : entry.key)}
                    style={{
                      marginTop: 7, fontSize: 11, fontWeight: 700,
                      padding: '5px 12px', borderRadius: 8, cursor: 'pointer', border: 'none',
                      background: entry.isOverdue ? '#c62828' : '#2e7d32', color: '#fff',
                    }}>
                    {isOpen ? 'ปิด' : entry.isOverdue ? 'บันทึกตอนนี้' : 'บันทึก'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

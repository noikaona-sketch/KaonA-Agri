'use client';

import { useEffect, useRef, useState } from 'react';
import { compressCropPhoto }              from '@/shared/lib/image-processing';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { getAuthHeaders }                 from '@/lib/auth/get-auth-headers';
import type { AuthBootstrapResult }       from '@/shared/auth/auth-types';

type ActiveCycle = {
  id: string; crop_name: string; season_year: number;
  status: string; planted_at?: string | null;
};
type Analysis = {
  id: string; storage_path: string; activity_context: string | null;
  age_days: number | null; ai_grade: string; ai_summary: string; analyzed_at: string;
};

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

function storagePubUrl(path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${EVIDENCE_BUCKET}/${path}`;
}

const CONTEXTS = [
  { value: 'general',      icon: '📸', label: 'ดูทั่วไป' },
  { value: 'growth_check', icon: '📏', label: 'เช็กการโต' },
  { value: 'watering',     icon: '💧', label: 'กำลังรดน้ำ' },
  { value: 'fertilizing',  icon: '🌿', label: 'ใส่ปุ๋ย' },
  { value: 'pest_found',   icon: '🐛', label: 'เจอแมลง' },
];

const GRADE: Record<string, { emoji: string; label: string; bg: string; color: string; border: string }> = {
  great:   { emoji: '🌟', label: 'ดีมาก!',      bg: '#dcfce7', color: '#14532d', border: '#4ade80' },
  good:    { emoji: '✅', label: 'ดี',           bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  warning: { emoji: '⚠️', label: 'ระวังหน่อย',  bg: '#fef9c3', color: '#713f12', border: '#fde047' },
  alert:   { emoji: '🚨', label: 'ต้องแก้ด่วน', bg: '#ffe4e6', color: '#881337', border: '#fb7185' },
};

function relDate(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'เมื่อกี้';
  if (m < 60) return `${m} นาทีที่แล้ว`;
  if (m < 1440) return `${Math.floor(m/60)} ชม.ที่แล้ว`;
  return `${Math.floor(m/1440)} วันที่แล้ว`;
}

export function MasterpieceCard({ plotId, cycle, member }: {
  plotId: string; cycle: ActiveCycle | null; member: AuthBootstrapResult;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [ctx,       setCtx]       = useState('general');
  const [busy,      setBusy]      = useState(false);
  const [result,    setResult]    = useState<{
    grade: string; summary: string; full: string; url: string;
    ageDays: number|null; stage: string;
  } | null>(null);
  const [history,   setHistory]   = useState<Analysis[]>([]);
  const [err,       setErr]       = useState<string|null>(null);
  const [expanded,  setExpanded]  = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) return;
    const q = cycle
      ? sb.from('crop_photo_analyses').select('id,storage_path,activity_context,age_days,ai_grade,ai_summary,analyzed_at').eq('planting_cycle_id', cycle.id)
      : sb.from('crop_photo_analyses').select('id,storage_path,activity_context,age_days,ai_grade,ai_summary,analyzed_at').eq('plot_id', plotId);
    void q.order('analyzed_at', { ascending: false }).limit(8)
      .then(({ data }) => setHistory((data as Analysis[]) ?? []));
  }, [plotId, cycle?.id]);

  const ageDays = cycle?.planted_at
    ? Math.floor((Date.now() - new Date(cycle.planted_at).getTime()) / 86400000)
    : null;

  async function shoot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    setBusy(true); setErr(null); setResult(null);

    try {
      const { headers, url } = await getAuthHeaders(member, '/api/member/crop-photo-analysis');
      const { processedFile } = await compressCropPhoto(file);
      const form = new FormData();
      form.append('photo', processedFile);
      form.append('activity_context', ctx);
      if (cycle?.id) form.append('planting_cycle_id', cycle.id);
      form.append('plot_id', plotId);

      const res  = await fetch(url, { method: 'POST', headers, body: form });
      const data = await res.json() as {
        ok?: boolean; error?: string;
        ai_grade?: string; ai_summary?: string; ai_full_response?: string;
        storage_path?: string; age_days?: number|null; expected_stage?: string;
        analysis_id?: string;
      };

      if (!res.ok) throw new Error(data.error ?? 'วิเคราะห์ไม่สำเร็จ');

      const imgUrl = data.storage_path ? storagePubUrl(data.storage_path) : '';
      setResult({ grade: data.ai_grade ?? 'good', summary: data.ai_summary ?? '', full: data.ai_full_response ?? '', url: imgUrl, ageDays: data.age_days ?? null, stage: data.expected_stage ?? '' });
      setExpanded(true);

      if (data.analysis_id && data.storage_path) {
        setHistory(prev => [{
          id: data.analysis_id!, storage_path: data.storage_path!,
          activity_context: ctx, age_days: data.age_days ?? null,
          ai_grade: data.ai_grade ?? 'good', ai_summary: data.ai_summary ?? '',
          analyzed_at: new Date().toISOString(),
        }, ...prev].slice(0, 8));
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  const g       = result  ? (GRADE[result.grade]            ?? GRADE.good) : null;
  const lastG   = history[0] ? (GRADE[history[0].ai_grade] ?? GRADE.good) : null;

  return (
    <div style={{ background: '#fff', overflow: 'hidden' }}>

      {/* ══ HERO BANNER ══════════════════════════════════════════════════════ */}
      <div style={{
        background: 'linear-gradient(135deg, #14532d 0%, #166534 50%, #15803d 100%)',
        padding: '18px 20px 20px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative circle */}
        <div style={{ position: 'absolute', top: -20, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 30, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative' }}>
          <div>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>
              🏆 ผลงานชิ้นเอก
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#bbf7d0' }}>
              {ageDays !== null
                ? `${cycle?.crop_name ?? 'พืช'} · อายุ ${ageDays} วัน${result?.stage ? ` · ${result.stage}` : ''}`
                : 'ถ่ายรูปส่งให้ AI ดูหน่อยนะ 📲'}
            </p>
          </div>
          {!result && lastG && (
            <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.18)', color: '#fff', fontWeight: 800, backdropFilter: 'blur(4px)' }}>
              {lastG.emoji} {lastG.label}
            </span>
          )}
          {result && g && (
            <span style={{ fontSize: 12, padding: '5px 12px', borderRadius: 99, background: g.bg, color: g.color, fontWeight: 800 }}>
              {g.emoji} {g.label}
            </span>
          )}
        </div>
      </div>

      {/* ══ CONTEXT GRID ═════════════════════════════════════════════════════ */}
      <div style={{ padding: '16px 16px 0' }}>
        <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          กำลังทำอะไรอยู่?
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
          {CONTEXTS.map(c => (
            <button key={c.value} onClick={() => setCtx(c.value)}
              style={{
                padding: '10px 4px 8px', borderRadius: 12,
                border: `2px solid ${ctx === c.value ? '#16a34a' : '#e5e7eb'}`,
                background: ctx === c.value ? '#f0fdf4' : '#fafafa',
                cursor: 'pointer', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4, transition: 'all 0.15s',
              }}>
              <span style={{ fontSize: 20 }}>{c.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: ctx === c.value ? '#15803d' : '#6b7280', textAlign: 'center', lineHeight: 1.2 }}>
                {c.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ SHOOT BUTTON ═════════════════════════════════════════════════════ */}
      <div style={{ padding: '14px 16px' }}>
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          style={{
            width: '100%', padding: '17px 0', borderRadius: 18, border: 'none',
            background: busy ? '#e5e7eb' : 'linear-gradient(135deg, #15803d, #16a34a)',
            color: busy ? '#9ca3af' : '#fff',
            fontSize: 16, fontWeight: 900, cursor: busy ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: busy ? 'none' : '0 6px 20px rgba(22,163,74,0.35)',
            letterSpacing: '-0.2px',
          }}>
          {busy
            ? <><span style={{ fontSize: 18 }}>⏳</span> AI กำลังดูรูปอยู่นะ…</>
            : <><span style={{ fontSize: 22 }}>📸</span> ถ่ายรูปแปลง ให้ AI ดูหน่อย!</>
          }
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={shoot} />
      </div>

      {/* ══ ERROR ════════════════════════════════════════════════════════════ */}
      {err && (
        <div style={{ margin: '0 16px 14px', padding: '12px 16px', borderRadius: 14, background: '#ffe4e6', border: '1.5px solid #fb7185', color: '#881337', fontSize: 13, fontWeight: 600 }}>
          😬 {err}
        </div>
      )}

      {/* ══ AI RESULT CARD ═══════════════════════════════════════════════════ */}
      {result && g && (
        <div style={{ margin: '0 16px 16px', borderRadius: 18, border: `2px solid ${g.border}`, background: g.bg, overflow: 'hidden', boxShadow: `0 4px 16px ${g.border}55` }}>

          {/* photo + grade row */}
          <div style={{ display: 'flex', gap: 14, padding: '16px 16px 12px' }}>
            <div style={{ width: 96, height: 96, borderRadius: 14, overflow: 'hidden', flexShrink: 0, border: `2.5px solid ${g.border}`, background: '#e5e7eb' }}>
              {result.url
                ? <img src={result.url} alt="แปลง" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> // eslint-disable-line
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>🌽</div>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 26 }}>{g.emoji}</span>
                <span style={{ fontSize: 18, fontWeight: 900, color: g.color }}>{g.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#1a1a1a', lineHeight: 1.6, fontWeight: 600 }}>
                {result.summary}
              </p>
            </div>
          </div>

          {/* full AI text */}
          {expanded && result.full && (
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ height: 1, background: g.border, opacity: 0.5, marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.85, whiteSpace: 'pre-wrap' }}>
                {result.full}
              </p>
            </div>
          )}

          <button onClick={() => setExpanded(v => !v)}
            style={{ width: '100%', padding: '11px', border: 'none', borderTop: `1.5px solid ${g.border}`, background: 'transparent', fontSize: 13, color: g.color, cursor: 'pointer', fontWeight: 800 }}>
            {expanded ? '▲ ย่อลง' : '▼ อ่านคำแนะนำเต็มๆ'}
          </button>
        </div>
      )}

      {/* ══ HISTORY STRIP ════════════════════════════════════════════════════ */}
      {history.length > 0 && (
        <div style={{ padding: '0 16px 18px' }}>
          <p style={{ margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ประวัติการถ่ายภาพ
          </p>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {history.map(a => {
              const hg = GRADE[a.ai_grade] ?? GRADE.good;
              const imgUrl = storagePubUrl(a.storage_path);
              return (
                <div key={a.id} style={{ flexShrink: 0, textAlign: 'center', width: 68 }}>
                  <div style={{ width: 68, height: 68, borderRadius: 14, overflow: 'hidden', border: `2.5px solid ${hg.border}`, background: '#e5e7eb' }}>
                    <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> {/* eslint-disable-line */}
                  </div>
                  <p style={{ margin: '4px 0 1px', fontSize: 11, color: hg.color, fontWeight: 800 }}>{hg.emoji} {hg.label}</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>{relDate(a.analyzed_at)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { compressCropPhoto }             from '@/shared/lib/image-processing';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { getAuthHeaders }                from '@/lib/auth/get-auth-headers';
import type { AuthBootstrapResult }      from '@/shared/auth/auth-types';

type ActiveCycle = {
  id: string; crop_name: string; season_year: number;
  status: string; planted_at?: string | null;
};
type Analysis = {
  id: string; storage_path: string; activity_context: string | null;
  age_days: number | null; ai_grade: string; ai_summary: string; analyzed_at: string;
};

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

const CONTEXTS = [
  { value: 'general',      icon: '📸', label: 'ดูทั่วไป' },
  { value: 'growth_check', icon: '📏', label: 'เช็กโต' },
  { value: 'watering',     icon: '💧', label: 'รดน้ำ' },
  { value: 'fertilizing',  icon: '🌿', label: 'ใส่ปุ๋ย' },
  { value: 'pest_found',   icon: '🐛', label: 'เจอแมลง' },
];

const GRADE_CFG = {
  great:   { emoji: '🌟', label: 'ดีมาก!',      bg: '#e8f5e9', color: '#1b5e20', border: '#a5d6a7', btnBg: '#2e7d32' },
  good:    { emoji: '✅', label: 'ดี',           bg: '#f0fdf4', color: '#166534', border: '#86efac', btnBg: '#16a34a' },
  warning: { emoji: '⚠️', label: 'ระวังหน่อย',  bg: '#fffbeb', color: '#92400e', border: '#fcd34d', btnBg: '#d97706' },
  alert:   { emoji: '🚨', label: 'ต้องแก้ด่วน', bg: '#fff1f2', color: '#9f1239', border: '#fda4af', btnBg: '#dc2626' },
};

function relDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)    return 'เมื่อกี้';
  if (diff < 60)   return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 1440)} วันที่แล้ว`;
}

function HistoryStrip({ analyses }: { analyses: Analysis[] }) {
  const sb = tryCreateSupabaseBrowserClient();
  if (!analyses.length || !sb) return null;
  return (
    <div style={{ padding: '12px 16px 0' }}>
      <p style={{ margin: '0 0 8px', fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>📷 ประวัติการถ่าย</p>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
        {analyses.map(a => {
          const { data } = sb.storage.from(EVIDENCE_BUCKET).getPublicUrl(a.storage_path);
          const g = GRADE_CFG[a.ai_grade as keyof typeof GRADE_CFG] ?? GRADE_CFG.good;
          return (
            <div key={a.id} style={{ flexShrink: 0, textAlign: 'center', width: 64 }}>
              <div style={{ width: 64, height: 64, borderRadius: 12, overflow: 'hidden', border: `2.5px solid ${g.border}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.publicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: g.color, fontWeight: 700 }}>{g.emoji} {g.label}</p>
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>{relDate(a.analyzed_at)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MasterpieceCard({
  plotId, cycle, member,
}: {
  plotId: string;
  cycle: ActiveCycle | null;
  member: AuthBootstrapResult;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [context,   setContext]   = useState('general');
  const [analyzing, setAnalyzing] = useState(false);
  const [result,    setResult]    = useState<{
    ai_grade: string; ai_full_response: string; ai_summary: string;
    public_url: string; age_days: number | null; expected_stage: string;
  } | null>(null);
  const [analyses,  setAnalyses]  = useState<Analysis[]>([]);
  const [error,     setError]     = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb || !plotId) return;
    const q = cycle
      ? sb.from('crop_photo_analyses')
          .select('id,storage_path,activity_context,age_days,ai_grade,ai_summary,analyzed_at')
          .eq('planting_cycle_id', cycle.id)
          .order('analyzed_at', { ascending: false }).limit(8)
      : sb.from('crop_photo_analyses')
          .select('id,storage_path,activity_context,age_days,ai_grade,ai_summary,analyzed_at')
          .eq('plot_id', plotId)
          .order('analyzed_at', { ascending: false }).limit(8);
    void q.then(({ data }) => setAnalyses((data as Analysis[]) ?? []));
  }, [plotId, cycle?.id]);

  const ageDays = cycle?.planted_at
    ? Math.floor((Date.now() - new Date(cycle.planted_at).getTime()) / 86400000)
    : null;

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    setAnalyzing(true); setError(null); setResult(null);

    const { headers, url } = await getAuthHeaders(member, '/api/member/crop-photo-analysis');
    const { processedFile } = await compressCropPhoto(file);
    const form = new FormData();
    form.append('photo', processedFile);
    form.append('activity_context', context);
    if (cycle?.id) form.append('planting_cycle_id', cycle.id);
    if (plotId)    form.append('plot_id', plotId);

    const res  = await fetch(url, { method: 'POST', headers, body: form });
    const data = (await res.json()) as {
      ok?: boolean; error?: string;
      ai_grade?: string; ai_full_response?: string; ai_summary?: string;
      public_url?: string; age_days?: number | null; expected_stage?: string;
      analysis_id?: string; storage_path?: string;
    };

    setAnalyzing(false);
    if (!res.ok) { setError(data.error ?? 'วิเคราะห์ไม่สำเร็จ'); return; }

    setResult({
      ai_grade:         data.ai_grade         ?? 'good',
      ai_full_response: data.ai_full_response ?? '',
      ai_summary:       data.ai_summary       ?? '',
      public_url:       data.public_url        ?? '',
      age_days:         data.age_days          ?? null,
      expected_stage:   data.expected_stage    ?? '',
    });
    setExpanded(true);

    if (data.analysis_id && data.storage_path) {
      setAnalyses(prev => [{
        id: data.analysis_id!, storage_path: data.storage_path!,
        activity_context: context, age_days: data.age_days ?? null,
        ai_grade: data.ai_grade ?? 'good', ai_summary: data.ai_summary ?? '',
        analyzed_at: new Date().toISOString(),
      }, ...prev].slice(0, 8));
    }
  }

  const grade     = result   ? (GRADE_CFG[result.ai_grade       as keyof typeof GRADE_CFG] ?? GRADE_CFG.good) : null;
  const lastGrade = analyses[0] ? (GRADE_CFG[analyses[0].ai_grade as keyof typeof GRADE_CFG] ?? GRADE_CFG.good) : null;

  return (
    <div style={{ background: '#fff', borderTop: '2px solid #f0fdf4', marginTop: 0 }}>

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: '-0.3px' }}>
              🏆 ผลงานชิ้นเอก
            </p>
            {ageDays !== null ? (
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#a7f3d0' }}>
                {cycle?.crop_name} · <strong style={{ color: '#fff' }}>อายุ {ageDays} วัน</strong>
                {result?.expected_stage ? ` · ${result.expected_stage}` : ''}
              </p>
            ) : (
              <p style={{ margin: '3px 0 0', fontSize: 13, color: '#a7f3d0' }}>
                ถ่ายรูปแปลงให้ AI ดูหน่อยนะ
              </p>
            )}
          </div>
          {(lastGrade && !result) && (
            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.15)', color: '#fff', fontWeight: 700 }}>
              {lastGrade.emoji} {lastGrade.label}
            </span>
          )}
          {result && grade && (
            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, background: grade.bg, color: grade.color, fontWeight: 800 }}>
              {grade.emoji} {grade.label}
            </span>
          )}
        </div>
      </div>

      {/* ── Context picker ───────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 0' }}>
        <p style={{ margin: '0 0 8px', fontSize: 12, color: '#6b7280', fontWeight: 600 }}>กำลังทำอะไรอยู่?</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CONTEXTS.map(c => (
            <button key={c.value} onClick={() => setContext(c.value)}
              style={{
                padding: '8px 14px', borderRadius: 99,
                border: `2px solid ${context === c.value ? '#2e7d32' : '#e5e7eb'}`,
                background: context === c.value ? '#e8f5e9' : '#f9fafb',
                color: context === c.value ? '#1b5e20' : '#4b5563',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <span style={{ fontSize: 16 }}>{c.icon}</span>{c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Shoot button ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px' }}>
        <button onClick={() => fileRef.current?.click()} disabled={analyzing}
          style={{
            width: '100%', padding: '16px', borderRadius: 16, border: 'none',
            background: analyzing ? '#e5e7eb' : 'linear-gradient(135deg, #1b5e20, #2e7d32)',
            color: analyzing ? '#9ca3af' : '#fff',
            fontSize: 16, fontWeight: 900, cursor: analyzing ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: analyzing ? 'none' : '0 4px 14px rgba(46,125,50,0.4)',
          }}>
          {analyzing
            ? <><span>⏳</span><span style={{ fontSize: 15 }}>AI กำลังดูรูปอยู่นะ รอแป๊บนึง…</span></>
            : <><span style={{ fontSize: 22 }}>📸</span><span>ถ่ายรูปแปลง ให้ AI ดูหน่อย!</span></>
          }
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={handlePhoto} />
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ margin: '0 16px 14px', padding: '12px 14px', borderRadius: 12, background: '#fff1f2', border: '1px solid #fda4af', color: '#9f1239', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── AI Result ────────────────────────────────────────────────────────── */}
      {result && grade && (
        <div style={{ margin: '0 16px 16px', borderRadius: 16, border: `2px solid ${grade.border}`, background: grade.bg, overflow: 'hidden' }}>
          {/* Photo + grade */}
          <div style={{ display: 'flex', gap: 12, padding: '14px 14px 10px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.public_url} alt="แปลง"
              style={{ width: 88, height: 88, borderRadius: 12, objectFit: 'cover', flexShrink: 0, border: `2px solid ${grade.border}` }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <span style={{ fontSize: 22 }}>{grade.emoji}</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: grade.color }}>{grade.label}</span>
              </div>
              <p style={{ margin: 0, fontSize: 14, color: '#111', lineHeight: 1.6, fontWeight: 600 }}>
                {result.ai_summary}
              </p>
            </div>
          </div>

          {/* Full AI text */}
          {expanded && (
            <div style={{ padding: '0 14px 14px' }}>
              <div style={{ height: 1, background: grade.border, margin: '0 0 12px' }} />
              <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                {result.ai_full_response}
              </p>
            </div>
          )}
          <button onClick={() => setExpanded(e => !e)}
            style={{ width: '100%', padding: '10px', border: 'none', borderTop: `1px solid ${grade.border}`, background: 'transparent', fontSize: 13, color: grade.color, cursor: 'pointer', fontWeight: 700 }}>
            {expanded ? '▲ ย่อลง' : '▼ อ่านคำแนะนำเต็มๆ'}
          </button>
        </div>
      )}

      {/* ── History strip ─────────────────────────────────────────────────────── */}
      <HistoryStrip analyses={analyses} />
      {analyses.length > 0 && <div style={{ height: 16 }} />}
    </div>
  );
}

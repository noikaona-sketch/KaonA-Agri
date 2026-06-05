'use client';

// MasterpieceCard — "ผลงานชิ้นเอก" แทน planting cycle card เดิม
// สมาชิกถ่ายรูปแปลง → AI วิเคราะห์เป็นภาษาบ้านๆ + เก็บประวัติ

import { useEffect, useRef, useState } from 'react';
import { compressCropPhoto }             from '@/shared/lib/image-processing';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { getAuthHeaders }               from '@/lib/auth/get-auth-headers';
import type { AuthBootstrapResult }     from '@/shared/auth/auth-types';

type ActiveCycle = { id: string; crop_name: string; season_year: number; status: string; planted_at?: string | null };
type Analysis = {
  id: string; storage_path: string; activity_context: string | null;
  age_days: number | null; ai_grade: string; ai_summary: string; analyzed_at: string;
};

const EVIDENCE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EVIDENCE_BUCKET ?? 'mvp-evidence';

const CONTEXTS = [
  { value: 'general',      icon: '📸', label: 'ดูทั่วไป' },
  { value: 'growth_check', icon: '📏', label: 'เช็กการเจริญเติบโต' },
  { value: 'watering',     icon: '💧', label: 'กำลังรดน้ำ' },
  { value: 'fertilizing',  icon: '🌿', label: 'ใส่ปุ๋ย' },
  { value: 'pest_found',   icon: '🐛', label: 'เจอแมลง/ศัตรูพืช' },
];

const GRADE_CFG = {
  great:   { emoji: '🌟', label: 'ดีมาก!',     bg: '#e8f5e9', color: '#1b5e20', border: '#a5d6a7' },
  good:    { emoji: '✅', label: 'ดี',          bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  warning: { emoji: '⚠️', label: 'ระวังหน่อย', bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
  alert:   { emoji: '🚨', label: 'ต้องแก้ด่วน', bg: '#fff1f2', color: '#9f1239', border: '#fda4af' },
};

function relDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'เมื่อกี้';
  if (diff < 60) return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 1440)} วันที่แล้ว`;
}

// ── Context picker (กดเลือก activity) ────────────────────────────────────────
function ContextPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
      {CONTEXTS.map(c => (
        <button key={c.value} onClick={() => onChange(c.value)}
          style={{ padding: '7px 12px', borderRadius: 99, border: `1.5px solid ${value === c.value ? '#2e7d32' : '#e5e7eb'}`, background: value === c.value ? '#e8f5e9' : '#fff', color: value === c.value ? '#1b5e20' : '#374151', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>{c.icon}</span>{c.label}
        </button>
      ))}
    </div>
  );
}

// ── Photo history strip ───────────────────────────────────────────────────────
function HistoryStrip({ analyses }: { analyses: Analysis[] }) {
  const sb = tryCreateSupabaseBrowserClient();
  if (!analyses.length || !sb) return null;
  return (
    <div style={{ marginTop: 10 }}>
      <p style={{ margin: '0 0 6px', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>ประวัติการถ่ายภาพ</p>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {analyses.map(a => {
          const { data } = sb.storage.from(EVIDENCE_BUCKET).getPublicUrl(a.storage_path);
          const grade = GRADE_CFG[a.ai_grade as keyof typeof GRADE_CFG] ?? GRADE_CFG.good;
          return (
            <div key={a.id} style={{ flexShrink: 0, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', border: `2px solid ${grade.border}`, position: 'relative' }}>
                <img src={data.publicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 10, color: grade.color, fontWeight: 700 }}>{grade.emoji} {grade.label}</p>
              <p style={{ margin: 0, fontSize: 9, color: '#9ca3af' }}>{relDate(a.analyzed_at)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main MasterpieceCard ──────────────────────────────────────────────────────
export function MasterpieceCard({
  plotId, cycle, member,
}: {
  plotId: string;
  cycle: ActiveCycle | null;
  member: AuthBootstrapResult;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [context,    setContext]    = useState('general');
  const [analyzing,  setAnalyzing]  = useState(false);
  const [result,     setResult]     = useState<{
    ai_grade: string; ai_full_response: string; ai_summary: string;
    public_url: string; age_days: number | null; expected_stage: string;
  } | null>(null);
  const [analyses,   setAnalyses]   = useState<Analysis[]>([]);
  const [error,      setError]      = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState(false);

  // Load history
  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb || !plotId) return;
    const q = cycle
      ? sb.from('crop_photo_analyses').select('id,storage_path,activity_context,age_days,ai_grade,ai_summary,analyzed_at').eq('planting_cycle_id', cycle.id).order('analyzed_at', { ascending: false }).limit(8)
      : sb.from('crop_photo_analyses').select('id,storage_path,activity_context,age_days,ai_grade,ai_summary,analyzed_at').eq('plot_id', plotId).order('analyzed_at', { ascending: false }).limit(8);
    void q.then(({ data }) => setAnalyses((data as Analysis[]) ?? []));
  }, [plotId, cycle?.id]);

  // Cycle age
  const ageDays = cycle?.planted_at
    ? Math.floor((Date.now() - new Date(cycle.planted_at).getTime()) / 86400000)
    : null;

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';

    setAnalyzing(true); setError(null); setResult(null);

    const { headers, url } = await getAuthHeaders(member, '/api/member/crop-photo-analysis');
    // Compress before upload: 1024px / quality 80%
    const { processedFile, fileSizeBytes, compressionRatio } = await compressCropPhoto(file);
    console.log(`[CROP_PHOTO] compressed ${Math.round(file.size/1024)}KB → ${Math.round(fileSizeBytes/1024)}KB (${compressionRatio}% saved)`);

    const form = new FormData();
    form.append('photo', processedFile);
    form.append('activity_context', context);
    if (cycle?.id)  form.append('planting_cycle_id', cycle.id);
    if (plotId)     form.append('plot_id', plotId);

    const res = await fetch(url, { method: 'POST', headers, body: form });
    const data = (await res.json()) as {
      ok?: boolean; error?: string;
      ai_grade?: string; ai_full_response?: string; ai_summary?: string;
      public_url?: string; age_days?: number | null; expected_stage?: string;
      analysis_id?: string; storage_path?: string;
    };

    setAnalyzing(false);
    if (!res.ok) { setError(data.error ?? 'วิเคราะห์ไม่สำเร็จ'); return; }

    setResult({
      ai_grade:          data.ai_grade ?? 'good',
      ai_full_response:  data.ai_full_response ?? '',
      ai_summary:        data.ai_summary ?? '',
      public_url:        data.public_url ?? '',
      age_days:          data.age_days ?? null,
      expected_stage:    data.expected_stage ?? '',
    });
    setExpanded(true);

    // Prepend to history
    if (data.analysis_id && data.storage_path) {
      setAnalyses(prev => [{
        id: data.analysis_id!, storage_path: data.storage_path!,
        activity_context: context, age_days: data.age_days ?? null,
        ai_grade: data.ai_grade ?? 'good', ai_summary: data.ai_summary ?? '',
        analyzed_at: new Date().toISOString(),
      }, ...prev].slice(0, 8));
    }
  }

  const grade = result ? (GRADE_CFG[result.ai_grade as keyof typeof GRADE_CFG] ?? GRADE_CFG.good) : null;
  const lastGrade = analyses[0] ? (GRADE_CFG[analyses[0].ai_grade as keyof typeof GRADE_CFG] ?? GRADE_CFG.good) : null;

  return (
    <div style={{ borderTop: '1px solid #f5f5f5' }}>
      <div style={{ padding: '12px 16px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: '#111' }}>
              🏆 ผลงานชิ้นเอก
            </p>
            {ageDays !== null && (
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>
                {cycle?.crop_name} · อายุ {ageDays} วัน
                {result?.expected_stage ? ` · ระยะ${result.expected_stage}` : ''}
              </p>
            )}
          </div>
          {lastGrade && !result && (
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: lastGrade.bg, color: lastGrade.color, fontWeight: 700 }}>
              {lastGrade.emoji} {lastGrade.label}
            </span>
          )}
        </div>

        {/* Context picker */}
        <ContextPicker value={context} onChange={setContext} />

        {/* Shoot button */}
        <button onClick={() => fileRef.current?.click()} disabled={analyzing}
          style={{ width: '100%', padding: '13px', borderRadius: 14, border: 'none', background: analyzing ? '#e5e7eb' : '#1b5e20', color: analyzing ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 800, cursor: analyzing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {analyzing ? (
            <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</span> AI กำลังดูรูป…</>
          ) : (
            <>📸 ถ่ายรูปแปลง — ให้ AI ดูหน่อย</>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={handlePhoto} />

        {/* Error */}
        {error && (
          <p style={{ margin: '8px 0 0', padding: '8px 12px', borderRadius: 8, background: '#fff1f2', color: '#9f1239', fontSize: 13 }}>
            {error}
          </p>
        )}

        {/* AI Result */}
        {result && grade && (
          <div style={{ marginTop: 10, borderRadius: 14, border: `1.5px solid ${grade.border}`, background: grade.bg, overflow: 'hidden' }}>
            {/* Photo + grade header */}
            <div style={{ display: 'flex', gap: 10, padding: '10px 12px', alignItems: 'flex-start' }}>
              <img src={result.public_url} alt="แปลง" style={{ width: 68, height: 68, borderRadius: 10, objectFit: 'cover', flexShrink: 0, border: `1px solid ${grade.border}` }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: grade.border + '40', color: grade.color, fontWeight: 800 }}>
                  {grade.emoji} {grade.label}
                </span>
                <p style={{ margin: '6px 0 0', fontSize: 13, color: '#111', lineHeight: 1.5, fontWeight: 600 }}>
                  {result.ai_summary}
                </p>
              </div>
            </div>

            {/* Full response */}
            {expanded && (
              <div style={{ padding: '0 12px 12px' }}>
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {result.ai_full_response}
                </p>
              </div>
            )}
            <button onClick={() => setExpanded(e => !e)}
              style={{ width: '100%', padding: '8px', border: 'none', background: 'transparent', fontSize: 12, color: grade.color, cursor: 'pointer', borderTop: `1px solid ${grade.border}` }}>
              {expanded ? '▲ ย่อ' : '▼ อ่านเพิ่ม'}
            </button>
          </div>
        )}

        {/* History strip */}
        <HistoryStrip analyses={result ? analyses : analyses} />
      </div>
    </div>
  );
}


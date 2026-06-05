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

const GRADE_CFG: Record<string, { emoji: string; label: string; bg: string; color: string; border: string; infoBg: string; infoColor: string }> = {
  pending: { emoji: '⏳', label: 'กำลังวิเคราะห์', bg: '#f8fafc', color: '#6b7280', border: '#e5e7eb', infoBg: '#f8fafc', infoColor: '#6b7280' },
  great:   { emoji: '🌟', label: 'เจ๋งมาก!',      bg: '#e8f5e9', color: '#1b5e20', border: '#a5d6a7', infoBg: '#f0fdf4', infoColor: '#166534' },
  good:    { emoji: '✅', label: 'ดูดีนะ',           bg: '#f0fdf4', color: '#166534', border: '#86efac', infoBg: '#f0fdf4', infoColor: '#166534' },
  warning: { emoji: '⚠️', label: 'ระวังหน่อย',  bg: '#fffbeb', color: '#92400e', border: '#fcd34d', infoBg: '#fffbeb', infoColor: '#92400e' },
  alert:   { emoji: '🚨', label: 'อันนี้เลี้ยงไม่โตนะ', bg: '#fff1f2', color: '#9f1239', border: '#fda4af', infoBg: '#fff1f2', infoColor: '#9f1239' },
};

const GROWTH_STAGES: Record<string, string> = {
  germination: 'งอก', seedling: 'ต้นกล้า', vegetative: 'เจริญเติบโต',
  tasseling: 'ออกดอกตัวผู้', silking: 'ออกไหม / Silking',
  grain_fill: 'เมล็ดพัฒนา', maturity: 'แก่สุก', harvest_ready: 'พร้อมเก็บเกี่ยว',
};

function relDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1)    return 'เมื่อกี้';
  if (diff < 60)   return `${diff} นาทีที่แล้ว`;
  if (diff < 1440) return `${Math.floor(diff / 60)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 1440)} วันที่แล้ว`;
}

// ── History strip ─────────────────────────────────────────────────────────────
function HistoryStrip({ analyses }: { analyses: Analysis[] }) {
  const sb = tryCreateSupabaseBrowserClient();
  if (!analyses.length || !sb) return null;

  const withPlus = [...analyses.slice(0, 5), null]; // max 5 + "ถ่ายต่อไป"

  return (
    <div style={{ padding: '14px 16px', borderTop: '1px solid #f3f4f6' }}>
      <p style={{ margin: '0 0 10px', fontSize: 13, color: '#6b7280', fontWeight: 600 }}>ประวัติการถ่ายภาพ</p>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {withPlus.map((a, i) => {
          if (!a) return (
            <div key="plus" style={{ flexShrink: 0, textAlign: 'center', width: 60, opacity: 0.4 }}>
              <div style={{ width: 60, height: 60, borderRadius: 12, border: '2px dashed #d1d5db', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 22, color: '#9ca3af' }}>+</span>
              </div>
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>ถ่ายต่อไป</p>
            </div>
          );
          const { data } = sb.storage.from(EVIDENCE_BUCKET).getPublicUrl(a.storage_path);
          const g = GRADE_CFG[a.ai_grade as keyof typeof GRADE_CFG] ?? GRADE_CFG.good;
          return (
            <div key={a.id} style={{ flexShrink: 0, textAlign: 'center', width: 60 }}>
              <div style={{ width: 60, height: 60, borderRadius: 12, overflow: 'hidden', border: `2px solid ${g.border}`, marginBottom: 4 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.publicUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <p style={{ margin: 0, fontSize: 10, color: '#6b7280' }}>
                {i === 0 ? 'วันนี้' : i === 1 ? '7 วันก่อน' : `${relDate(a.analyzed_at)}`}
              </p>
              <p style={{ margin: '1px 0 0', fontSize: 11, color: g.color, fontWeight: 700 }}>{g.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function MasterpieceCard({
  plotId, cycle, member,
}: {
  plotId: string;
  cycle: ActiveCycle | null;
  member: AuthBootstrapResult;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [context,   setContext]   = useState('general');
  const [analyzing, setAnalyzing] = useState<'uploading' | 'analyzing' | null>(null);
  const [result,    setResult]    = useState<{
    ai_grade: string; ai_full_response: string; ai_summary: string;
    public_url: string; age_days: number | null; expected_stage: string;
  } | null>(null);
  const [analyses,  setAnalyses]  = useState<Analysis[]>([]);
  const [error,     setError]     = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb || !plotId) return;
    // Query by plot_id OR planting_cycle_id to catch all historical photos
    // regardless of how they were saved
    const cycleIds = cycle?.id ? [cycle.id] : [];
    let q = sb.from('crop_photo_analyses')
      .select('id,storage_path,activity_context,age_days,ai_grade,ai_summary,analyzed_at')
      .order('analyzed_at', { ascending: false })
      .limit(20);

    if (cycleIds.length > 0) {
      // match plot_id OR planting_cycle_id
      q = q.or(`plot_id.eq.${plotId},planting_cycle_id.eq.${cycleIds[0]}`);
    } else {
      q = q.eq('plot_id', plotId);
    }
    void q.then(({ data }) => setAnalyses((data as Analysis[]) ?? []));
  }, [plotId, cycle?.id]);

  const ageDays = cycle?.planted_at
    ? Math.floor((Date.now() - new Date(cycle.planted_at).getTime()) / 86400000)
    : null;

  // Parse growth stage from expected_stage string
  const stageKey = result?.expected_stage
    ? Object.keys(GROWTH_STAGES).find(k => result.expected_stage.includes(k)) ?? ''
    : '';
  const stageTh = stageKey ? GROWTH_STAGES[stageKey] : result?.expected_stage ?? '';

  // Days to harvest (rough estimate)
  const harvestDays = ageDays !== null ? Math.max(0, 115 - ageDays) : null;

  // Split AI response: first sentence = main msg, rest = advice
  const aiLines = (result?.ai_full_response ?? '').trim().split(/\n+/).filter(Boolean);
  const aiMain  = aiLines[0] ?? '';
  const aiRest  = aiLines.slice(1).join('\n');

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (fileRef.current) fileRef.current.value = '';
    setError(null); setResult(null);

    // ── Step 1: compress + upload to storage immediately (fast ~1-2s) ─────────
    setAnalyzing('uploading');
    const { processedFile } = await compressCropPhoto(file);

    // Upload via API route (handles auth + storage)
    const { headers, url } = await getAuthHeaders(member, '/api/member/crop-photo-analysis');
    const form = new FormData();
    form.append('photo', processedFile);
    form.append('activity_context', context);
    form.append('analyze', 'false'); // upload only, skip AI for now
    if (cycle?.id) form.append('planting_cycle_id', cycle.id);
    if (plotId)    form.append('plot_id', plotId);

    const uploadRes  = await fetch(url, { method: 'POST', headers, body: form });
    const uploadData = (await uploadRes.json()) as {
      ok?: boolean; error?: string;
      public_url?: string; storage_path?: string; analysis_id?: string;
    };

    if (!uploadRes.ok) {
      setAnalyzing(null);
      setError(uploadData.error ?? 'อัปโหลดไม่สำเร็จ');
      return;
    }

    // ── Step 2: show photo immediately, start AI in background ────────────────
    setAnalyzing('analyzing');
    const tempId = uploadData.analysis_id ?? `temp-${Date.now()}`;
    setAnalyses(prev => [{
      id: tempId,
      storage_path:     uploadData.storage_path ?? '',
      activity_context: context,
      age_days:         ageDays,
      ai_grade:         'pending',
      ai_summary:       'AI กำลังวิเคราะห์…',
      analyzed_at:      new Date().toISOString(),
    }, ...prev].slice(0, 8));

    // ── Step 3: trigger AI analysis (non-blocking) ────────────────────────────
    const aiForm = new FormData();
    aiForm.append('analysis_id', tempId);
    aiForm.append('analyze', 'true');
    aiForm.append('activity_context', context);
    if (cycle?.id) aiForm.append('planting_cycle_id', cycle.id);
    if (plotId)    aiForm.append('plot_id', plotId);

    const aiRes  = await fetch(url, { method: 'PATCH', headers, body: aiForm });
    const aiData = (await aiRes.json()) as {
      ok?: boolean; error?: string;
      ai_grade?: string; ai_full_response?: string; ai_summary?: string;
      age_days?: number | null; expected_stage?: string;
    };

    setAnalyzing(null);

    if (!aiRes.ok) {
      // AI failed but photo is saved — show partial result
      setResult({
        ai_grade: 'good', ai_full_response: 'วิเคราะห์ไม่สำเร็จในขณะนี้ แต่รูปเก็บไว้แล้ว',
        ai_summary: 'รูปเก็บแล้ว', public_url: uploadData.public_url ?? '',
        age_days: ageDays, expected_stage: '',
      });
      return;
    }

    setResult({
      ai_grade:         aiData.ai_grade         ?? 'good',
      ai_full_response: aiData.ai_full_response ?? '',
      ai_summary:       aiData.ai_summary       ?? '',
      public_url:       uploadData.public_url    ?? '',
      age_days:         aiData.age_days          ?? ageDays,
      expected_stage:   aiData.expected_stage    ?? '',
    });

    // Update history with real grade
    setAnalyses(prev => prev.map(a => a.id === tempId ? {
      ...a,
      ai_grade:   aiData.ai_grade   ?? 'good',
      ai_summary: aiData.ai_summary ?? '',
    } : a));
  }

  const grade     = result      ? (GRADE_CFG[result.ai_grade        as keyof typeof GRADE_CFG] ?? GRADE_CFG.good) : null;
  const lastGrade = analyses[0] ? (GRADE_CFG[analyses[0].ai_grade   as keyof typeof GRADE_CFG] ?? GRADE_CFG.good) : null;
  const showLastGrade = lastGrade && !result;

  return (
    <div style={{ background: '#fff' }}>

      {/* ── Cycle header ──────────────────────────────────────────────────────── */}
      {cycle && (
        <div style={{ padding: '14px 16px 0' }}>
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
            {cycle.crop_name} · ปลูก {cycle.planted_at
              ? new Date(cycle.planted_at).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'2-digit' })
              : `ปี ${cycle.season_year}`}
          </p>
          <p style={{ margin: '2px 0 0', fontWeight: 800, fontSize: 17, color: '#111' }}>
            อายุ {ageDays ?? '—'} วัน
            {stageTh ? <span style={{ color: '#2e7d32' }}> — ระยะ{stageTh}</span> : ''}
          </p>
        </div>
      )}

      {/* ── Context picker ───────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px 0' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CONTEXTS.map(c => (
            <button key={c.value} onClick={() => setContext(c.value)}
              style={{
                padding: '7px 13px', borderRadius: 99,
                border: `1.5px solid ${context === c.value ? '#2e7d32' : '#e5e7eb'}`,
                background: context === c.value ? '#e8f5e9' : '#fff',
                color: context === c.value ? '#1b5e20' : '#4b5563',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
              {c.icon} {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Photo upload area ─────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 16px' }}>
        <div style={{
          border: '1.5px solid #e5e7eb', borderRadius: 14,
          background: '#fafafa', padding: '14px',
          display: 'flex', gap: 14, alignItems: 'center',
        }}>
          {/* Thumbnail */}
          <div style={{ width: 72, height: 72, borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            <span style={{ fontSize: 30 }}>🌾</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#374151' }}>
              {analyzing === 'uploading' ? '📤 กำลังเก็บรูป…' : analyzing === 'analyzing' ? '🤖 AI กำลังวิเคราะห์รูป…' : 'ถ่ายรูปแปลงของคุณ แล้ว AI จะวิเคราะห์ให้ทันที'}
            </p>
            <button onClick={() => !analyzing && fileRef.current?.click()} disabled={!!analyzing}
              style={{
                padding: '9px 18px', borderRadius: 10,
                border: '1.5px solid #d1d5db',
                background: analyzing ? '#f3f4f6' : '#fff',
                color: analyzing ? '#9ca3af' : '#374151',
                fontSize: 13, fontWeight: 700, cursor: analyzing ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap',
              }}>
              <span>📷</span>{!analyzing && ' ถ่ายรูปแปลงตอนนี้'}
            </button>
          </div>
          {showLastGrade && (
            <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 99, background: lastGrade.bg, color: lastGrade.color, fontWeight: 700, flexShrink: 0 }}>
              {lastGrade.emoji} {lastGrade.label}
            </span>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={handlePhoto} />
      </div>

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ margin: '0 16px 12px', padding: '10px 14px', borderRadius: 10, background: '#fff1f2', border: '1px solid #fda4af', color: '#9f1239', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* ── AI Result ────────────────────────────────────────────────────────── */}
      {result && grade && (
        <div style={{ margin: '0 16px 16px', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111' }}>ผลวิเคราะห์ AI</p>
              <p style={{ margin: 0, fontSize: 11, color: '#9ca3af' }}>เมื่อกี้</p>
            </div>
            <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 99, background: grade.bg, color: grade.color, fontWeight: 700, border: `1px solid ${grade.border}` }}>
              {grade.label}
            </span>
          </div>

          {/* Main text */}
          <div style={{ padding: '12px 14px' }}>
            {result.public_url && (
              <div style={{ float: 'right', marginLeft: 10, marginBottom: 4 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.public_url} alt="แปลง"
                  style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: `2px solid ${grade.border}` }} />
              </div>
            )}
            <p style={{ margin: '0 0 10px', fontSize: 14, color: '#111', lineHeight: 1.7 }}>
              <strong style={{ color: grade.color }}>{aiMain.split('!')[0] + (aiMain.includes('!') ? '!' : '')}</strong>
              {aiMain.includes('!') ? ' ' + aiMain.slice(aiMain.indexOf('!') + 1).trim() : ''}
            </p>
            <div style={{ clear: 'both' }} />

            {/* Info boxes */}
            {stageTh && (
              <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '9px 12px', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span>🌱</span>
                  <span style={{ fontSize: 13, color: '#166534' }}>ระยะปัจจุบัน: <strong>{stageTh}</strong></span>
                </div>
                {harvestDays !== null && harvestDays > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>🕐</span>
                    <span style={{ fontSize: 13, color: '#6b7280' }}>เก็บเกี่ยวได้ในอีกประมาณ <strong style={{ color: '#111' }}>{harvestDays}–{harvestDays + 10} วัน</strong></span>
                  </div>
                )}
              </div>
            )}

            {aiRest && (
              <div style={{ background: result?.ai_grade === 'warning' || result?.ai_grade === 'alert' ? '#fffbeb' : '#f8fafc', borderRadius: 10, padding: '9px 12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span>{grade.emoji === '⚠️' || grade.emoji === '🚨' ? '⚠️' : '💡'}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: grade.color }}>แนะนำ</span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{aiRest}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── History ───────────────────────────────────────────────────────────── */}
      <HistoryStrip analyses={analyses} />
    </div>
  );
}






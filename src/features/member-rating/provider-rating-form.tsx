'use client';

import { useState } from 'react';
import { UIButton } from '@/shared/components/ui-button';

type Props = {
  harvestBookingId: string;
  providerMemberId: string;
  providerName: string;
  ratedByMemberId: string;
  onDone: () => void;
};

const DIMS = [
  { key: 'score_punctuality', label: 'ตรงเวลา',       icon: '⏰', desc: '1=สายมาก 5=ตรงเวลา' },
  { key: 'score_quality',     label: 'คุณภาพงาน',     icon: '⭐', desc: '1=แย่มาก 5=ดีเยี่ยม' },
  { key: 'score_loss',        label: 'ความสูญเสีย',   icon: '📉', desc: '1=สูญเสียมาก 5=น้อยมาก' },
  { key: 'score_cleanliness', label: 'ความสะอาด',     icon: '🧹', desc: '1=สกปรก 5=สะอาดมาก' },
  { key: 'score_safety',      label: 'ความปลอดภัย',   icon: '🦺', desc: '1=เสี่ยง 5=ปลอดภัยมาก' },
] as const;

type ScoreKey = typeof DIMS[number]['key'];
type Scores = Record<ScoreKey, number>;

const EMPTY_SCORES: Scores = {
  score_punctuality: 0, score_quality: 0, score_loss: 0,
  score_cleanliness: 0, score_safety: 0,
};

function gradeFromAvg(avg: number) {
  if (avg >= 4.5) return { grade: 'A+', color: '#1b5e20', bg: '#e8f5e9' };
  if (avg >= 4.0) return { grade: 'A',  color: '#2e7d32', bg: '#f1f8f1' };
  if (avg >= 3.5) return { grade: 'B+', color: '#1565c0', bg: '#e3f2fd' };
  if (avg >= 3.0) return { grade: 'B',  color: '#1976d2', bg: '#e8f0fe' };
  return { grade: 'C', color: '#e65100', bg: '#fff3e0' };
}

export function ProviderRatingForm({ harvestBookingId, providerMemberId, providerName, ratedByMemberId, onDone }: Props) {
  const [scores, setScores] = useState<Scores>(EMPTY_SCORES);
  const [note, setNote]     = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone]     = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const filled = Object.values(scores).every((v) => v > 0);
  const avg    = filled ? Object.values(scores).reduce((s, v) => s + v, 0) / 5 : 0;
  const { grade, color, bg } = gradeFromAvg(avg);

  async function submit() {
    if (!filled) return;
    setSaving(true); setError(null);
    const res = await fetch('/api/member/rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        harvest_booking_id:  harvestBookingId,
        provider_member_id:  providerMemberId,
        rated_by_member_id:  ratedByMemberId,
        note: note || null,
        ...scores,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setError(d.error ?? 'บันทึกไม่สำเร็จ'); return; }
    setDone(true);
  }

  if (done) {
    const result = gradeFromAvg(avg);
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 64, marginBottom: 8, background: result.bg, borderRadius: '50%', width: 80, height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <span style={{ fontSize: 36, fontWeight: 900, color: result.color }}>{result.grade}</span>
        </div>
        <p style={{ fontWeight: 800, fontSize: 18, margin: '0 0 4px' }}>ขอบคุณสำหรับการให้คะแนน</p>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '0 0 20px' }}>คะแนนเฉลี่ย {avg.toFixed(1)} / 5.0</p>
        <UIButton onClick={onDone} variant="ghost">← กลับ</UIButton>
      </div>
    );
  }

  return (
    <div className="mobile-stack">
      <div className="kaona-card" style={{ textAlign: 'center', background: '#f1f8f1' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>ให้คะแนน</p>
        <p style={{ margin: '4px 0 0', fontWeight: 800, fontSize: 17 }}>{providerName}</p>
      </div>

      {error && <div style={{ background: '#ffebee', borderRadius: 10, padding: '10px 14px', color: '#c62828', fontWeight: 600 }}>⚠️ {error}</div>}

      {DIMS.map((dim) => (
        <div key={dim.key} className="kaona-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{dim.icon} {dim.label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{dim.desc}</p>
            </div>
            {scores[dim.key] > 0 && (
              <span style={{ fontWeight: 900, fontSize: 20, color: 'var(--primary)' }}>{scores[dim.key]}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((v) => (
              <button key={v} onClick={() => setScores((p) => ({ ...p, [dim.key]: v }))}
                style={{ flex: 1, height: 44, borderRadius: 10, border: `2px solid ${scores[dim.key] === v ? 'var(--primary)' : '#e0e0e0'}`, background: scores[dim.key] === v ? '#e8f5e9' : '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 18, color: scores[dim.key] === v ? 'var(--primary)' : '#9ca3af', transition: 'all 0.1s' }}>
                {'★'.repeat(v).slice(-1)}
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{v}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* preview grade */}
      {filled && (
        <div style={{ background: bg, border: `2px solid ${color}`, borderRadius: 14, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color }}>เกรดที่จะได้รับ</p>
            <p style={{ margin: '4px 0 0', fontWeight: 900, fontSize: 28, color }}>{grade}</p>
          </div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 18, color }}>เฉลี่ย {avg.toFixed(1)} / 5</p>
        </div>
      )}

      <label className="reg-label">หมายเหตุ (ถ้ามี)
        <textarea className="reg-input reg-textarea" rows={2} value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="ความคิดเห็นเพิ่มเติม…" />
      </label>

      <UIButton fullWidth onClick={submit} loading={saving} disabled={!filled || saving}>
        💾 บันทึกการประเมิน
      </UIButton>
    </div>
  );
}

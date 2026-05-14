'use client';

import { useState } from 'react';
import { UIButton } from '@/shared/components/ui-button';

type Props = {
  bookingId: string;
  providerMemberId: string;
  providerName: string;
  ratedByMemberId: string;
  onDone: () => void;
};

const CRITERIA = [
  { key: 'score_punctuality', label: 'ตรงเวลา',      icon: '⏰', desc: 'มาถึงตามนัด เสร็จงานตามกำหนด' },
  { key: 'score_quality',     label: 'คุณภาพงาน',    icon: '🌾', desc: 'เกี่ยวสะอาด ไม่มีผลผลิตตกค้าง' },
  { key: 'score_loss',        label: 'ความสูญเสีย',  icon: '📉', desc: '5 = สูญเสียน้อยมาก 1 = สูญเสียมาก' },
  { key: 'score_cleanliness', label: 'ความสะอาด',    icon: '✨', desc: 'รถและอุปกรณ์สะอาด เป็นระเบียบ' },
  { key: 'score_safety',      label: 'ความปลอดภัย',  icon: '🦺', desc: 'ปฏิบัติงานปลอดภัย ไม่มีอุบัติเหตุ' },
] as const;

const GRADE_COLOR: Record<string, { bg: string; color: string }> = {
  'A+': { bg: '#e8f5e9', color: '#1b5e20' },
  'A':  { bg: '#e8f5e9', color: '#2e7d32' },
  'B+': { bg: '#e3f2fd', color: '#1565c0' },
  'B':  { bg: '#fff8e1', color: '#e65100' },
  'C':  { bg: '#ffebee', color: '#c62828' },
};

function calcGrade(scores: number[]): string {
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg >= 4.5) return 'A+';
  if (avg >= 4.0) return 'A';
  if (avg >= 3.5) return 'B+';
  if (avg >= 3.0) return 'B';
  return 'C';
}

export function HarvestRatingForm({ bookingId, providerMemberId, providerName, ratedByMemberId, onDone }: Props) {
  const [scores, setScores] = useState<Record<string, number>>({
    score_punctuality: 0, score_quality: 0, score_loss: 0,
    score_cleanliness: 0, score_safety: 0,
  });
  const [note, setNote]         = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const filled = Object.values(scores).filter((s) => s > 0);
  const grade  = filled.length === 5 ? calcGrade(Object.values(scores)) : null;
  const gradeStyle = grade ? GRADE_COLOR[grade] : null;

  async function submit() {
    if (filled.length < 5) { setError('กรุณาให้คะแนนทุกหัวข้อ'); return; }
    setSubmitting(true); setError(null);
    const res = await fetch('/api/member/rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        harvest_booking_id: bookingId,
        provider_member_id: providerMemberId,
        rated_by_member_id: ratedByMemberId,
        ...scores, note: note || null,
      }),
    });
    const d = (await res.json()) as { ok?: boolean; error?: string };
    setSubmitting(false);
    if (!res.ok) { setError(d.error ?? 'บันทึกไม่สำเร็จ'); return; }
    onDone();
  }

  return (
    <div className="mobile-stack">
      <div className="kaona-card" style={{ background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', color: '#fff' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>ประเมินผู้ให้บริการ</p>
        <p style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 800 }}>🚛 {providerName}</p>
      </div>

      {error && (
        <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 12, padding: '10px 14px', fontSize: 14, color: '#c62828', fontWeight: 600 }}>
          ⚠️ {error}
        </div>
      )}

      {CRITERIA.map(({ key, label, icon, desc }) => (
        <div key={key} className="kaona-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{icon} {label}</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{desc}</p>
            </div>
            {scores[key] > 0 && (
              <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--primary)' }}>
                {scores[key]}/5
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setScores((p) => ({ ...p, [key]: star }))}
                style={{
                  flex: 1, height: 44, borderRadius: 10,
                  border: `2px solid ${scores[key] >= star ? 'var(--primary)' : '#e0e0e0'}`,
                  background: scores[key] >= star ? '#e8f5e9' : '#fff',
                  cursor: 'pointer', fontSize: 18, transition: 'all 0.1s',
                }}
              >
                {scores[key] >= star ? '⭐' : '☆'}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Preview grade */}
      {grade && gradeStyle && (
        <div style={{ background: gradeStyle.bg, border: `2px solid ${gradeStyle.color}44`, borderRadius: 14, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: gradeStyle.color }}>เกรดรวม</p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>
              คะแนนเฉลี่ย {(Object.values(scores).reduce((a, b) => a + b, 0) / 5).toFixed(1)} / 5.0
            </p>
          </div>
          <span style={{ fontSize: 40, fontWeight: 900, color: gradeStyle.color }}>{grade}</span>
        </div>
      )}

      <label className="reg-label">ความคิดเห็นเพิ่มเติม
        <textarea className="reg-input reg-textarea" rows={2} value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="ข้อดี ข้อเสนอแนะ..." />
      </label>

      <UIButton fullWidth onClick={submit} loading={submitting} disabled={filled.length < 5 || submitting}>
        ⭐ ส่งการประเมิน
      </UIButton>
    </div>
  );
}

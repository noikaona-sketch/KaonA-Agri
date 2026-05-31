'use client';

import { useEffect, useState } from 'react';
import { useCurrentMember }    from '@/providers/auth-provider';
import { MobileAppShell }      from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }      from '@/shared/components/protected-route';
import { LoadingState }        from '@/shared/components/loading-state';

type Booking = {
  id: string; status: string;
  expected_date_from: string; expected_date_to: string;
  estimated_tonnage: number; estimated_moisture: number | null;
  scheduled_date: string | null; actual_weight_kg: number | null;
  note: string | null; created_at: string;
  has_rating: boolean;
  provider_member_id: string | null; provider_name: string | null;
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  planned:    { label: '📋 วางแผน',      color: '#6b7280', bg: '#f3f4f6' },
  confirmed:  { label: '✅ ยืนยันแล้ว',  color: '#1565c0', bg: '#e3f2fd' },
  in_progress:{ label: '🚜 กำลังเก็บ',   color: '#e65100', bg: '#fff3e0' },
  completed:  { label: '🏁 เสร็จสิ้น',   color: '#2e7d32', bg: '#e8f5e9' },
  cancelled:  { label: '⛔ ยกเลิก',      color: '#9e9e9e', bg: '#f5f5f5' },
};

// ── Star rating component ──────────────────────────────────────────────────
function StarRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: '#374151', flex: 1 }}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            fontSize: 22, background: 'none', border: 'none', cursor: 'pointer',
            color: n <= value ? '#f59e0b' : '#e5e7eb', padding: '2px',
          }}>★</button>
        ))}
      </div>
    </div>
  );
}

function RatingModal({ booking, memberId, onClose, onDone }: {
  booking: Booking; memberId: string; onClose: () => void; onDone: () => void;
}) {
  const [scores, setScores] = useState({ punctuality: 5, quality: 5, loss: 5, cleanliness: 5, safety: 5 });
  const [note, setNote]     = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function submit() {
    setSaving(true); setError(null);
    const res = await fetch('/api/member/rating', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        harvest_booking_id: booking.id,
        provider_member_id: booking.provider_member_id,
        rated_by_member_id: memberId,
        score_punctuality:  scores.punctuality,
        score_quality:      scores.quality,
        score_loss:         scores.loss,
        score_cleanliness:  scores.cleanliness,
        score_safety:       scores.safety,
        note: note.trim() || null,
      }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setError(j.error ?? 'บันทึกไม่สำเร็จ'); return; }
    onDone();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100 }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 440, maxHeight: '88vh', overflow: 'auto', padding: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>⭐ ให้คะแนนบริการ</p>
              {booking.provider_name && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>ผู้ให้บริการ: {booking.provider_name}</p>}
            </div>
            <button onClick={onClose} style={{ background: '#f3f4f6', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: '#6b7280' }}>✕</button>
          </div>

          {error && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#ffebee', color: '#c62828', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <StarRow label="🕐 ตรงเวลา"        value={scores.punctuality}  onChange={v => setScores(s => ({ ...s, punctuality: v }))} />
          <StarRow label="🌾 คุณภาพงาน"      value={scores.quality}      onChange={v => setScores(s => ({ ...s, quality: v }))} />
          <StarRow label="📦 การสูญเสีย"     value={scores.loss}         onChange={v => setScores(s => ({ ...s, loss: v }))} />
          <StarRow label="🧹 ความสะอาด"      value={scores.cleanliness}  onChange={v => setScores(s => ({ ...s, cleanliness: v }))} />
          <StarRow label="⛑️ ความปลอดภัย"   value={scores.safety}       onChange={v => setScores(s => ({ ...s, safety: v }))} />

          <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
            placeholder="ความคิดเห็นเพิ่มเติม…" className="reg-input"
            style={{ resize: 'none', marginBottom: 14, fontFamily: 'inherit' }} />

          <button onClick={submit} disabled={saving}
            style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
            {saving ? 'กำลังบันทึก…' : '⭐ ส่งคะแนน'}
          </button>
        </div>
      </div>
    </>
  );
}

function HarvestHistoryContent() {
  const member = useCurrentMember();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading]   = useState(true);
  const [rating,  setRating]    = useState<Booking | null>(null);
  const [notice,  setNotice]    = useState<string | null>(null);

  async function load() {
    if (!member?.member_id) return;
    const res = await fetch(`/api/member/harvest-bookings?member_id=${member.member_id}`);
    if (res.ok) {
      const j = (await res.json()) as { bookings?: Booking[] };
      setBookings(j.bookings ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [member?.member_id]);

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <MobileAppShell title="🚜 ประวัติการเกี่ยว" subtitle="รายการนัดเกี่ยวและการให้คะแนน">
      <div className="mobile-stack">
        {notice && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: '#e8f5e9', border: '1px solid #a5d6a7', color: '#1b5e20', fontSize: 13, fontWeight: 600 }}>
            {notice}
          </div>
        )}

        {bookings.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 48 }}>🚜</div>
            <p style={{ margin: '12px 0 0', fontSize: 14, color: '#9ca3af' }}>ยังไม่มีประวัติการเกี่ยว</p>
          </div>
        )}

        {bookings.map(b => {
          const st = STATUS_CFG[b.status] ?? STATUS_CFG.planned;
          return (
            <div key={b.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8ede8', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: st.color, background: st.bg, padding: '3px 10px', borderRadius: 99 }}>{st.label}</span>
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  {new Date(b.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                </span>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, background: '#f0fdf4', color: '#2e7d32', padding: '3px 10px', borderRadius: 99 }}>
                    ⚖️ {b.estimated_tonnage} ตัน
                  </span>
                  {b.estimated_moisture && (
                    <span style={{ fontSize: 12, background: '#e3f2fd', color: '#1565c0', padding: '3px 10px', borderRadius: 99 }}>
                      💧 ชื้น {b.estimated_moisture}%
                    </span>
                  )}
                  {b.actual_weight_kg && (
                    <span style={{ fontSize: 12, background: '#fff3e0', color: '#e65100', padding: '3px 10px', borderRadius: 99 }}>
                      ✅ จริง {(b.actual_weight_kg/1000).toFixed(2)} ตัน
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                  📅 {new Date(b.expected_date_from).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  {b.scheduled_date && ` → นัดจริง ${new Date(b.scheduled_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`}
                </p>
                {b.note && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#9ca3af' }}>{b.note}</p>}

                {b.status === 'completed' && !b.has_rating && (
                  <button onClick={() => setRating(b)}
                    style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 10, border: '1px solid #ffe082', background: '#fff8e1', color: '#e65100', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as React.CSSProperties}>
                    ⭐ ให้คะแนนบริการ
                  </button>
                )}
                {b.has_rating && (
                  <p style={{ margin: '8px 0 0', fontSize: 11, color: '#2e7d32', fontWeight: 600 }}>✅ ให้คะแนนแล้ว</p>
                )}
              </div>
            </div>
          );
        })}

        {rating && (
          <RatingModal
            booking={rating}
            memberId={member!.member_id}
            onClose={() => setRating(null)}
            onDone={() => { setRating(null); setNotice('✅ ขอบคุณสำหรับคะแนน!'); void load(); }}
          />
        )}
      </div>
    </MobileAppShell>
  );
}

export default function HarvestHistoryPage() {
  return <ProtectedRoute><HarvestHistoryContent /></ProtectedRoute>;
}

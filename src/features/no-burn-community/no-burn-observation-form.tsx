'use client';

// ─────────────────────────────────────────────────────────────────────────────
// NoBurnObservationForm — Issue #218 PR2C
//
// For service team members (truck_owner, inspector, staff) who are in the field
// and want to optionally record what they observe about burn/no-burn conditions.
//
// Design principles:
//   - Optional — not required to submit
//   - Neutral observation language — not a verdict
//   - Does not change no_burn_requests.status
//   - GPS capture at submit time (best-effort, non-blocking)
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { UIButton } from '@/shared/components/ui-button';

const CONDITION_OPTIONS = [
  { value: 'no_burn_signs', label: '🌿 เห็นร่องรอยไม่เผา',  color: '#2e7d32', bg: '#e8f5e9',
    hint: 'ตอซังสมบูรณ์, ไม่มีรอยเถ้า, มีฟางคลุมดิน' },
  { value: 'partial_signs', label: '⚠️ บางส่วน',             color: '#e65100', bg: '#fff3e0',
    hint: 'บางแปลงมีรอยเผา บางส่วนไม่มี' },
  { value: 'burn_signs',    label: '🔥 เห็นร่องรอยเผา',     color: '#c62828', bg: '#ffebee',
    hint: 'มีเถ้า, รอยไหม้, ตอซังถูกเผา' },
  { value: 'unclear',       label: '❓ ไม่แน่ชัด',           color: '#9e9e9e', bg: '#f5f5f5',
    hint: 'สภาพแปลงไม่ชัดเจน หรือเข้าถึงไม่ได้' },
] as const;

async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

type Props = {
  noBurnRequestId: string;
  onDone?: () => void;
};

export function NoBurnObservationForm({ noBurnRequestId, onDone }: Props) {
  const [condition,  setCondition]  = useState<string>('');
  const [note,       setNote]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice,     setNotice]     = useState<string | null>(null);
  const [error,      setError]      = useState<string | null>(null);

  async function submit() {
    if (!condition) { setError('กรุณาเลือกสิ่งที่พบเห็น'); return; }
    setSubmitting(true);
    setError(null);

    // Best-effort GPS at submit time — non-blocking
    let lat: number | null = null;
    let lng: number | null = null;
    let accuracy: number | null = null;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true, timeout: 8000, maximumAge: 0,
          }),
        );
        lat      = pos.coords.latitude;
        lng      = pos.coords.longitude;
        accuracy = pos.coords.accuracy;
      } catch { /* denied or timed-out — proceed without GPS */ }
    }

    const token = await getBearerToken();
    const res = await fetch('/api/member/no-burn-observation', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        no_burn_request_id: noBurnRequestId,
        observed_condition: condition,
        note:               note.trim() || undefined,
        lat:                lat ?? undefined,
        lng:                lng ?? undefined,
        accuracy:           accuracy ?? undefined,
      }),
    });

    const json = (await res.json()) as { ok?: boolean; error?: string };
    setSubmitting(false);

    if (!res.ok || json.error) {
      setError(json.error ?? 'บันทึกไม่สำเร็จ');
    } else {
      setNotice('✅ บันทึกการสังเกตการณ์แล้ว');
      setCondition('');
      setNote('');
      onDone?.();
    }
  }

  if (notice) {
    return (
      <div style={{
        background: '#f0fdf4', border: '1px solid #86efac',
        borderRadius: 10, padding: '12px 14px',
      }}>
        <p style={{ margin: 0, fontSize: 13, color: '#14532d', fontWeight: 600 }}>{notice}</p>
      </div>
    );
  }

  return (
    <div className="kaona-card">
      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14 }}>
        📋 บันทึกการสังเกตการณ์
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-secondary)' }}>
        บันทึกเป็นข้อมูลสนับสนุนเท่านั้น — ไม่ใช่การตัดสินผล
      </p>

      {/* Condition grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        {CONDITION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setCondition(opt.value)}
            title={opt.hint}
            style={{
              padding: '10px 8px', borderRadius: 10, border: '2px solid',
              borderColor: condition === opt.value ? opt.color : '#e5e7eb',
              background:  condition === opt.value ? opt.bg : '#fff',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13,
              color: condition === opt.value ? opt.color : 'var(--text-secondary)' }}>
              {opt.label}
            </p>
            <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', lineHeight: 1.4 }}>
              {opt.hint}
            </p>
          </button>
        ))}
      </div>

      {/* Note */}
      <label style={{ display: 'block', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          รายละเอียดเพิ่มเติม (ไม่บังคับ)
        </span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="เช่น ตอซังสมบูรณ์ ไม่พบร่องรอยเถ้า GPS ±5ม."
          style={{
            width: '100%', borderRadius: 8, border: '1px solid #d1d5db',
            padding: '8px 10px', fontSize: 12, resize: 'vertical', marginTop: 4,
          }}
        />
      </label>

      {error && (
        <p style={{ fontSize: 12, color: '#e53e3e', margin: '0 0 8px' }}>⚠️ {error}</p>
      )}

      <UIButton
        fullWidth
        type="button"
        onClick={() => void submit()}
        disabled={submitting || !condition}
        loading={submitting}
      >
        บันทึกการสังเกตการณ์
      </UIButton>
    </div>
  );
}

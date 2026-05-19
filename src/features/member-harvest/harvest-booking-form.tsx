'use client';

// ─────────────────────────────────────────────────────────────────────────────
// MemberHarvestBookingForm — P2 v1 Farmer Forecast
//
// Embedded in /planting-cycles/[id] when cycle status is maturing or ready.
// Collects farmer's harvest forecast — NOT logistics scheduling.
//
// Fields:
//   scheduled_date        — expected harvest date (farmer's best estimate)
//   estimated_yield_kg    — estimated tonnage
//   drying_preference     — required | optional | not_required | unknown
//   delivery_type         — fresh | field_dry | unknown
//   estimated_moisture_pct — optional, farmer estimate
//   moisture_source        — how estimate was derived
//
// Rough value estimate: qty × market_price (computed inline, not stored)
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { UIButton }                        from '@/shared/components/ui-button';

// ── Types ─────────────────────────────────────────────────────────────────────
type DryingPref     = 'required' | 'optional' | 'not_required' | 'unknown';
type DeliveryType   = 'fresh' | 'field_dry' | 'unknown';
type MoistureSource = 'farmer_estimate' | 'field_test' | 'factory_measure';

type ExistingBooking = {
  id: string;
  scheduled_date: string;
  status: string;
  actual_yield_kg: number | null;
  drying_preference: string | null;
  delivery_type: string | null;
  estimated_moisture_pct: number | null;
};

// ── Labels ────────────────────────────────────────────────────────────────────
const DRYING_OPTIONS: { value: DryingPref; label: string; hint: string }[] = [
  { value: 'required',    label: '🔥 ต้องอบ',         hint: 'ความชื้นสูง ต้องผ่านเครื่องอบ' },
  { value: 'optional',   label: '🌤️ อาจอบ',          hint: 'ขึ้นกับสภาพอากาศวันเก็บ' },
  { value: 'not_required', label: '✅ ไม่ต้องอบ',    hint: 'ผึ่งแห้งเองหรือส่งสด' },
  { value: 'unknown',    label: '❓ ยังไม่ตัดสินใจ', hint: '' },
];

const DELIVERY_OPTIONS: { value: DeliveryType; label: string; hint: string }[] = [
  { value: 'fresh',      label: '🌽 ส่งสด',       hint: 'ส่งโดยตรงหลังเก็บ ยังไม่ผ่านการอบ' },
  { value: 'field_dry',  label: '☀️ ผึ่งแห้งเอง', hint: 'ผึ่งแห้งในแปลง/ลาน ก่อนส่ง' },
  { value: 'unknown',    label: '❓ ยังไม่แน่ใจ',  hint: '' },
];

const BOOKING_STATUS_TH: Record<string, string> = {
  pending:   '⏳ รอยืนยัน',
  confirmed: '✅ ยืนยันแล้ว',
  completed: '🏁 เสร็จสิ้น',
  cancelled: '⛔ ยกเลิก',
};

// ── Helper: Bearer token ──────────────────────────────────────────────────────
async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
type Props = {
  cycleId:   string;
  cropName:  string;
  plotId?:   string;
  onSuccess?: () => void;
};

export function MemberHarvestBookingForm({ cycleId, cropName, plotId, onSuccess }: Props) {
  // ── Form state ──────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const [scheduledDate,   setScheduledDate]   = useState('');
  const [estimatedYield,  setEstimatedYield]  = useState('');
  const [dryingPref,      setDryingPref]      = useState<DryingPref>('unknown');
  const [deliveryType,    setDeliveryType]    = useState<DeliveryType>('unknown');
  const [moisturePct,     setMoisturePct]     = useState('');
  const [moistureSource,  setMoistureSource]  = useState<MoistureSource | ''>('');
  const [note,            setNote]            = useState('');

  // ── Rough value estimate ────────────────────────────────────────────────────
  const [marketPrice,  setMarketPrice]  = useState<number | null>(null);
  const estimatedValue =
    marketPrice !== null && Number(estimatedYield) > 0
      ? Math.round(Number(estimatedYield) * marketPrice)
      : null;

  // ── Existing booking ────────────────────────────────────────────────────────
  const [existing,    setExisting]    = useState<ExistingBooking | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // ── Submit state ────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState(false);

  // ── Load market price + existing booking ────────────────────────────────────
  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) { setLoadingExisting(false); return; }

    void (async () => {
      // Market price for crop
      const { data: price } = await sb
        .from('market_prices')
        .select('price_per_kg')
        .eq('is_active', true)
        .ilike('crop_type', `%${cropName}%`)
        .order('effective_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (price) setMarketPrice(Number(price.price_per_kg));

      // Existing pending/confirmed booking
      const token = await getBearerToken();
      const res = await fetch(`/api/member/harvest-booking?cycle_id=${cycleId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const json = (await res.json()) as { bookings: ExistingBooking[] };
        const active = json.bookings?.find((b) =>
          b.status === 'pending' || b.status === 'confirmed',
        ) ?? null;
        setExisting(active);
      }
      setLoadingExisting(false);
    })();
  }, [cycleId, cropName]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function submit() {
    setError(null);
    if (!scheduledDate) { setError('กรุณาระบุวันที่คาดว่าจะเก็บเกี่ยว'); return; }
    if (!estimatedYield || Number(estimatedYield) <= 0) {
      setError('กรุณาระบุน้ำหนักผลผลิตที่คาดไว้ (กก.)');
      return;
    }

    setSubmitting(true);
    const token = await getBearerToken();
    const res = await fetch('/api/member/harvest-booking', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        planting_cycle_id:      cycleId,
        scheduled_date:         scheduledDate,
        plot_id:                plotId ?? undefined,
        note:                   note.trim() || undefined,
        drying_preference:      dryingPref,
        delivery_type:          deliveryType,
        estimated_yield_kg:     Number(estimatedYield),
        estimated_moisture_pct: moisturePct ? Number(moisturePct) : undefined,
        moisture_source:        moistureSource || undefined,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; error?: string };
    setSubmitting(false);

    if (!res.ok || json.error) {
      setError(json.error ?? 'บันทึกไม่สำเร็จ กรุณาลองใหม่');
    } else {
      setSuccess(true);
      onSuccess?.();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  // Existing booking — show status only
  if (!loadingExisting && existing) {
    return (
      <div className="kaona-card" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15 }}>
          🌾 แจ้งเก็บเกี่ยวแล้ว
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 13 }}>
          วันที่คาด: {new Date(existing.scheduled_date).toLocaleDateString('th-TH', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 13 }}>
          สถานะ: {BOOKING_STATUS_TH[existing.status] ?? existing.status}
        </p>
        {existing.drying_preference && existing.drying_preference !== 'unknown' && (
          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>
            การอบ: {DRYING_OPTIONS.find((o) => o.value === existing.drying_preference)?.label}
          </p>
        )}
        {existing.delivery_type && existing.delivery_type !== 'unknown' && (
          <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
            การส่ง: {DELIVERY_OPTIONS.find((o) => o.value === existing.delivery_type)?.label}
          </p>
        )}
      </div>
    );
  }

  if (success) {
    return (
      <div className="kaona-card" style={{ background: '#f0fdf4', border: '1px solid #86efac' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>
          ✅ แจ้งเก็บเกี่ยวสำเร็จ — รอทีมงานยืนยัน
        </p>
      </div>
    );
  }

  return (
    <div className="kaona-card">
      <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 15 }}>
        🌾 แจ้งแผนเก็บเกี่ยว
      </p>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        แจ้งข้อมูลเบื้องต้นเพื่อช่วยวางแผนโรงงาน — ข้อมูลจริงอาจเปลี่ยนแปลงได้
      </p>

      {/* Scheduled date */}
      <label>
        วันที่คาดว่าจะเก็บเกี่ยว <span style={{ color: '#e53e3e' }}>*</span>
        <input
          type="date"
          value={scheduledDate}
          min={today}
          onChange={(e) => setScheduledDate(e.target.value)}
          disabled={submitting}
        />
      </label>

      {/* Estimated yield */}
      <label>
        น้ำหนักผลผลิตที่คาดไว้ (กก.) <span style={{ color: '#e53e3e' }}>*</span>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="100"
          value={estimatedYield}
          onChange={(e) => setEstimatedYield(e.target.value)}
          disabled={submitting}
          placeholder="เช่น 5000"
        />
      </label>

      {/* Rough value estimate */}
      {estimatedValue !== null && (
        <div style={{
          background: '#fefce8', border: '1px solid #fde047',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12,
        }}>
          <p style={{ margin: 0, fontSize: 13, color: '#713f12' }}>
            💰 ราคาประเมินเบื้องต้น:{' '}
            <strong>{estimatedValue.toLocaleString()} บาท</strong>
            <span style={{ fontWeight: 400, fontSize: 11, color: '#92400e' }}>
              {' '}({Number(estimatedYield).toLocaleString()} กก. × {marketPrice} บาท/กก.)
            </span>
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: '#92400e' }}>
            * คำนวณจากราคากลางปัจจุบัน ไม่รวมการปรับตามความชื้น
          </p>
        </div>
      )}

      {/* Drying preference */}
      <label style={{ display: 'block', marginBottom: 8 }}>
        ความต้องการการอบ
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
        {DRYING_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDryingPref(opt.value)}
            disabled={submitting}
            style={{
              padding: '10px 8px', borderRadius: 10, border: '2px solid',
              borderColor: dryingPref === opt.value ? '#e65100' : '#e5e7eb',
              background:  dryingPref === opt.value ? '#fff3e0' : '#fff',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 13,
              color: dryingPref === opt.value ? '#e65100' : 'var(--text-secondary)' }}>
              {opt.label}
            </p>
            {opt.hint && (
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af', lineHeight: 1.4 }}>{opt.hint}</p>
            )}
          </button>
        ))}
      </div>

      {/* Delivery type */}
      <label style={{ display: 'block', marginBottom: 8 }}>
        วิธีส่งผลผลิต
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        {DELIVERY_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDeliveryType(opt.value)}
            disabled={submitting}
            style={{
              padding: '10px 6px', borderRadius: 10, border: '2px solid',
              borderColor: deliveryType === opt.value ? '#1565c0' : '#e5e7eb',
              background:  deliveryType === opt.value ? '#e3f2fd' : '#fff',
              cursor: 'pointer', textAlign: 'center',
            }}
          >
            <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: 12,
              color: deliveryType === opt.value ? '#1565c0' : 'var(--text-secondary)' }}>
              {opt.label}
            </p>
            {opt.hint && (
              <p style={{ margin: 0, fontSize: 9, color: '#9ca3af', lineHeight: 1.3 }}>{opt.hint}</p>
            )}
          </button>
        ))}
      </div>

      {/* Moisture estimate (optional) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
        <label>
          ความชื้นโดยประมาณ (%) <span style={{ fontSize: 11, color: '#9ca3af' }}>ไม่บังคับ</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="100"
            step="0.5"
            value={moisturePct}
            onChange={(e) => setMoisturePct(e.target.value)}
            disabled={submitting}
            placeholder="เช่น 28.5"
          />
        </label>
        <label>
          วิธีประเมินความชื้น
          <select
            value={moistureSource}
            onChange={(e) => setMoistureSource(e.target.value as MoistureSource | '')}
            disabled={submitting || !moisturePct}
          >
            <option value="">เลือก</option>
            <option value="farmer_estimate">ประเมินจากประสบการณ์</option>
            <option value="field_test">ทดสอบในแปลง</option>
            <option value="factory_measure">วัดจากโรงงาน</option>
          </select>
        </label>
      </div>

      {/* Note */}
      <label>
        หมายเหตุ <span style={{ fontSize: 11, color: '#9ca3af' }}>ไม่บังคับ</span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={submitting}
          placeholder="เช่น สภาพแปลง ปัญหาที่พบ จุดนัดหมาย"
        />
      </label>

      {error && (
        <div style={{
          background: '#fff3cd', border: '1px solid #ffc107',
          borderRadius: 8, padding: '10px 14px',
          color: '#856404', fontSize: 13, marginBottom: 8,
        }}>
          ⚠️ {error}
        </div>
      )}

      <UIButton
        fullWidth
        type="button"
        onClick={() => void submit()}
        disabled={submitting || !scheduledDate || !estimatedYield}
        loading={submitting}
      >
        {submitting ? 'กำลังบันทึก…' : 'บันทึกแผนเก็บเกี่ยว'}
      </UIButton>
    </div>
  );
}

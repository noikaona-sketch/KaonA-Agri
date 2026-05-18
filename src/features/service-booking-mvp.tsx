'use client';

import { useCallback, useEffect, useState } from 'react';

import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { EmptyState }   from '@/shared/components/empty-state';
import { ErrorState }   from '@/shared/components/error-state';
import { FormSheet }    from '@/shared/components/form-sheet';
import { LoadingState } from '@/shared/components/loading-state';
import { StatusChip }   from '@/shared/components/status-chip';
import { UIButton }     from '@/shared/components/ui-button';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type ServiceType = 'tractor' | 'harvester' | 'transport';

type BookingRow = {
  id:             string;
  service_type:   ServiceType;
  scheduled_date: string;
  note:           string | null;
  status:         string;
  created_at:     string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const SERVICE_OPTIONS: { id: ServiceType; label: string; desc: string }[] = [
  { id: 'tractor',   label: '🚜 รถไถ',        desc: 'ไถพรวนเตรียมดิน' },
  { id: 'harvester', label: '🌾 รถเกี่ยว',    desc: 'เก็บเกี่ยวผลผลิต' },
  { id: 'transport', label: '🚛 รถขนส่ง',     desc: 'ขนส่งผลผลิต' },
];

const STATUS_LABEL: Record<string, string> = {
  pending:     '⏳ รอยืนยัน',
  confirmed:   '✅ ยืนยันแล้ว',
  in_progress: '🔄 กำลังดำเนินการ',
  completed:   '🏁 เสร็จแล้ว',
  cancelled:   '⛔ ยกเลิก',
};

type CanonicalStatus = 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'needs_update' | 'scheduled' | 'completed';

const STATUS_CHIP: Record<string, CanonicalStatus> = {
  pending:     'submitted',
  confirmed:   'scheduled',
  in_progress: 'under_review',
  completed:   'completed',
  cancelled:   'rejected',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: retrieve Supabase Bearer token from current browser session
// ─────────────────────────────────────────────────────────────────────────────
async function getBearerToken(): Promise<string | null> {
  const sb = tryCreateSupabaseBrowserClient();
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  return session?.access_token ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Thai date string
// ─────────────────────────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────
export function ServiceBookingMVP() {
  // ── Form state ─────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const [serviceType, setServiceType] = useState<ServiceType>('tractor');
  const [scheduledDate, setScheduledDate] = useState<string>('');
  const [note, setNote]                   = useState<string>('');
  const [submitting, setSubmitting]       = useState(false);
  const [submitError, setSubmitError]     = useState<string | null>(null);
  const [submitted, setSubmitted]         = useState<BookingRow | null>(null);

  // ── My bookings state ──────────────────────────────────────────────────────
  const [bookings, setBookings]           = useState<BookingRow[]>([]);
  const [loadingList, setLoadingList]     = useState(true);
  const [listError, setListError]         = useState<string | null>(null);

  // ── Load my bookings ───────────────────────────────────────────────────────
  const loadBookings = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const token = await getBearerToken();
      const res = await fetch('/api/member/service-booking', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.status === 401) {
        setListError('กรุณาเข้าสู่ระบบก่อนดูรายการจอง');
        setLoadingList(false);
        return;
      }
      const json = (await res.json()) as { bookings?: BookingRow[]; error?: string };
      if (!res.ok || json.error) {
        setListError(json.error ?? 'โหลดรายการไม่สำเร็จ');
      } else {
        setBookings(json.bookings ?? []);
      }
    } catch {
      setListError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
    setLoadingList(false);
  }, []);

  useEffect(() => { void loadBookings(); }, [loadBookings]);

  // ── Submit booking ─────────────────────────────────────────────────────────
  async function submitBooking() {
    if (!scheduledDate) {
      setSubmitError('กรุณาเลือกวันที่ต้องการใช้บริการ');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const token = await getBearerToken();
      const res = await fetch('/api/member/service-booking', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          service_type:   serviceType,
          scheduled_date: scheduledDate,
          note:           note.trim() || undefined,
        }),
      });

      const json = (await res.json()) as { ok?: boolean; booking?: BookingRow; error?: string };

      if (!res.ok || json.error) {
        setSubmitError(json.error ?? 'ส่งคำขอไม่สำเร็จ กรุณาลองใหม่');
      } else if (json.booking) {
        setSubmitted(json.booking);
        setNote('');
        setScheduledDate('');
        // Refresh list to include new booking
        void loadBookings();
      }
    } catch {
      setSubmitError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
    }
    setSubmitting(false);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Booking Form ── */}
      <FormSheet title="จองบริการเกษตร">
        {/* Service selector */}
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#6b7280' }}>
          เลือกบริการ → ระบุวันที่ → กรอกหมายเหตุ → ส่งคำขอ
        </p>

        <div className="service-booking__card-list" style={{ marginBottom: 16 }}>
          {SERVICE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="service-booking__slot"
              data-active={serviceType === opt.id}
              onClick={() => setServiceType(opt.id)}
              disabled={submitting}
            >
              <span style={{ fontWeight: 600 }}>{opt.label}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{opt.desc}</span>
            </button>
          ))}
        </div>

        {/* Date picker */}
        <label>
          วันที่ต้องการใช้บริการ
          <input
            type="date"
            value={scheduledDate}
            min={today}
            onChange={(e) => setScheduledDate(e.target.value)}
            disabled={submitting}
          />
        </label>

        {/* Note */}
        <label>
          หมายเหตุถึงผู้ให้บริการ <span style={{ fontSize: 12, color: '#9ca3af' }}>(ไม่บังคับ)</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น ที่อยู่แปลง จุดนัดหมาย ลักษณะพื้นที่"
            disabled={submitting}
          />
        </label>

        {submitError && (
          <div style={{
            background: '#fff3cd', border: '1px solid #ffc107',
            borderRadius: 8, padding: '10px 14px',
            color: '#856404', fontSize: 14, marginBottom: 8,
          }}>
            ⚠️ {submitError}
          </div>
        )}

        <UIButton
          fullWidth
          onClick={submitBooking}
          disabled={submitting || !scheduledDate}
        >
          {submitting ? 'กำลังส่งคำขอ…' : 'ส่งคำขอจองบริการ'}
        </UIButton>
      </FormSheet>

      {/* ── Success confirmation ── */}
      {submitted && (
        <FormSheet title="✅ ส่งคำขอสำเร็จ">
          <div style={{
            background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 10, padding: '14px 16px',
          }}>
            <p style={{ margin: '0 0 6px', fontWeight: 700 }}>
              {SERVICE_OPTIONS.find((o) => o.id === submitted.service_type)?.label}
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 13 }}>
              📅 วันที่: {fmtDate(submitted.scheduled_date)}
            </p>
            <p style={{ margin: '0 0 12px', fontSize: 13 }}>
              สถานะ: {STATUS_LABEL[submitted.status] ?? submitted.status}
            </p>
            <UIButton
              fullWidth
              onClick={() => setSubmitted(null)}
            >
              จองบริการเพิ่มเติม
            </UIButton>
          </div>
        </FormSheet>
      )}

      {/* ── My bookings list ── */}
      <FormSheet title="การจองของฉัน">
        {loadingList && <LoadingState label="กำลังโหลดรายการจอง…" />}

        {!loadingList && listError && (
          <ErrorState title="โหลดไม่สำเร็จ" detail={listError} />
        )}

        {!loadingList && !listError && bookings.length === 0 && (
          <EmptyState
            title="ยังไม่มีรายการจอง"
            detail="เมื่อส่งคำขอแล้ว รายการจะปรากฏที่นี่"
          />
        )}

        {!loadingList && !listError && bookings.length > 0 && (
          <div className="mobile-stack">
            {bookings.map((b) => (
              <article key={b.id} className="service-booking__card">
                <div className="service-booking__row">
                  <p className="service-booking__service" style={{ margin: 0 }}>
                    {SERVICE_OPTIONS.find((o) => o.id === b.service_type)?.label ?? b.service_type}
                  </p>
                  <StatusChip status={STATUS_CHIP[b.status] ?? 'pending'} />
                </div>
                <p className="service-booking__meta">
                  📅 {fmtDate(b.scheduled_date)}
                </p>
                <p className="service-booking__meta" style={{ color: '#6b7280', fontSize: 12 }}>
                  {STATUS_LABEL[b.status] ?? b.status}
                </p>
                {b.note && (
                  <p className="service-booking__meta" style={{ fontSize: 12 }}>
                    📝 {b.note}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </FormSheet>
    </>
  );
}

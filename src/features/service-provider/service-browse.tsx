'use client';

import { useEffect, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { UIButton }   from '@/shared/components/ui-button';
import { LoadingState } from '@/shared/components/loading-state';
import { EmptyState }   from '@/shared/components/empty-state';

// ─── Types ────────────────────────────────────────────────────────────────────

type Vehicle = {
  id: string; vehicle_type: string; brand: string | null;
  plate_number: string | null; description: string | null;
  price_amount: number | null; price_unit: string | null; price_note: string | null;
};

type Provider = {
  id: string; team_name: string; phone: string; line_id: string | null;
  description: string | null; provinces: string[]; rating_avg: number | null;
  rating_count: number;
  provider_vehicles: Vehicle[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_LABEL: Record<string, { icon: string; label: string }> = {
  harvester:   { icon: '🌾', label: 'รถเกี่ยว' },
  tractor:     { icon: '🚜', label: 'รถไถ' },
  transport:   { icon: '🚛', label: 'รถขนส่ง' },
  water_pump:  { icon: '💧', label: 'รถสูบน้ำ' },
  other:       { icon: '🔧', label: 'อื่นๆ' },
};

const PRICE_UNIT_LABEL: Record<string, string> = {
  per_rai:  'ไร่', per_hour: 'ชม.', per_trip: 'เที่ยว', per_km: 'กม.',
};

const S = {
  card: { background: '#fff', border: '1px solid var(--border,#d8e0db)', borderRadius: 14, overflow: 'hidden' } as React.CSSProperties,
  vehicleRow: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderTop: '1px solid var(--border,#d8e0db)' } as React.CSSProperties,
};

// ─── Booking Modal ─────────────────────────────────────────────────────────────

function BookingModal({
  vehicle, provider, onClose, memberId, plotId,
}: {
  vehicle: Vehicle; provider: Provider;
  onClose: () => void; memberId?: string; plotId?: string;
}) {
  const [date,     setDate]     = useState('');
  const [endDate,  setEndDate]  = useState('');
  const [areaRai,  setAreaRai]  = useState('');
  const [note,     setNote]     = useState('');
  const [saving,   setSaving]   = useState(false);
  const [notice,   setNotice]   = useState<string | null>(null);
  const [booked,   setBooked]   = useState(false);
  const v = VEHICLE_LABEL[vehicle.vehicle_type] ?? VEHICLE_LABEL.other;

  async function submit() {
    if (!date) { setNotice('กรุณาเลือกวันที่'); return; }
    setSaving(true);
    try {
      const sb = tryCreateSupabaseBrowserClient();
      const { data: { session } } = await sb!.auth.getSession();
      const token = session?.access_token;
      const res = await fetch('/api/member/service-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          service_type:        vehicle.vehicle_type,
          provider_id:         provider.id,
          provider_vehicle_id: vehicle.id,
          scheduled_date:      date,
          scheduled_end_date:  endDate || null,
          area_rai:            areaRai ? Number(areaRai) : null,
          plot_id:             plotId  || null,
          member_note:         note.trim() || null,
        }),
      });
      const d = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !d.ok) { setNotice(d.error ?? 'บันทึกไม่สำเร็จ'); setSaving(false); return; }
      setBooked(true);
    } catch { setNotice('ไม่สามารถเชื่อมต่อได้'); }
    setSaving(false);
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 999, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 20, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{v.icon} จอง{v.label}</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        {booked ? (
          <div style={{ textAlign: 'center', padding: '20px 0', display: 'grid', gap: 12 }}>
            <p style={{ fontSize: 40, margin: 0 }}>✅</p>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>ส่งคำขอแล้ว!</p>
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '14px 16px', textAlign: 'left' }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>📞 ติดต่อผู้ให้บริการ</p>
              <p style={{ margin: '6px 0 0', fontWeight: 800, fontSize: 22, color: '#14532d' }}>{provider.phone}</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{provider.team_name}</p>
              {provider.line_id && (
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#1d4ed8' }}>LINE: {provider.line_id}</p>
              )}
              <p style={{ margin: '10px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>
                โทรหาผู้ให้บริการเพื่อยืนยันวันเวลา ตกลงราคา และรายละเอียดงาน
              </p>
            </div>
            <UIButton fullWidth onClick={onClose}>ปิด</UIButton>
          </div>
        ) : (
          <>
            {/* Provider info */}
            <div style={{ background: '#f7f9f7', borderRadius: 10, padding: '10px 14px' }}>
              <p style={{ margin: 0, fontWeight: 700 }}>{provider.team_name}</p>
              {vehicle.brand && <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>{vehicle.brand} {vehicle.plate_number ? `· ${vehicle.plate_number}` : ''}</p>}
              {vehicle.price_amount && (
                <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>
                  ราคาอ้างอิง ~{vehicle.price_amount.toLocaleString()} บาท/{PRICE_UNIT_LABEL[vehicle.price_unit ?? ''] ?? vehicle.price_unit}
                  {vehicle.price_note && <span style={{ fontWeight: 400, color: '#6b7280' }}> ({vehicle.price_note})</span>}
                </p>
              )}
            </div>

            {notice && (
              <p style={{ margin: 0, padding: '8px 12px', background: '#fef2f2', borderRadius: 8, fontSize: 13, color: '#dc2626', border: '1px solid #fca5a5' }}>
                ⚠️ {notice}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                วันที่ต้องการ *
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                  style={{ padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14 }} />
              </label>
              <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
                ถึงวันที่
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  style={{ padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14 }} />
              </label>
            </div>

            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              พื้นที่ (ไร่)
              <input type="number" min="0" step="0.5" value={areaRai} onChange={(e) => setAreaRai(e.target.value)}
                placeholder="จำนวนไร่ที่ต้องการบริการ"
                style={{ padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14 }} />
            </label>

            <label style={{ display: 'grid', gap: 4, fontSize: 13, fontWeight: 600 }}>
              หมายเหตุ / รายละเอียดเพิ่มเติม
              <textarea value={note} onChange={(e) => setNote(e.target.value)}
                rows={2} placeholder="ที่อยู่แปลง เส้นทาง สิ่งที่ต้องการเพิ่มเติม…"
                style={{ padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
            </label>

            <UIButton fullWidth loading={saving} onClick={submit}>
              📋 ส่งคำขอจอง
            </UIButton>
            <p style={{ margin: 0, fontSize: 11, color: '#9ca3af', textAlign: 'center', lineHeight: 1.6 }}>
              หลังจากนี้ โทรติดต่อผู้ให้บริการโดยตรง เพื่อยืนยันและตกลงราคา
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Provider Card ─────────────────────────────────────────────────────────────

function ProviderCard({ provider, memberId, plotId }: { provider: Provider; memberId?: string; plotId?: string }) {
  const [expanded,       setExpanded]       = useState(false);
  const [bookingVehicle, setBookingVehicle] = useState<Vehicle | null>(null);

  return (
    <div style={S.card}>
      {/* Header */}
      <div style={{ padding: '14px 16px', display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>{provider.team_name}</p>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
              📍 {provider.provinces.join(' · ')}
            </p>
          </div>
          {provider.rating_avg != null && (
            <div style={{ textAlign: 'center', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: '#92400e' }}>
                ⭐ {provider.rating_avg.toFixed(1)}
              </p>
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>{provider.rating_count} รีวิว</p>
            </div>
          )}
        </div>

        {/* Vehicle type tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {[...new Set(provider.provider_vehicles.map((v) => v.vehicle_type))].map((t) => {
            const cfg = VEHICLE_LABEL[t] ?? VEHICLE_LABEL.other;
            return (
              <span key={t} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #86efac', color: '#14532d', fontWeight: 600 }}>
                {cfg.icon} {cfg.label}
              </span>
            );
          })}
          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1', fontWeight: 700 }}>
            📞 {provider.phone}
          </span>
        </div>

        {provider.description && (
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{provider.description}</p>
        )}

        <button onClick={() => setExpanded(!expanded)}
          style={{ background: 'none', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '7px', fontSize: 13, cursor: 'pointer', color: '#374151', fontWeight: 600 }}>
          {expanded ? '▲ ซ่อนรถ' : `▾ ดูรถทั้งหมด (${provider.provider_vehicles.length} คัน)`}
        </button>
      </div>

      {/* Vehicles */}
      {expanded && provider.provider_vehicles.map((v) => {
        const cfg = VEHICLE_LABEL[v.vehicle_type] ?? VEHICLE_LABEL.other;
        return (
          <div key={v.id} style={S.vehicleRow}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>{cfg.icon}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>
                {cfg.label} {v.brand ? `· ${v.brand}` : ''}
              </p>
              {v.plate_number && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>ทะเบียน {v.plate_number}</p>
              )}
              {v.description && (
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>{v.description}</p>
              )}
              {v.price_amount && (
                <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>
                  ~{v.price_amount.toLocaleString()} บาท/{PRICE_UNIT_LABEL[v.price_unit ?? ''] ?? v.price_unit}
                  {v.price_note && <span style={{ fontWeight: 400, color: '#9ca3af' }}> · {v.price_note}</span>}
                </p>
              )}
            </div>
            <button onClick={() => setBookingVehicle(v)}
              style={{ padding: '8px 14px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
              จอง
            </button>
          </div>
        );
      })}

      {bookingVehicle && (
        <BookingModal
          vehicle={bookingVehicle} provider={provider}
          memberId={memberId} plotId={plotId}
          onClose={() => setBookingVehicle(null)} />
      )}
    </div>
  );
}

// ─── Main: ServiceBrowse ───────────────────────────────────────────────────────

export function ServiceBrowse({ memberId, plotId }: { memberId?: string; plotId?: string }) {
  const [providers,  setProviders]  = useState<Provider[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [provFilter, setProvFilter] = useState('');

  useEffect(() => {
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) return;
    void (async () => {
      let q = sb
        .from('service_providers')
        .select('id,team_name,phone,line_id,description,provinces,rating_avg,rating_count,provider_vehicles(id,vehicle_type,brand,plate_number,description,price_amount,price_unit,price_note)')
        .eq('status', 'approved')
        .eq('provider_vehicles.is_active', true)
        .order('rating_avg', { ascending: false, nullsFirst: false });

      const { data } = await q;
      setProviders((data as Provider[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const allProvinces = [...new Set(providers.flatMap((p) => p.provinces))].sort();

  const filtered = providers.filter((p) => {
    const matchType = !typeFilter || p.provider_vehicles.some((v) => v.vehicle_type === typeFilter);
    const matchProv = !provFilter || p.provinces.includes(provFilter);
    return matchType && matchProv;
  });

  if (loading) return <LoadingState label="กำลังโหลดผู้ให้บริการ…" />;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          style={{ flex: 1, minWidth: 130, padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, background: '#fff' }}>
          <option value="">ทุกประเภท</option>
          {Object.entries(VEHICLE_LABEL).map(([v, cfg]) => (
            <option key={v} value={v}>{cfg.icon} {cfg.label}</option>
          ))}
        </select>
        <select value={provFilter} onChange={(e) => setProvFilter(e.target.value)}
          style={{ flex: 1, minWidth: 130, padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 9, fontSize: 13, background: '#fff' }}>
          <option value="">ทุกจังหวัด</option>
          {allProvinces.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
        พบ {filtered.length} ผู้ให้บริการ
      </p>

      {filtered.length === 0
        ? <EmptyState title="ไม่พบผู้ให้บริการ" />
        : filtered.map((p) => (
          <ProviderCard key={p.id} provider={p} memberId={memberId} plotId={plotId} />
        ))
      }
    </div>
  );
}

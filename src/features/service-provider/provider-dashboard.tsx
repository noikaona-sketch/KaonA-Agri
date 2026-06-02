'use client';

import { useEffect, useState } from 'react';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCurrentMember }               from '@/providers/auth-provider';
import { UIButton }     from '@/shared/components/ui-button';
import { LoadingState } from '@/shared/components/loading-state';

// ─── Types ────────────────────────────────────────────────────────────────────

type Vehicle = {
  id: string; vehicle_type: string; brand: string | null;
  plate_number: string | null; description: string | null; year: number | null;
  price_amount: number | null; price_unit: string | null; price_note: string | null;
  is_active: boolean;
};

type Booking = {
  id: string; scheduled_date: string; scheduled_end_date: string | null;
  area_rai: number | null; member_note: string | null; status: string; created_at: string;
  members: { full_name: string; phone: string | null }[] | null;
  provider_vehicles: { vehicle_type: string; brand: string | null } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VEHICLE_TYPES = [
  { v: 'harvester', l: '🌾 รถเกี่ยว' },
  { v: 'tractor',   l: '🚜 รถไถ' },
  { v: 'transport', l: '🚛 รถขนส่ง' },
  { v: 'water_pump',l: '💧 รถสูบน้ำ' },
  { v: 'other',     l: '🔧 อื่นๆ' },
];

const PRICE_UNITS = [
  { v: 'per_rai',  l: 'บาท/ไร่' },
  { v: 'per_hour', l: 'บาท/ชม.' },
  { v: 'per_trip', l: 'บาท/เที่ยว' },
  { v: 'per_km',   l: 'บาท/กม.' },
];

const STATUS_CFG: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#fffbeb', color: '#92400e', label: '⏳ รอยืนยัน' },
  confirmed: { bg: '#f0fdf4', color: '#14532d', label: '✅ ยืนยันแล้ว' },
  completed: { bg: '#e8f5e9', color: '#1b5e20', label: '🏁 เสร็จแล้ว' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280', label: '⛔ ยกเลิก' },
};

const S = {
  input: { padding: '9px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, width: '100%', background: '#fff' } as React.CSSProperties,
  label: { display: 'grid', gap: 4, fontSize: 13, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  section: { background: '#fff', border: '1px solid var(--border,#d8e0db)', borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 12 } as React.CSSProperties,
};

// ─── VehicleForm ──────────────────────────────────────────────────────────────

function VehicleForm({
  providerId, vehicle, onSaved, onCancel,
}: {
  providerId: string; vehicle?: Vehicle;
  onSaved: () => void; onCancel: () => void;
}) {
  const [type,      setType]      = useState(vehicle?.vehicle_type ?? 'harvester');
  const [brand,     setBrand]     = useState(vehicle?.brand ?? '');
  const [plate,     setPlate]     = useState(vehicle?.plate_number ?? '');
  const [year,      setYear]      = useState(vehicle?.year ? String(vehicle.year) : '');
  const [desc,      setDesc]      = useState(vehicle?.description ?? '');
  const [price,     setPrice]     = useState(vehicle?.price_amount ? String(vehicle.price_amount) : '');
  const [priceUnit, setPriceUnit] = useState(vehicle?.price_unit ?? 'per_rai');
  const [priceNote, setPriceNote] = useState(vehicle?.price_note ?? '');
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  async function save() {
    setSaving(true); setError(null);
    try {
      const sb = tryCreateSupabaseBrowserClient();
      const payload = {
        provider_id:  providerId,
        vehicle_type: type, brand: brand.trim() || null,
        plate_number: plate.trim() || null,
        year:         year ? Number(year) : null,
        description:  desc.trim() || null,
        price_amount: price ? Number(price) : null,
        price_unit:   price ? priceUnit : null,
        price_note:   priceNote.trim() || null,
      };
      if (vehicle?.id) {
        await sb!.from('provider_vehicles').update(payload).eq('id', vehicle.id);
      } else {
        await sb!.from('provider_vehicles').insert(payload);
      }
      onSaved();
    } catch (e) { setError(String(e)); }
    setSaving(false);
  }

  return (
    <div style={{ display: 'grid', gap: 12, padding: '12px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e5e7eb' }}>
      <p style={{ margin: 0, fontWeight: 700, fontSize: 13 }}>{vehicle ? '✏️ แก้ไขรถ' : '+ เพิ่มรถใหม่'}</p>

      {error && <p style={{ margin: 0, fontSize: 12, color: '#dc2626', background: '#fef2f2', padding: '7px 10px', borderRadius: 7 }}>⚠️ {error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <label style={S.label}>
          ประเภทรถ *
          <select style={S.input} value={type} onChange={(e) => setType(e.target.value)}>
            {VEHICLE_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
        </label>
        <label style={S.label}>
          ยี่ห้อ/รุ่น
          <input style={S.input} value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="เช่น Kubota M110" />
        </label>
        <label style={S.label}>
          ทะเบียนรถ
          <input style={S.input} value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="กข 1234" />
        </label>
        <label style={S.label}>
          ปี (พ.ศ.)
          <input style={S.input} type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2565" />
        </label>
      </div>

      <label style={S.label}>
        รายละเอียด/อุปกรณ์เสริม
        <input style={S.input} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="เช่น มีใบมีดสับตอซัง รับงานกลางคืนได้" />
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <label style={{ ...S.label, gridColumn: '1' }}>
          ราคาอ้างอิง (บาท)
          <input style={S.input} type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="เช่น 400" />
        </label>
        <label style={S.label}>
          หน่วย
          <select style={S.input} value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)}>
            {PRICE_UNITS.map((u) => <option key={u.v} value={u.v}>{u.l}</option>)}
          </select>
        </label>
        <label style={S.label}>
          หมายเหตุราคา
          <input style={S.input} value={priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder="รวมน้ำมัน" />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: 13 }}>ยกเลิก</button>
        <button onClick={save} disabled={saving}
          style={{ flex: 2, padding: '9px', borderRadius: 8, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'wait' : 'pointer' }}>
          {saving ? '⏳…' : vehicle ? '💾 บันทึก' : '+ เพิ่มรถ'}
        </button>
      </div>
    </div>
  );
}

// ─── Main: ProviderDashboard ──────────────────────────────────────────────────

export function ProviderDashboard() {
  const member = useCurrentMember();
  const [provider,   setProvider]   = useState<{ id: string; team_name: string; phone: string; status: string } | null>(null);
  const [vehicles,   setVehicles]   = useState<Vehicle[]>([]);
  const [bookings,   setBookings]   = useState<Booking[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showVForm,  setShowVForm]  = useState(false);
  const [editV,      setEditV]      = useState<Vehicle | null>(null);
  const [tab,        setTab]        = useState<'vehicles'|'bookings'>('bookings');

  async function load() {
    if (!member?.member_id) return;
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) return;
    setLoading(true);

    const { data: prov } = await sb.from('service_providers')
      .select('id,team_name,phone,status')
      .eq('member_id', member.member_id).maybeSingle();
    setProvider(prov as typeof provider);

    if (prov?.id) {
      const [vRes, bRes] = await Promise.all([
        sb.from('provider_vehicles').select('*').eq('provider_id', prov.id).order('created_at'),
        sb.from('service_bookings')
          .select('id,scheduled_date,scheduled_end_date,area_rai,member_note,status,created_at,members:member_id(full_name,phone),provider_vehicles(vehicle_type,brand)')
          .eq('provider_id', prov.id)
          .order('scheduled_date', { ascending: false })
          .limit(50),
      ]);
      setVehicles((vRes.data as Vehicle[]) ?? []);
      setBookings((bRes.data as Booking[]) ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [member?.member_id]);

  if (loading) return <LoadingState label="กำลังโหลด…" />;

  if (!provider) return (
    <div style={{ textAlign: 'center', padding: '32px 16px', display: 'grid', gap: 12 }}>
      <p style={{ fontSize: 36, margin: 0 }}>🚜</p>
      <p style={{ margin: 0, fontWeight: 700 }}>ยังไม่ได้สมัครเป็นผู้ให้บริการ</p>
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>สมัครผ่านเมนู "สมัครผู้ให้บริการ" หรือติดต่อ admin</p>
    </div>
  );

  const pendingBookings = bookings.filter((b) => b.status === 'pending').length;

  return (
    <div style={{ display: 'grid', gap: 14 }}>

      {/* Provider status */}
      <div style={{ ...S.section, background: provider.status === 'approved' ? '#f0fdf4' : '#fffbeb', borderColor: provider.status === 'approved' ? '#86efac' : '#fde68a' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 16 }}>{provider.team_name}</p>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>📞 {provider.phone}</p>
          </div>
          <span style={{ fontSize: 12, padding: '4px 10px', borderRadius: 20, background: provider.status === 'approved' ? '#2e7d32' : '#f59e0b', color: '#fff', fontWeight: 700 }}>
            {provider.status === 'approved' ? '✅ อนุมัติแล้ว' : '⏳ รอ admin อนุมัติ'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div style={{ background: '#fff', borderRadius: 9, padding: '10px', textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{vehicles.filter((v) => v.is_active).length}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>รถที่ active</p>
          </div>
          <div style={{ background: '#fff', borderRadius: 9, padding: '10px', textAlign: 'center', position: 'relative' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: pendingBookings > 0 ? '#d97706' : '#1a1f1c' }}>{pendingBookings}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>รอตอบรับ</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 10, padding: 4, gap: 4 }}>
        {(['bookings','vehicles'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
              background: tab === t ? '#fff' : 'transparent',
              color: tab === t ? '#14532d' : '#6b7280',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
            }}>
            {t === 'bookings' ? `📋 คำขอจอง${pendingBookings > 0 ? ` (${pendingBookings})` : ''}` : '🚜 รถของฉัน'}
          </button>
        ))}
      </div>

      {/* Vehicles tab */}
      {tab === 'vehicles' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {!showVForm && !editV && (
            <UIButton fullWidth onClick={() => setShowVForm(true)}>+ เพิ่มรถใหม่</UIButton>
          )}
          {(showVForm || editV) && (
            <VehicleForm
              providerId={provider.id}
              vehicle={editV ?? undefined}
              onSaved={() => { setShowVForm(false); setEditV(null); void load(); }}
              onCancel={() => { setShowVForm(false); setEditV(null); }} />
          )}
          {vehicles.map((v) => {
            const cfg = VEHICLE_TYPES.find((t) => t.v === v.vehicle_type);
            return (
              <div key={v.id} style={{ ...S.section, opacity: v.is_active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{cfg?.l ?? v.vehicle_type} {v.brand ? `· ${v.brand}` : ''}</p>
                    {v.plate_number && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#6b7280' }}>ทะเบียน {v.plate_number}</p>}
                    {v.price_amount && <p style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: '#2e7d32' }}>~{v.price_amount.toLocaleString()} บาท/{v.price_unit}</p>}
                  </div>
                  <button onClick={() => setEditV(v)}
                    style={{ padding: '5px 10px', borderRadius: 7, border: '1.5px solid #e5e7eb', background: '#fff', fontSize: 12, cursor: 'pointer' }}>✏️</button>
                </div>
                {v.description && <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>{v.description}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Bookings tab */}
      {tab === 'bookings' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {bookings.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
              <p style={{ fontSize: 28, margin: '0 0 8px' }}>📋</p>
              <p style={{ margin: 0, fontSize: 13 }}>ยังไม่มีคำขอจอง</p>
            </div>
          )}
          {bookings.map((b) => {
            const st = STATUS_CFG[b.status] ?? STATUS_CFG.pending;
            const farmer = Array.isArray(b.members) ? b.members[0] : (b.members as { full_name: string; phone: string | null } | null);
            return (
              <div key={b.id} style={{ ...S.section, borderLeft: `3px solid ${st.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>{farmer?.full_name ?? '—'}</p>
                    {farmer?.phone && (
                      <a href={`tel:${farmer.phone}`} style={{ fontSize: 13, color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>
                        📞 {farmer.phone}
                      </a>
                    )}
                    <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                      📅 {b.scheduled_date}{b.scheduled_end_date ? ` → ${b.scheduled_end_date}` : ''}
                      {b.area_rai ? ` · ${b.area_rai} ไร่` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    {st.label}
                  </span>
                </div>
                {b.member_note && (
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280', background: '#f9fafb', borderRadius: 7, padding: '7px 10px' }}>
                    💬 {b.member_note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

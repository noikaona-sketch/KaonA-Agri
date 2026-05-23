'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter }                         from 'next/navigation';
import { createSupabaseBrowserClient }       from '@/lib/supabase/client';

type BookingRow = {
  id: string; member_id: string; scheduled_date: string; status: string;
  drying_preference: string | null; estimated_tonnage: number | null;
  estimated_moisture: number | null; intake_location_id: string | null;
  members: { full_name: string; phone: string | null } | null;
};
type QuotaRow = {
  capacity_kg_dryer: number | null; capacity_kg_dry: number | null;
  booked_kg_dryer: number; booked_kg_dry: number;
};

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  planned:   { color:'#1d4ed8', bg:'#eff6ff', label:'รอยืนยัน' },
  confirmed: { color:'#059669', bg:'#f0fdf4', label:'ยืนยันแล้ว' },
  completed: { color:'#6b7280', bg:'#f9fafb', label:'เสร็จแล้ว' },
  rejected:  { color:'#dc2626', bg:'#fef2f2', label:'ปฏิเสธ' },
};
const fmt = (n: number | null) => n == null ? '—' : (n/1000).toFixed(1);

function QuotaBar({ label, booked, cap, color }: { label: string; booked: number; cap: number | null; color: string }) {
  if (!cap) return <p style={{ fontSize:12, color:'#9ca3af' }}>{label}: ไม่จำกัด</p>;
  const pct = Math.min(100, Math.round((booked / cap) * 100));
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
        <span style={{ fontSize:11, color:'#6b7280' }}>{label}</span>
        <span style={{ fontSize:11, fontWeight:600, color: pct>=90?'#dc2626':pct>=70?'#d97706':color }}>{fmt(booked)}/{fmt(cap)} ต. ({pct}%)</span>
      </div>
      <div style={{ height:6, background:'#e5e7eb', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', width:`${pct}%`, background:pct>=90?'#dc2626':pct>=70?'#f59e0b':color, borderRadius:99 }}/>
      </div>
    </div>
  );
}

export function IntakeQueueBoard({ locationId, date }: { locationId: string; date?: string }) {
  const router   = useRouter();
  const today    = date ?? new Date().toISOString().slice(0, 10);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [quota,    setQuota]    = useState<QuotaRow | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(async () => {
    const s = createSupabaseBrowserClient();
    const [bRes, qRes] = await Promise.all([
      s.from('harvest_bookings')
        .select('id,member_id,scheduled_date,status,drying_preference,estimated_tonnage,estimated_moisture,intake_location_id,members(full_name,phone)')
        .eq('scheduled_date', today)
        .eq('intake_location_id', locationId)
        .not('status', 'in', '("cancelled")')
        .order('status').order('created_at'),

      s.from('pickup_slots')
        .select('capacity_kg_dryer,capacity_kg_dry,booked_kg_dryer,booked_kg_dry')
        .eq('location_id', locationId).eq('pickup_date', today)
        .maybeSingle(),
    ]);
    setBookings((bRes.data ?? []) as unknown as BookingRow[]);
    setQuota(qRes.data as QuotaRow | null);
    setLastRefresh(new Date());
    setLoading(false);
  }, [locationId, today]);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 60_000); // refresh ทุก 60 วิ
    return () => clearInterval(interval);
  }, [load]);

  const pending   = bookings.filter(b => b.status === 'planned' || b.status === 'confirmed');
  const completed = bookings.filter(b => b.status === 'completed');
  const totalEstKg = pending.reduce((s, b) => s + (b.estimated_tonnage ?? 0) * 1000, 0);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Quota bars */}
      {quota && (
        <div className="kaona-card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <p style={{ margin:0, fontWeight:600, fontSize:13 }}>📊 โควต้าวันนี้</p>
            <button onClick={load} style={{ background:'none', border:'none', cursor:'pointer', fontSize:12, color:'#6b7280' }}>🔄 {lastRefresh.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' })}</button>
          </div>
          <QuotaBar label="💧 เข้าอบ"   booked={quota.booked_kg_dryer} cap={quota.capacity_kg_dryer} color="#2563eb" />
          <QuotaBar label="🌾 ขายแห้ง" booked={quota.booked_kg_dry}   cap={quota.capacity_kg_dry}   color="#059669" />
          {totalEstKg > 0 && <p style={{ margin:'6px 0 0', fontSize:11, color:'#6b7280' }}>รอรับอีกประมาณ {fmt(totalEstKg)} ตัน ({pending.length} คิว)</p>}
        </div>
      )}

      {/* Queue list */}
      <div className="kaona-card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <p style={{ margin:0, fontWeight:600, fontSize:13 }}>📋 คิวรับซื้อ ({pending.length} คิว)</p>
          <span style={{ fontSize:11, color:'#6b7280' }}>เสร็จแล้ว {completed.length}</span>
        </div>

        {loading && <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:16 }}>กำลังโหลด…</p>}
        {!loading && pending.length === 0 && (
          <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:16 }}>ไม่มีคิวรอรับ</p>
        )}

        {pending.map((b, i) => {
          const cfg = STATUS_CFG[b.status] ?? STATUS_CFG.planned;
          return (
            <div key={b.id} style={{ display:'flex', gap:10, alignItems:'flex-start', padding:'10px 0', borderBottom: i < pending.length-1 ? '0.5px solid #f0f4f0' : 'none' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:cfg.bg, color:cfg.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, flexShrink:0 }}>
                {i + 1}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ margin:'0 0 2px', fontWeight:600, fontSize:13 }}>{(b.members as { full_name: string } | null)?.full_name ?? '—'}</p>
                <p style={{ margin:'0 0 4px', fontSize:11, color:'#6b7280' }}>
                  {(b.members as { phone: string | null } | null)?.phone ?? '—'}
                  {b.estimated_tonnage && ` · ~${b.estimated_tonnage} ตัน`}
                  {b.estimated_moisture && ` · ${b.estimated_moisture}%`}
                  {b.drying_preference === 'required' && ' · 💧 เข้าอบ'}
                </p>
                <span style={{ fontSize:10, padding:'2px 7px', borderRadius:8, background:cfg.bg, color:cfg.color, fontWeight:500 }}>{cfg.label}</span>
              </div>
              <button
                className="admin-btn admin-btn--primary"
                onClick={() => router.push(`/harvest/intake?booking_id=${b.id}&member_id=${b.member_id}`)}
                style={{ fontSize:12, padding:'5px 12px', flexShrink:0 }}>
                กรอกผล
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

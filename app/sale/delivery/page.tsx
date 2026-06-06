'use client';
// หน้านัดขาย + timeline สถานะการส่ง
// สมาชิกนัดวัน → กด "ออกแล้ว" → "ถึงแล้ว" → รับคิว → จบ

import { useEffect, useState }    from 'react';
import { useAuth, useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell }         from '@/shared/components/mobile-app-shell';
import { LoadingState }           from '@/shared/components/loading-state';
import { ProtectedRoute }         from '@/shared/components/protected-route';
import { getAuthHeaders }         from '@/lib/auth/get-auth-headers';

type Appointment = {
  id: string; appointment_number: string; status: string;
  appointment_date: string; estimated_qty_kg: number;
  truck_plate: string | null; estimated_trucks: number | null;
  estimated_arrival: string | null; price_per_kg: number | null;
  departure_at: string | null; arrived_at: string | null;
  queue_number: string | null; queued_at: string | null;
  weighing_at: string | null; billed_at: string | null;
  actual_qty_kg: number | null; actual_total: number | null;
  bill_number: string | null; delivery_note: string | null;
  planting_cycles: { crop_name: string; plots: { name: string } | null } | null;
};

const STATUS_STEPS = [
  { key: 'confirmed',  icon: '📅', label: 'ยืนยันนัด' },
  { key: 'departed',   icon: '🚛', label: 'ออกเดินทาง' },
  { key: 'arrived',    icon: '📍', label: 'ถึงโรงงาน' },
  { key: 'queued',     icon: '🎫', label: 'รับคิว' },
  { key: 'weighing',   icon: '⚖️', label: 'ลงของ' },
  { key: 'billed',     icon: '🧾', label: 'ออกบิล' },
];

const STATUS_ORDER = ['pending','confirmed','departed','arrived','queued','weighing','billed'];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('th-TH', { weekday:'short', day:'numeric', month:'short' });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
}
function fmtMoney(n: number) {
  return n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
}

// ── Timeline strip ─────────────────────────────────────────────────────────────
function TimelineStrip({ appt }: { appt: Appointment }) {
  const curIdx = STATUS_ORDER.indexOf(appt.status);
  return (
    <div style={{ display:'flex', gap:0, overflowX:'auto', padding:'8px 0 4px' }}>
      {STATUS_STEPS.map((s, i) => {
        const done    = STATUS_ORDER.indexOf(s.key) <= curIdx;
        const current = s.key === appt.status;
        return (
          <div key={s.key} style={{ display:'flex', alignItems:'center', flexShrink:0 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:52 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', background:done?'#1b5e20':current?'#e8f5e9':'#f3f4f6', border:`2px solid ${done||current?'#2e7d32':'#e5e7eb'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                {done ? (current ? s.icon : '✅') : s.icon}
              </div>
              <p style={{ margin:0, fontSize:9, color:done?'#1b5e20':'#9ca3af', fontWeight:done?700:400, textAlign:'center', lineHeight:1.2 }}>{s.label}</p>
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div style={{ width:16, height:2, background: STATUS_ORDER.indexOf(STATUS_STEPS[i+1].key) <= curIdx ? '#2e7d32':'#e5e7eb', flexShrink:0, marginBottom:14 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Action button based on current status ─────────────────────────────────────
function ActionButton({ appt, onUpdate }: { appt: Appointment; onUpdate: (id: string, status: string, extra?: Record<string,unknown>) => Promise<void> }) {
  const [loading, setLoading] = useState(false);
  const [queue, setQueue]     = useState('');

  async function act(status: string, extra?: Record<string,unknown>) {
    setLoading(true);
    await onUpdate(appt.id, status, extra);
    setLoading(false);
  }

  if (appt.status === 'confirmed' || appt.status === 'pending') return (
    <button onClick={() => act('departed', { departure_at: new Date().toISOString() })} disabled={loading}
      style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'#1b5e20', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>
      {loading ? '⏳…' : '🚛 ออกเดินทางแล้ว'}
    </button>
  );

  if (appt.status === 'departed') return (
    <button onClick={() => act('arrived', { arrived_at: new Date().toISOString() })} disabled={loading}
      style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'#185FA5', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>
      {loading ? '⏳…' : '📍 ถึงโรงงานแล้ว'}
    </button>
  );

  if (appt.status === 'arrived') return (
    <div style={{ display:'flex', gap:8 }}>
      <input value={queue} onChange={e => setQueue(e.target.value)} placeholder="หมายเลขคิว เช่น A-12"
        style={{ flex:1, padding:'10px 12px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:14, fontFamily:'inherit' }} />
      <button onClick={() => act('queued', { queue_number: queue || null, queued_at: new Date().toISOString() })} disabled={loading || !queue}
        style={{ padding:'10px 18px', borderRadius:10, border:'none', background:queue?'#d97706':'#e5e7eb', color:queue?'#fff':'#9ca3af', fontSize:14, fontWeight:800, cursor:queue?'pointer':'not-allowed' }}>
        {loading ? '…' : '🎫 รับคิว'}
      </button>
    </div>
  );

  if (appt.status === 'queued') return (
    <button onClick={() => act('weighing', { weighing_at: new Date().toISOString() })} disabled={loading}
      style={{ width:'100%', padding:'13px', borderRadius:12, border:'none', background:'#7c3aed', color:'#fff', fontSize:14, fontWeight:800, cursor:'pointer' }}>
      {loading ? '⏳…' : '⚖️ เริ่มลงของแล้ว'}
    </button>
  );

  if (appt.status === 'billed') return (
    <div style={{ padding:'12px', borderRadius:12, background:'#f0fdf4', border:'1px solid #86efac', textAlign:'center' }}>
      <p style={{ margin:0, fontSize:15, fontWeight:800, color:'#1b5e20' }}>🧾 เสร็จสิ้น</p>
      {appt.actual_qty_kg && <p style={{ margin:'4px 0 0', fontSize:13, color:'#166534' }}>น้ำหนักจริง {appt.actual_qty_kg.toLocaleString()} กก. · ยอด {fmtMoney(appt.actual_total ?? 0)} บ.</p>}
      {appt.bill_number   && <p style={{ margin:'2px 0 0', fontSize:12, color:'#9ca3af' }}>เลขบิล {appt.bill_number}</p>}
    </div>
  );

  return null;
}

// ── Appointment card ───────────────────────────────────────────────────────────
function ApptCard({ appt, onUpdate }: { appt: Appointment; onUpdate: (id: string, status: string, extra?: Record<string,unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(appt.status !== 'billed');
  const crop = appt.planting_cycles?.crop_name ?? '—';
  const plot = appt.planting_cycles?.plots?.name ?? '';

  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, overflow:'hidden' }}>
      {/* Header */}
      <button onClick={() => setOpen(o => !o)} style={{ width:'100%', padding:'12px 16px', background:'none', border:'none', cursor:'pointer', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p style={{ margin:0, fontWeight:800, fontSize:14 }}>{appt.appointment_number}</p>
          <p style={{ margin:'2px 0 0', fontSize:12, color:'#6b7280' }}>
            📅 {fmtDate(appt.appointment_date)} · {crop}{plot ? ` · แปลง${plot}` : ''}
          </p>
          {appt.truck_plate && <p style={{ margin:'2px 0 0', fontSize:12, color:'#374151', fontWeight:600 }}>🚛 {appt.truck_plate}{appt.estimated_arrival ? ` · คาดถึง ${appt.estimated_arrival.slice(0,5)} น.` : ''}</p>}
        </div>
        <div style={{ textAlign:'right' }}>
          <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, background: appt.status==='billed'?'#e8f5e9':appt.status==='departed'||appt.status==='arrived'?'#eff6ff':'#f3f4f6', color:appt.status==='billed'?'#1b5e20':appt.status==='departed'||appt.status==='arrived'?'#1d4ed8':'#374151', fontWeight:700 }}>
            {STATUS_STEPS.find(s => s.key === appt.status)?.label ?? appt.status}
          </span>
          <p style={{ margin:'4px 0 0', fontSize:11, color:'#9ca3af' }}>{open ? '▲' : '▼'}</p>
        </div>
      </button>

      {open && (
        <div style={{ padding:'0 16px 14px', display:'flex', flexDirection:'column', gap:10 }}>
          {/* Timeline */}
          <TimelineStrip appt={appt} />

          {/* Timestamps */}
          {appt.departure_at && (
            <div style={{ fontSize:12, color:'#6b7280', display:'flex', flexDirection:'column', gap:3 }}>
              {appt.departure_at && <span>🚛 ออกเดินทาง {fmtTime(appt.departure_at)}</span>}
              {appt.arrived_at   && <span>📍 ถึงโรงงาน {fmtTime(appt.arrived_at)}</span>}
              {appt.queued_at    && <span>🎫 รับคิว #{appt.queue_number} เวลา {fmtTime(appt.queued_at)}</span>}
              {appt.weighing_at  && <span>⚖️ เริ่มลงของ {fmtTime(appt.weighing_at)}</span>}
              {appt.billed_at    && <span>🧾 ออกบิล {fmtTime(appt.billed_at)}</span>}
            </div>
          )}

          {/* Summary (before billed) */}
          {appt.status !== 'billed' && (
            <div style={{ padding:'8px 10px', borderRadius:10, background:'#f8fafc', border:'1px solid #e5e7eb', fontSize:12, color:'#374151' }}>
              <span>📦 คาด {(appt.estimated_qty_kg/1000).toFixed(1)} ตัน</span>
              {appt.price_per_kg && <span style={{ marginLeft:10 }}>💰 {appt.price_per_kg} บ./กก.</span>}
              {appt.price_per_kg && <span style={{ marginLeft:10 }}>≈ {fmtMoney(appt.estimated_qty_kg * appt.price_per_kg)} บ.</span>}
            </div>
          )}

          {/* Action button */}
          <ActionButton appt={appt} onUpdate={onUpdate} />
        </div>
      )}
    </div>
  );
}

// ── New appointment form ───────────────────────────────────────────────────────
function NewApptForm({ member, onSaved, onCancel }: {
  member: ReturnType<typeof useCurrentMember>;
  onSaved: (a: Appointment) => void;
  onCancel: () => void;
}) {
  const [cycles,    setCycles]    = useState<{ id:string; crop_name:string; plots:{name:string}|null }[]>([]);
  const [cycleId,   setCycleId]   = useState('');
  const [date,      setDate]      = useState('');
  const [trucks,    setTrucks]    = useState('1');
  const [plate,     setPlate]     = useState('');
  const [arrival,   setArrival]   = useState('');
  const [qtyKg,     setQtyKg]     = useState('');
  const [note,      setNote]      = useState('');
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState<string|null>(null);

  useEffect(() => {
    if (!member) return;
    void getAuthHeaders(member, '/api/member/planting-cycles?status=growing,confirmed,maturing').then(({ headers, url }) =>
      fetch(url, { headers }).then(r => r.json()).then((d: { cycles?: typeof cycles }) => setCycles(d.cycles ?? []))
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.member_id]);

  const INP = { padding:'10px 13px', border:'1.5px solid #e5e7eb', borderRadius:10, fontSize:14, width:'100%', boxSizing:'border-box' as const, fontFamily:'inherit' };

  async function submit() {
    if (!cycleId || !date || !qtyKg) { setErr('กรุณากรอกข้อมูลให้ครบ'); return; }
    setSaving(true); setErr(null);
    const { headers, url } = await getAuthHeaders(member!, '/api/member/sale-appointment');
    const res = await fetch(url, {
      method:'POST', headers:{ ...headers, 'Content-Type':'application/json' },
      body: JSON.stringify({
        planting_cycle_id:  cycleId,
        appointment_date:     date,
        estimated_qty_kg:   Number(qtyKg),
        estimated_trucks:   Number(trucks) || 1,
        truck_plate:        plate || null,
        estimated_arrival:  arrival || null,
        note:               note || null,
      }),
    });
    const d = (await res.json()) as { ok?:boolean; error?:string } & Appointment;
    setSaving(false);
    if (!res.ok) { setErr(d.error ?? 'นัดไม่สำเร็จ'); return; }
    onSaved(d as Appointment);
  }

  return (
    <div style={{ background:'#fff', borderRadius:14, overflow:'hidden', border:'1px solid #e5e7eb' }}>
      <div style={{ background:'linear-gradient(135deg,#1b5e20,#2e7d32)', padding:'14px 18px' }}>
        <p style={{ margin:0, fontSize:13, color:'#a7f3d0' }}>สมาชิก</p>
        <p style={{ margin:'2px 0 0', fontWeight:900, fontSize:17, color:'#fff' }}>📅 นัดวันขาย</p>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>

        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:13 }}>รอบปลูก *</p>
          <select value={cycleId} onChange={e => setCycleId(e.target.value)} style={{ ...INP }}>
            <option value="">-- เลือกรอบปลูก --</option>
            {cycles.map(c => (
              <option key={c.id} value={c.id}>{c.crop_name}{c.plots ? ` · แปลง${c.plots.name}` : ''}</option>
            ))}
          </select>
        </div>

        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:13 }}>วันที่ขาย *</p>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={INP} />
            </div>
            <div>
              <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:13 }}>เวลาคาดว่าถึง</p>
              <input type="time" value={arrival} onChange={e => setArrival(e.target.value)} style={INP} />
            </div>
          </div>
        </div>

        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:10 }}>
            <div>
              <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:13 }}>ทะเบียนรถ</p>
              <input value={plate} onChange={e => setPlate(e.target.value)} placeholder="เช่น กข-1234 อบ" style={INP} />
            </div>
            <div>
              <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:13 }}>จำนวนคัน</p>
              <input type="number" min="1" max="10" value={trucks} onChange={e => setTrucks(e.target.value)} style={INP} />
            </div>
          </div>
        </div>

        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:13 }}>น้ำหนักที่คาด (กก.) *</p>
          <input type="number" value={qtyKg} onChange={e => setQtyKg(e.target.value)} placeholder="เช่น 15000" style={INP} />
        </div>

        <div style={{ padding:'14px 16px', borderBottom:'1px solid #f3f4f6' }}>
          <p style={{ margin:'0 0 6px', fontWeight:700, fontSize:13 }}>หมายเหตุ</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            style={{ ...INP, resize:'vertical' }} placeholder="สภาพแปลง จุดนัดรับ…" />
        </div>

        {err && <p style={{ margin:'0 16px', padding:'8px 12px', borderRadius:8, background:'#fff1f2', color:'#9f1239', fontSize:13 }}>{err}</p>}

        <div style={{ padding:'14px 16px', display:'flex', gap:10 }}>
          <button onClick={onCancel} style={{ flex:1, padding:'12px', borderRadius:12, border:'1px solid #e5e7eb', background:'#fff', fontSize:14, cursor:'pointer' }}>ยกเลิก</button>
          <button onClick={submit} disabled={saving}
            style={{ flex:2, padding:'12px', borderRadius:12, border:'none', background:saving?'#e5e7eb':'#1b5e20', color:saving?'#9ca3af':'#fff', fontSize:14, fontWeight:800, cursor:saving?'not-allowed':'pointer' }}>
            {saving ? '⏳…' : '📅 ยืนยันนัดขาย'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
function DeliveryContent() {
  const { status } = useAuth();
  const member     = useCurrentMember();
  const [appts,    setAppts]    = useState<Appointment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);

  async function loadAppts() {
    if (!member) return;
    const { headers, url } = await getAuthHeaders(member, '/api/member/sale-appointment');
    const res  = await fetch(url, { headers });
    const data = (await res.json()) as { appointments?: Appointment[] };
    setAppts(data.appointments ?? []);
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void loadAppts(); }, [member?.member_id]);

  async function updateStatus(id: string, status: string, extra?: Record<string,unknown>) {
    if (!member) return;
    const { headers, url } = await getAuthHeaders(member, '/api/member/sale-appointment');
    await fetch(url, {
      method:'PATCH', headers:{ ...headers, 'Content-Type':'application/json' },
      body: JSON.stringify({ id, status, ...extra }),
    });
    await loadAppts();
  }

  if (status === 'loading' || loading) return <LoadingState label="กำลังโหลด…" />;

  // แยก active vs done
  const active = appts.filter(a => !['billed','cancelled'].includes(a.status));
  const done   = appts.filter(a =>  ['billed','cancelled'].includes(a.status));

  return (
    <div className="mobile-stack" style={{ paddingBottom:24 }}>
      {showNew ? (
        <NewApptForm member={member} onSaved={a => { setAppts(prev => [a, ...prev]); setShowNew(false); }} onCancel={() => setShowNew(false)} />
      ) : (
        <button onClick={() => setShowNew(true)}
          style={{ width:'100%', padding:'14px', borderRadius:14, border:'none', background:'#1b5e20', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer' }}>
          📅 + นัดวันขายใหม่
        </button>
      )}

      {active.length > 0 && (
        <>
          <p style={{ margin:'4px 0', fontWeight:700, fontSize:14 }}>การนัดหมายที่ใช้งาน ({active.length})</p>
          {active.map(a => <ApptCard key={a.id} appt={a} onUpdate={updateStatus} />)}
        </>
      )}

      {done.length > 0 && (
        <>
          <p style={{ margin:'4px 0', fontWeight:700, fontSize:14, color:'#9ca3af' }}>ประวัติ ({done.length})</p>
          {done.map(a => <ApptCard key={a.id} appt={a} onUpdate={updateStatus} />)}
        </>
      )}

      {appts.length === 0 && !showNew && (
        <div style={{ textAlign:'center', padding:'40px 0', color:'#9ca3af' }}>
          <p style={{ fontSize:40, margin:'0 0 8px' }}>🚛</p>
          <p style={{ fontSize:14 }}>ยังไม่มีการนัดขาย</p>
        </div>
      )}
    </div>
  );
}

export default function SaleDeliveryPage() {
  return (
    <ProtectedRoute allowedRoles={['farmer','leader','admin','staff']}>
      <MobileAppShell title="🚛 นัดวันขาย" subtitle="ติดตามสถานะการส่งสินค้า">
        <DeliveryContent />
      </MobileAppShell>
    </ProtectedRoute>
  );
}


'use client';

import { useEffect, useState, useCallback } from 'react';
import { AdminWebShell } from '@/shared/components/admin-web-shell';

// ── Types ─────────────────────────────────────────────────────────────────────
type Metrics = {
  total_members:number; approved_members:number;
  total_plots:number; total_cycles:number;
  total_bookings:number; completed_intakes:number;
  total_noburn:number; approved_noburn:number;
  total_inspect:number; done_inspect:number;
  total_products:number; open_slots:number;
  total_vehicles:number; active_campaigns:number;
};
type Activity = Record<string,boolean>;
type ApiData  = { as_of:string; metrics:Metrics; activity:Activity };

type System = {
  id:string; icon:string; label:string;
  pct:(m:Metrics,a:Activity)=>number;    // คำนวณ % จาก metrics จริง
  target:number; pilotBlock:boolean; phase2?:boolean;
  color:string; bg:string;
  roles:string[];
  done:string[]; todo:string[];
  tables:string[]; connects:string[];
  codex:string[]; pavee:string[];
  liveStats:(m:Metrics)=>{ label:string; value:string }[];
};

// ── System definitions ────────────────────────────────────────────────────────
const SYSTEMS: System[] = [
  {
    id:"member", icon:"👥", label:"ระบบสมาชิก",
    pct:(m,a) => {
      let s = 60;
      if (a.member_active) s += 10;
      if (m.approved_members >= 5) s += 10;
      if (m.approved_members >= 20) s += 5;
      return Math.min(95, s);
    },
    target:90, pilotBlock:true, color:"#059669", bg:"#ECFDF5",
    roles:["farmer","staff","admin"],
    done:["สมัครผ่าน LINE LIFF","Admin approve/reject","LINE แจ้งผล ✅","Import CSV + review","Onboarding checklist 4 ขั้น","กลุ่มสมาชิก","RLS API layer verified"],
    todo:["ทดสอบ RLS กับ user จริง (Pavee)","UAT script (Codex Z1-2)","Admin manual (Codex Z1-4)"],
    tables:["members","member_roles","member_groups","approvals"],
    connects:["plot","harvest","noburn","comms","report"],
    codex:["Z1-2","Z1-4"], pavee:["Z0-4 RLS test"],
    liveStats: m => [
      { label:"สมาชิกทั้งหมด", value:`${m.total_members} คน` },
      { label:"อนุมัติแล้ว",   value:`${m.approved_members} คน` },
    ],
  },
  {
    id:"plot", icon:"🗺️", label:"ระบบแปลงและการปลูก",
    pct:(m,a) => {
      let s = 55;
      if (a.plot_active)   s += 10;
      if (m.total_plots >= 5) s += 5;
      if (m.total_cycles >= 5) s += 5;
      return Math.min(85, s);
    },
    target:85, pilotBlock:false, color:"#047857", bg:"#F0FDF4",
    roles:["farmer","staff","inspector"],
    done:["ลงทะเบียนแปลง + GPS","สร้างรอบปลูก","บันทึกต้นทุน/standard fallback","Farmer self-report"],
    todo:["เชื่อมผลตรวจแปลงกับรอบปลูก"],
    tables:["plots","planting_cycles","crop_yield_config"],
    connects:["member","harvest","noburn","inspection","report"],
    codex:[], pavee:[],
    liveStats: m => [
      { label:"แปลงที่ลงทะเบียน", value:`${m.total_plots} แปลง` },
      { label:"รอบปลูกทั้งหมด",   value:`${m.total_cycles} รอบ` },
    ],
  },
  {
    id:"harvest", icon:"🌽", label:"ระบบรับซื้อ",
    pct:(m,a) => {
      let s = 65;
      if (a.booking_active) s += 10;
      if (a.slot_active)    s += 5;
      if (m.total_bookings >= 10) s += 5;
      return Math.min(90, s);
    },
    target:90, pilotBlock:true, color:"#D97706", bg:"#FFFBEB",
    roles:["farmer","staff","admin"],
    done:["Farmer จองวันเกี่ยว","เลือกจุดรับ 2 จุด","Admin queue + peak-day alert","Dryer quota per location","Farmer เห็นคิวอบ 7 วัน","Moisture calculator + suggestion"],
    todo:["Admin complete + actual data fields (Codex Z2-2)","UAT script (Codex Z2-4)"],
    tables:["harvest_bookings","pickup_slots","pickup_locations"],
    connects:["member","intake","staff","stock","report","calculator"],
    codex:["Z2-2","Z2-4"], pavee:[],
    liveStats: m => [
      { label:"booking ทั้งหมด", value:`${m.total_bookings}` },
      { label:"slot เปิดอยู่",   value:`${m.open_slots}` },
    ],
  },
  {
    id:"intake", icon:"⚖️", label:"Intake Data Layer",
    pct:(m,a) => {
      let s = 80;
      if (a.intake_active)           s += 10;
      if (m.completed_intakes >= 10) s += 5;
      return Math.min(95, s);
    },
    target:95, pilotBlock:true, color:"#7C3AED", bg:"#F5F3FF",
    roles:["staff","admin","factory-api"],
    done:["Migration economics fields ✅","calculateIntake() engine ✅","Factory API ✅","Manual entry + Staff UI ✅","Receipt page ✅","Queue board ✅","Reconciliation + export ✅","API key management ✅"],
    todo:["CSV import batch (Codex Z3-6)"],
    tables:["harvest_bookings","factory_api_keys","intake_logs"],
    connects:["harvest","staff","comms","stock","report"],
    codex:["Z3-6"], pavee:[],
    liveStats: m => [
      { label:"รับซื้อแล้ว", value:`${m.completed_intakes} ครั้ง` },
    ],
  },
  {
    id:"staff", icon:"👷", label:"ระบบเจ้าหน้าที่",
    pct:(_m,_a) => 75,
    target:80, pilotBlock:true, color:"#6D28D9", bg:"#EDE9FE",
    roles:["staff","inspector","leader","admin"],
    done:["StaffHome + ⚖️บันทึกรับซื้อ ✅","Leader: สรุปกลุ่ม + pending ✅","Inspector: form + GPS ✅","Admin assign + LINE แจ้ง ✅","Queue board auto-refresh ✅"],
    todo:["UAT staff flow (Codex Z9-2)"],
    tables:["member_roles","inspections","member_groups"],
    connects:["harvest","intake","inspection","noburn","member"],
    codex:["Z9-2"], pavee:["Z0-1 LIFF test"],
    liveStats: _m => [],
  },
  {
    id:"noburn", icon:"🔥", label:"ระบบไม่เผา",
    pct:(m,a) => {
      let s = 60;
      if (a.noburn_active)     s += 10;
      if (m.approved_noburn > 0) s += 10;
      return Math.min(85, s);
    },
    target:85, pilotBlock:false, color:"#DC2626", bg:"#FEF2F2",
    roles:["farmer","inspector","staff","admin"],
    done:["Farmer ยื่นคำขอ + รูป + GPS","Admin review + approve/reject","LINE แจ้ง farmer 3 templates ✅","Trigger inspection อัตโนมัติ ✅","โบนัสในรายงาน farmer"],
    todo:["ทดสอบ GPS ภาคสนาม (Pavee Z5-2)"],
    tables:["no_burn_requests","no_burn_confirmations","photos"],
    connects:["member","plot","inspection","comms","report"],
    codex:[], pavee:["Z5-2 GPS field test"],
    liveStats: m => [
      { label:"คำขอทั้งหมด", value:`${m.total_noburn}` },
      { label:"อนุมัติแล้ว", value:`${m.approved_noburn}` },
    ],
  },
  {
    id:"inspection", icon:"🔍", label:"ระบบตรวจแปลง",
    pct:(m,a) => {
      let s = 60;
      if (a.inspect_active)    s += 10;
      if (m.done_inspect > 0)  s += 5;
      return Math.min(80, s);
    },
    target:75, pilotBlock:false, color:"#1D4ED8", bg:"#EFF6FF",
    roles:["inspector","staff","admin"],
    done:["Inspector task list","Result form + GPS + verdict ✅","Admin assign UI + LINE แจ้ง ✅","Trigger จาก no-burn ✅"],
    todo:["เชื่อมผลกับ planting_cycles"],
    tables:["inspections","photos"],
    connects:["noburn","plot","staff","report"],
    codex:[], pavee:[],
    liveStats: m => [
      { label:"งานทั้งหมด", value:`${m.total_inspect}` },
      { label:"เสร็จแล้ว",  value:`${m.done_inspect}` },
    ],
  },
  {
    id:"seed", icon:"🌾", label:"ระบบเมล็ด/ร้านค้า",
    pct:(m,a) => {
      let s = 72;
      if (a.seed_active)      s += 5;
      if (m.total_products >= 5) s += 5;
      return Math.min(88, s);
    },
    target:85, pilotBlock:false, color:"#0369A1", bg:"#F0F9FF",
    roles:["farmer","staff","admin"],
    done:["Farmer จองเมล็ด + admin confirm","POS ขายหน้าร้าน","โปรโมชั่น multi-type","ราคาตามความชื้น","สต็อก + movements"],
    todo:["Low stock auto alert"],
    tables:["seed_reservations","products","product_stock","sale_orders"],
    connects:["member","stock","report"],
    codex:[], pavee:[],
    liveStats: m => [
      { label:"สินค้าทั้งหมด", value:`${m.total_products}` },
    ],
  },
  {
    id:"calculator", icon:"💧", label:"ระบบตัดสินใจเกี่ยว",
    pct:(_m,_a) => 95,
    target:95, pilotBlock:false, color:"#0D9488", bg:"#F0FDFA",
    roles:["farmer","staff","admin"],
    done:["Calculator + price table","โปรโมชั่น multi-type","Weather Open-Meteo GPS","Practical suggestion ✅","Rain-adjusted rate ✅","Dryer queue visible ✅","Harvest booking ✅"],
    todo:[],
    tables:["moisture_deductions","market_prices","campaign_announcements"],
    connects:["harvest","member","report"],
    codex:[], pavee:[],
    liveStats: _m => [],
  },
  {
    id:"comms", icon:"📢", label:"ระบบสื่อสาร",
    pct:(_m,a) => {
      let s = 55;
      if (a.campaign_active) s += 10;
      return Math.min(80, s);
    },
    target:80, pilotBlock:false, color:"#0284C7", bg:"#F0F9FF",
    roles:["admin","staff"],
    done:["Campaign announcements","In-app notifications","Broadcast by group/district API ✅","8 LINE message templates ✅"],
    todo:["ตั้ง LINE token ใน Vercel (Pavee)","ทดสอบ push จริง (Pavee)"],
    tables:["campaign_announcements","notifications"],
    connects:["member","noburn","harvest","inspection"],
    codex:[], pavee:["Z0-3 LINE token"],
    liveStats: m => [
      { label:"campaign active", value:`${m.active_campaigns}` },
    ],
  },
  {
    id:"report", icon:"📈", label:"ระบบรายงาน",
    pct:(_m,_a) => 83,
    target:85, pilotBlock:false, color:"#374151", bg:"#F9FAFB",
    roles:["admin","staff"],
    done:["👥 สมาชิก ✅","📅 การจองขาย ✅","🎯 คาด vs จริง ✅","🚛 ตามรถ ✅","💰 ยอดขาย ✅","📦 สต็อก ✅","📍 ตามพื้นที่ ✅","📥 Export CSV ✅","Farmer self-report ✅"],
    todo:[],
    tables:["harvest_bookings","sale_orders","planting_cycles"],
    connects:["member","harvest","plot","seed","noburn"],
    codex:[], pavee:[],
    liveStats: _m => [],
  },
  {
    id:"truck", icon:"🚛", label:"ระบบรถร่วม",
    pct:(m,a) => {
      let s = 30;
      if (a.truck_active)     s += 5;
      if (m.total_vehicles >= 3) s += 5;
      return Math.min(45, s);
    },
    target:70, pilotBlock:false, phase2:true, color:"#92400E", bg:"#FFFBEB",
    roles:["truck_owner","admin"],
    done:["สมัครรถร่วม","TruckHome + เมนู","Quality report by vehicle ✅"],
    todo:["GPS ping API (ZT-2)","Driver job screen (ZT-3)","Admin live map (ZT-4)","Quality score tier (ZT-5)"],
    tables:["member_vehicles","service_bookings"],
    connects:["harvest","staff","report"],
    codex:["ZT-1","ZT-2","ZT-3","ZT-4","ZT-5"], pavee:[],
    liveStats: m => [
      { label:"รถที่ลงทะเบียน", value:`${m.total_vehicles}` },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const pctColor = (p:number) => p>=85?"#059669":p>=70?"#D97706":p>=50?"#2563EB":"#DC2626";
const pctBg    = (p:number) => p>=85?"#ECFDF5":p>=70?"#FFFBEB":p>=50?"#EFF6FF":"#FEF2F2";

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminSystemMapPage() {
  const [data,    setData]    = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel,     setSel]     = useState<string | null>(null);
  const [view,    setView]    = useState<'map'|'todo'|'path'>('map');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/system-metrics');
    const d   = (await res.json()) as ApiData;
    setData(d);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading || !data) return (
    <AdminWebShell title="🗺️ System Map" subtitle="สถานะระบบทั้งหมด">
      <p style={{ color:'#9ca3af', textAlign:'center', padding:40 }}>กำลังโหลด metrics…</p>
    </AdminWebShell>
  );

  const { metrics: m, activity: a } = data;
  const systems = SYSTEMS.map(s => ({ ...s, computedPct: s.pct(m, a) }));
  const sel_sys = systems.find(s => s.id === sel);

  const avgPct  = Math.round(systems.reduce((s,x) => s+x.computedPct, 0) / systems.length);
  const ready   = systems.filter(s => s.computedPct >= 80).length;
  const allTodo = systems.flatMap(s => s.todo).length;
  const codexN  = systems.flatMap(s => s.codex).length;
  const paveeN  = systems.flatMap(s => s.pavee).length;
  const asOf    = new Date(data.as_of).toLocaleString('th-TH', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });

  return (
    <AdminWebShell title="🗺️ System Architecture Map" subtitle={`อัปเดต: ${asOf} — กดที่ระบบเพื่อดูรายละเอียด`}>
      {/* View tabs */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', justifyContent:'space-between' }}>
        <div style={{ display:'flex', gap:6 }}>
          {([{k:'map',l:'🗺️ ภาพรวม'},{k:'todo',l:'📋 งานค้าง'},{k:'path',l:'🚀 เส้นทาง'}] as const).map(({k,l}) => (
            <button key={k} onClick={() => setView(k)}
              className={`admin-btn ${view===k?'admin-btn--primary':'admin-btn--secondary'}`}
              style={{ fontSize:13, padding:'7px 14px' }}>{l}</button>
          ))}
        </div>
        <button onClick={load} className="admin-btn admin-btn--secondary" style={{ fontSize:12 }}>🔄 รีเฟรช</button>
      </div>

      {/* KPI strip */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { label:'ความพร้อมเฉลี่ย', value:`${avgPct}%`,           color:'#D97706' },
          { label:'ระบบ ≥80%',        value:`${ready}/${systems.length}`, color:'#059669' },
          { label:'สมาชิก',           value:`${m.approved_members}/${m.total_members} คน`, color:'#2563EB' },
          { label:'รับซื้อแล้ว',      value:`${m.completed_intakes} ครั้ง`, color:'#7C3AED' },
          { label:'งานค้าง',          value:`${allTodo}`,            color:'#6B7280' },
          { label:'Codex/Pavee',       value:`${codexN}/${paveeN}`,   color:'#F59E0B' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex:1, minWidth:90, background:'var(--color-background-secondary)', border:'1px solid var(--color-border-tertiary)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
            <p style={{ margin:'0 0 2px', fontSize:11, color:'#9ca3af' }}>{label}</p>
            <p style={{ margin:0, fontSize:16, fontWeight:700, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* MAP VIEW */}
      {view === 'map' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:8, marginBottom:16 }}>
            {systems.map(s => {
              const isSel = sel === s.id;
              const pct   = s.computedPct;
              return (
                <div key={s.id} onClick={() => setSel(isSel ? null : s.id)}
                  style={{ background:isSel?s.bg:'var(--color-background-primary)', border:`2px solid ${isSel?s.color:'var(--color-border-tertiary)'}`, borderRadius:12, padding:'11px 13px', cursor:'pointer', position:'relative', overflow:'hidden', transition:'all .12s' }}>
                  <div style={{ position:'absolute', top:0, left:0, height:3, width:'100%', background:'var(--color-background-secondary)' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:pctColor(pct) }}/>
                  </div>
                  {s.pilotBlock && <span style={{ position:'absolute', top:5, right:6, fontSize:8, fontWeight:700, color:'#DC2626', background:'#FEF2F2', padding:'1px 5px', borderRadius:4 }}>PILOT</span>}
                  {s.phase2    && <span style={{ position:'absolute', top:5, right:6, fontSize:8, fontWeight:700, color:'#D97706', background:'#FFFBEB', padding:'1px 5px', borderRadius:4 }}>PHASE2</span>}
                  <span style={{ fontSize:20 }}>{s.icon}</span>
                  <p style={{ margin:'4px 0 2px', fontSize:11, fontWeight:700, color:isSel?s.color:'var(--color-text-primary)', lineHeight:1.3 }}>{s.label}</p>
                  <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:2 }}>
                    <div style={{ flex:1, height:4, background:'var(--color-background-secondary)', borderRadius:99, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:pctColor(pct), borderRadius:99 }}/>
                    </div>
                    <span style={{ fontSize:10, fontWeight:700, color:pctColor(pct) }}>{pct}%</span>
                  </div>
                  {/* Live stats */}
                  {s.liveStats(m).map(({ label, value }) => (
                    <p key={label} style={{ margin:'1px 0 0', fontSize:9, color:'#9ca3af' }}>{label}: <b style={{ color:'var(--color-text-primary)' }}>{value}</b></p>
                  ))}
                  {s.todo.length > 0
                    ? <p style={{ margin:'3px 0 0', fontSize:9, color:'#9ca3af' }}>เหลือ {s.todo.length} งาน</p>
                    : <p style={{ margin:'3px 0 0', fontSize:9, color:'#059669', fontWeight:600 }}>✅ ครบแล้ว</p>}
                </div>
              );
            })}
          </div>

          {/* Detail panel */}
          {sel_sys && (
            <div style={{ background:'var(--color-background-secondary)', border:`2px solid ${sel_sys.color}`, borderRadius:14, padding:18, marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14, flexWrap:'wrap' }}>
                <span style={{ fontSize:28 }}>{sel_sys.icon}</span>
                <div style={{ flex:1 }}>
                  <h3 style={{ margin:'0 0 2px', fontSize:16, fontWeight:800 }}>{sel_sys.label}</h3>
                  <p style={{ margin:0, fontSize:11, color:'#9ca3af' }}>{sel_sys.roles.join(' · ')}</p>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <div style={{ background:pctBg(sel_sys.computedPct), borderRadius:8, padding:'4px 12px', textAlign:'center' }}>
                    <p style={{ margin:0, fontSize:10, color:pctColor(sel_sys.computedPct) }}>ตอนนี้</p>
                    <p style={{ margin:0, fontSize:18, fontWeight:800, color:pctColor(sel_sys.computedPct) }}>{sel_sys.computedPct}%</p>
                  </div>
                  <span style={{ fontSize:16, color:'#9ca3af', alignSelf:'center' }}>→</span>
                  <div style={{ background:'#ECFDF5', borderRadius:8, padding:'4px 12px', textAlign:'center' }}>
                    <p style={{ margin:0, fontSize:10, color:'#059669' }}>เป้า</p>
                    <p style={{ margin:0, fontSize:18, fontWeight:800, color:'#059669' }}>{sel_sys.target}%</p>
                  </div>
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div>
                  <p style={{ margin:'0 0 6px', fontSize:10, fontWeight:700, color:'#059669', textTransform:'uppercase' }}>✅ ทำแล้ว</p>
                  {sel_sys.done.map((d,i) => <p key={i} style={{ margin:'0 0 3px', fontSize:12, color:'var(--color-text-primary)' }}>▸ {d}</p>)}
                  {sel_sys.todo.length > 0 && <>
                    <p style={{ margin:'10px 0 6px', fontSize:10, fontWeight:700, color:'#D97706', textTransform:'uppercase' }}>⏳ ยังเหลือ</p>
                    {sel_sys.todo.map((t,i) => <p key={i} style={{ margin:'0 0 3px', fontSize:12, color:'#D97706' }}>▸ {t}</p>)}
                  </>}
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {/* Live numbers */}
                  {sel_sys.liveStats(m).length > 0 && (
                    <div style={{ background:sel_sys.bg, borderRadius:8, padding:'10px 12px' }}>
                      <p style={{ margin:'0 0 6px', fontSize:10, fontWeight:700, color:sel_sys.color, textTransform:'uppercase' }}>📊 ข้อมูล Live</p>
                      {sel_sys.liveStats(m).map(({ label, value }) => (
                        <div key={label} style={{ display:'flex', justifyContent:'space-between' }}>
                          <span style={{ fontSize:12, color:'#6b7280' }}>{label}</span>
                          <span style={{ fontSize:13, fontWeight:700, color:sel_sys.color }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <p style={{ margin:'0 0 6px', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>Tables</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {sel_sys.tables.map(t => <span key={t} style={{ fontSize:9, padding:'2px 7px', borderRadius:5, background:'var(--color-background-primary)', color:'#9ca3af', fontFamily:'monospace', border:'1px solid var(--color-border-tertiary)' }}>{t}</span>)}
                    </div>
                  </div>
                  <div>
                    <p style={{ margin:'0 0 6px', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>เชื่อมกับ</p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {sel_sys.connects.map(c => {
                        const linked = systems.find(x => x.id === c);
                        return linked ? <button key={c} onClick={e => { e.stopPropagation(); setSel(c); }} style={{ fontSize:10, padding:'3px 9px', borderRadius:7, border:'none', cursor:'pointer', fontWeight:600, background:linked.bg, color:linked.color }}>{linked.icon} {linked.label}</button> : null;
                      })}
                    </div>
                  </div>
                  {(sel_sys.codex.length > 0 || sel_sys.pavee.length > 0) && (
                    <div>
                      <p style={{ margin:'0 0 6px', fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase' }}>งานที่เหลือ</p>
                      {sel_sys.codex.length > 0 && <p style={{ margin:'0 0 3px', fontSize:11 }}>🤖 Codex: <span style={{ color:'#2563EB' }}>{sel_sys.codex.join(', ')}</span></p>}
                      {sel_sys.pavee.length > 0 && <p style={{ margin:0, fontSize:11 }}>👤 Pavee: <span style={{ color:'#D97706' }}>{sel_sys.pavee.join(', ')}</span></p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TODO VIEW */}
      {view === 'todo' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ background:'#FFFBEB', border:'1.5px solid #FCD34D', borderRadius:12, padding:14 }}>
            <p style={{ margin:'0 0 10px', fontWeight:700, color:'#92400E' }}>👤 Pavee ต้องทำ ({paveeN} งาน)</p>
            {systems.filter(s => s.pavee.length > 0).map(s => (
              <div key={s.id} style={{ marginBottom:6, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, minWidth:120 }}>{s.icon} {s.label}:</span>
                {s.pavee.map(t => <span key={t} style={{ fontSize:11, padding:'2px 9px', borderRadius:6, background:'#FEF3C7', color:'#92400E', border:'1px solid #FCD34D' }}>{t}</span>)}
              </div>
            ))}
          </div>

          <div style={{ background:'#EFF6FF', border:'1.5px solid #BFDBFE', borderRadius:12, padding:14 }}>
            <p style={{ margin:'0 0 10px', fontWeight:700, color:'#1E40AF' }}>🤖 Codex ทำ ({codexN} issues)</p>
            {systems.filter(s => s.codex.length > 0).map(s => (
              <div key={s.id} style={{ marginBottom:6, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:12, minWidth:120 }}>{s.icon} {s.label}:</span>
                {s.codex.map(t => (
                  <span key={t} style={{ fontSize:11, padding:'2px 9px', borderRadius:6, background:t.startsWith('ZT')?'#FFFBEB':'#DBEAFE', color:t.startsWith('ZT')?'#92400E':'#1E40AF', border:`1px solid ${t.startsWith('ZT')?'#FCD34D':'#93C5FD'}` }}>
                    {t}{t.startsWith('ZT')?' (Phase2)':''}
                  </span>
                ))}
              </div>
            ))}
          </div>

          <div style={{ border:'1px solid var(--color-border-tertiary)', borderRadius:12, padding:14 }}>
            <p style={{ margin:'0 0 10px', fontWeight:700, color:'#9ca3af' }}>⏳ งานค้างทั้งหมด ({allTodo} งาน)</p>
            {systems.filter(s => s.todo.length > 0).map(s => (
              <div key={s.id} style={{ marginBottom:8 }}>
                <p style={{ margin:'0 0 3px', fontSize:12, color:s.color, fontWeight:700 }}>{s.icon} {s.label}</p>
                {s.todo.map((t,i) => <p key={i} style={{ margin:'0 0 2px', fontSize:11, color:'#9ca3af', paddingLeft:12 }}>▸ {t}</p>)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PATH VIEW */}
      {view === 'path' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {[
            { title:'🚀 เส้นทางสู่ Pilot', color:'#DC2626', bg:'#FEF2F2', border:'#FECACA',
              steps:[
                {l:'Pavee\nZ0 Fix',sub:'LIFF+token+RLS+migration',c:'#DC2626'},
                {l:'Codex\nZ1-1',sub:'LINE push approve',c:'#F97316'},
                {l:'Codex\nZ2-2',sub:'actual weight UI',c:'#F59E0B'},
                {l:'Codex\nZ3-6',sub:'CSV import',c:'#EAB308'},
                {l:'Pavee\nUAT',sub:'test 3 roles',c:'#84CC16'},
                {l:'🎉 Pilot',sub:'20-50 คน',c:'#10B981'},
              ]},
            { title:'🌱 Full Rollout', color:'#059669', bg:'#F0FDF4', border:'#BBF7D0',
              steps:[
                {l:'GPS test\nภาคสนาม',sub:'no-burn Pavee',c:'#DC2626'},
                {l:'LINE\ntoken live',sub:'push จริง',c:'#F97316'},
                {l:'UAT\nscripts',sub:'Codex Z9-x',c:'#F59E0B'},
                {l:'🎊 Rollout',sub:'ทุกระบบ',c:'#10B981'},
              ]},
            { title:'🔮 Phase 2 — หลัง Rollout', color:'#9CA3AF', bg:'#F9FAFB', border:'#E5E7EB',
              steps:[
                {l:'ZT-1',sub:'migration',c:'#6B7280'},
                {l:'ZT-2',sub:'GPS ping',c:'#6B7280'},
                {l:'ZT-3',sub:'driver app',c:'#6B7280'},
                {l:'ZT-4',sub:'admin map',c:'#6B7280'},
                {l:'ZT-5',sub:'quality tier',c:'#6B7280'},
              ]},
          ].map(({ title, color, bg, border, steps }) => (
            <div key={title} style={{ background:bg, border:`1.5px solid ${border}`, borderRadius:12, padding:14 }}>
              <p style={{ margin:'0 0 12px', fontWeight:700, color, fontSize:14 }}>{title}</p>
              <div style={{ display:'flex', gap:0, flexWrap:'wrap', alignItems:'center' }}>
                {steps.map((step, i) => (
                  <div key={step.l} style={{ display:'flex', alignItems:'center' }}>
                    <div style={{ background:'var(--color-background-primary)', border:`1.5px solid ${step.c}`, borderRadius:10, padding:'8px 12px', minWidth:80, textAlign:'center' }}>
                      <p style={{ margin:'0 0 2px', fontSize:11, fontWeight:700, color:step.c, whiteSpace:'pre-line' }}>{step.l}</p>
                      <p style={{ margin:0, fontSize:9, color:'#9ca3af' }}>{step.sub}</p>
                    </div>
                    {i < steps.length-1 && <span style={{ fontSize:14, color:'#9ca3af', padding:'0 4px' }}>→</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Stats */}
          <div style={{ border:'1px solid var(--color-border-tertiary)', borderRadius:12, padding:14 }}>
            <p style={{ margin:'0 0 10px', fontWeight:700, fontSize:13 }}>📊 สถิติ Live จาก DB</p>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
              {[
                { label:'สมาชิก approved', value:m.approved_members },
                { label:'รอบปลูก',          value:m.total_cycles },
                { label:'booking ทั้งหมด',   value:m.total_bookings },
                { label:'รับซื้อ completed', value:m.completed_intakes },
                { label:'คำขอไม่เผา',        value:m.total_noburn },
                { label:'งานตรวจ',           value:m.total_inspect },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign:'center' }}>
                  <p style={{ margin:'0 0 2px', fontSize:18, fontWeight:800 }}>{value}</p>
                  <p style={{ margin:0, fontSize:10, color:'#9ca3af' }}>{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display:'flex', gap:12, marginTop:16, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'#9ca3af', fontWeight:600 }}>ความพร้อม:</span>
        {[{l:'≥85%',c:'#059669'},{l:'70-84%',c:'#D97706'},{l:'50-69%',c:'#2563EB'},{l:'<50%',c:'#DC2626'}].map(({l,c})=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:c }}/>
            <span style={{ fontSize:11, color:'#9ca3af' }}>{l}</span>
          </div>
        ))}
        <span style={{ marginLeft:'auto', fontSize:11, color:'#9ca3af' }}>% คำนวณจาก DB จริง + code completeness</span>
      </div>
    </AdminWebShell>
  );
}

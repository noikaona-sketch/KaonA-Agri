'use client';

import { useEffect, useState } from 'react';

// ── UAT Test Cases ────────────────────────────────────────────────────────────
const UAT_GROUPS = [
  {
    id: 'infra', label: '🔧 Infrastructure', role: 'Pavee',
    tests: [
      { id:'i1', label:'Run all migrations บน Supabase production สำเร็จ', critical:true },
      { id:'i2', label:'ตั้ง LINE_CHANNEL_ACCESS_TOKEN ใน Vercel', critical:true },
      { id:'i3', label:'LIFF เปิดได้บน iOS (LINE app จริง)', critical:true },
      { id:'i4', label:'LIFF เปิดได้บน Android (LINE app จริง)', critical:true },
      { id:'i5', label:'Deploy บน Vercel ไม่มี build error', critical:true },
    ],
  },
  {
    id: 'member', label: '👥 ระบบสมาชิก', role: 'Pavee',
    tests: [
      { id:'m1', label:'Farmer สมัครสมาชิกผ่าน LINE LIFF ได้', critical:true },
      { id:'m2', label:'Admin เห็น pending member ใน admin panel', critical:true },
      { id:'m3', label:'Admin approve → Farmer ได้รับ LINE แจ้ง ✅', critical:true },
      { id:'m4', label:'Admin reject → Farmer ได้รับ LINE แจ้ง ❌ พร้อมเหตุผล', critical:true },
      { id:'m5', label:'Farmer login หลัง approve เห็น home screen ถูก role', critical:true },
      { id:'m6', label:'Farmer กรอก onboarding checklist ครบ 4 ขั้น', critical:false },
      { id:'m7', label:'Farmer A ไม่เห็นข้อมูล Farmer B (RLS)', critical:true },
      { id:'m8', label:'Import CSV สมาชิก → review → approve batch', critical:false },
    ],
  },
  {
    id: 'booking', label: '🌽 ระบบรับซื้อ', role: 'Pavee',
    tests: [
      { id:'b1', label:'Farmer จองวันเกี่ยวได้จาก /harvest/book', critical:true },
      { id:'b2', label:'Farmer เห็น dryer queue 7 วัน ก่อนจอง', critical:false },
      { id:'b3', label:'Admin เห็น booking ใน harvest queue', critical:true },
      { id:'b4', label:'Admin เห็น peak-day alert เมื่อ quota เกิน 80%', critical:false },
      { id:'b5', label:'Farmer แก้ไขวันที่ booking ได้', critical:false },
      { id:'b6', label:'Farmer cancel booking ได้', critical:false },
      { id:'b7', label:'Moisture calculator คำนวณถูกต้อง', critical:true },
      { id:'b8', label:'Practical suggestion แสดงตาม rain + revenue', critical:false },
    ],
  },
  {
    id: 'intake', label: '⚖️ ระบบรับซื้อจริง', role: 'Pavee',
    tests: [
      { id:'int1', label:'Staff เปิด /harvest/intake เห็นคิววันนี้', critical:true },
      { id:'int2', label:'Staff กรอก actual weight → preview ก่อนบันทึก', critical:true },
      { id:'int3', label:'บันทึก actual weight → Farmer ได้รับ LINE receipt', critical:true },
      { id:'int4', label:'Walk-in (ไม่มี booking) → ระบบสร้าง booking อัตโนมัติ', critical:false },
      { id:'int5', label:'quality_grade = reject → บันทึกได้ ไม่คำนวณ', critical:false },
      { id:'int6', label:'Admin ปิดรับวัน → no-show flagged → export CSV', critical:true },
      { id:'int7', label:'รายงาน 🎯 คาด vs จริง แสดงข้อมูล accuracy', critical:false },
    ],
  },
  {
    id: 'noburn', label: '🔥 ระบบไม่เผา', role: 'Pavee',
    tests: [
      { id:'nb1', label:'Farmer ยื่นคำขอ + อัปโหลดรูป + GPS ได้', critical:false },
      { id:'nb2', label:'GPS ทำงานถูกต้องใน LINE webview (ทดสอบภาคสนาม)', critical:false },
      { id:'nb3', label:'Admin approve → Farmer ได้รับ LINE 🌿', critical:false },
      { id:'nb4', label:'Admin reject → Farmer ได้รับ LINE ❌ + เหตุผล', critical:false },
      { id:'nb5', label:'โบนัสแสดงถูกต้องใน farmer report', critical:false },
    ],
  },
  {
    id: 'staff', label: '👷 ระบบเจ้าหน้าที่', role: 'Pavee',
    tests: [
      { id:'s1', label:'Staff login เห็น ⚖️ บันทึกรับซื้อ เป็นเมนูแรก', critical:true },
      { id:'s2', label:'Leader เห็นสรุปกลุ่มสมาชิก + จำนวน pending', critical:false },
      { id:'s3', label:'Admin assign inspection → Inspector ได้รับ LINE 📋', critical:false },
      { id:'s4', label:'Inspector กรอกผลตรวจ + GPS + verdict ได้', critical:false },
    ],
  },
  {
    id: 'report', label: '📈 ระบบรายงาน', role: 'Pavee',
    tests: [
      { id:'r1', label:'รายงาน 👥 สมาชิก แสดง KPI + chart ถูกต้อง', critical:false },
      { id:'r2', label:'รายงาน 📅 การจองขาย แสดงรายวัน/รายการ', critical:false },
      { id:'r3', label:'รายงาน 📍 ตามพื้นที่ แสดงตามอำเภอ/กลุ่ม', critical:false },
      { id:'r4', label:'Export CSV ทุก report ดาวน์โหลดได้ (BOM ไทย)', critical:false },
      { id:'r5', label:'Farmer ดู self-report กำไร/ต้นทุน/ไม่เผา ได้', critical:false },
    ],
  },
];

type TestResult = 'pass' | 'fail' | 'skip' | 'pending';
type ResultMap  = Record<string, { result: TestResult; note: string; testedAt: string }>;

const RESULT_CFG: Record<TestResult, { icon:string; color:string; bg:string; label:string }> = {
  pass:    { icon:'✅', color:'#166534', bg:'#f0fdf4', label:'ผ่าน'    },
  fail:    { icon:'❌', color:'#991b1b', bg:'#fef2f2', label:'ไม่ผ่าน' },
  skip:    { icon:'⏭️', color:'#6b7280', bg:'#f9fafb', label:'ข้าม'    },
  pending: { icon:'⬜', color:'#9ca3af', bg:'#f9fafb', label:'ยังไม่ทดสอบ' },
};

const STORAGE_KEY = 'kaona_uat_results';

function loadResults(): ResultMap {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as ResultMap;
  } catch { return {}; }
}

function saveResults(r: ResultMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

export default function AdminUATPage() {
  const [results,  setResults]  = useState<ResultMap>({});
  const [filter,   setFilter]   = useState<'all' | 'pending' | 'fail'>('all');
  const [notes,    setNotes]    = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => { setResults(loadResults()); }, []);

  function setResult(testId: string, result: TestResult) {
    const updated = {
      ...results,
      [testId]: { result, note: notes[testId] ?? results[testId]?.note ?? '', testedAt: new Date().toISOString() },
    };
    setResults(updated);
    saveResults(updated);
  }

  function setNote(testId: string, note: string) {
    setNotes(p => ({ ...p, [testId]: note }));
  }

  function saveNote(testId: string) {
    const updated = {
      ...results,
      [testId]: { ...results[testId], result: results[testId]?.result ?? 'pending', note: notes[testId] ?? '', testedAt: results[testId]?.testedAt ?? '' },
    };
    setResults(updated);
    saveResults(updated);
  }

  function resetAll() {
    if (!confirm('รีเซ็ตผลทดสอบทั้งหมด?')) return;
    setResults({});
    saveResults({});
  }

  // สถิติรวม
  const allTests = UAT_GROUPS.flatMap(g => g.tests);
  const critical  = allTests.filter(t => t.critical);
  const counts = {
    pass:    allTests.filter(t => results[t.id]?.result === 'pass').length,
    fail:    allTests.filter(t => results[t.id]?.result === 'fail').length,
    skip:    allTests.filter(t => results[t.id]?.result === 'skip').length,
    pending: allTests.filter(t => !results[t.id] || results[t.id].result === 'pending').length,
  };
  const criticalFail    = critical.filter(t => results[t.id]?.result === 'fail').length;
  const criticalPending = critical.filter(t => !results[t.id] || results[t.id].result === 'pending').length;
  const pilotReady      = criticalFail === 0 && criticalPending === 0;

  return (
    <div style={{ maxWidth:900, margin:'0 auto', padding:'20px 16px', fontFamily:"'Sarabun',sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ margin:'0 0 4px', fontSize:22, fontWeight:800 }}>🧪 UAT Dashboard</h1>
        <p style={{ margin:0, fontSize:13, color:'#6b7280' }}>ผลการทดสอบระบบก่อน Pilot — กดที่ผลเพื่อบันทึก</p>
      </div>

      {/* Pilot Ready banner */}
      <div style={{ background:pilotReady?'#f0fdf4':'#fef2f2', border:`2px solid ${pilotReady?'#86efac':'#fca5a5'}`, borderRadius:14, padding:'14px 18px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p style={{ margin:'0 0 2px', fontSize:16, fontWeight:800, color:pilotReady?'#166534':'#991b1b' }}>
            {pilotReady ? '🚀 พร้อม Pilot แล้ว!' : `⚠️ ยังไม่พร้อม Pilot`}
          </p>
          <p style={{ margin:0, fontSize:12, color:pilotReady?'#166534':'#991b1b' }}>
            {pilotReady
              ? 'ทุก critical test ผ่านแล้ว — สามารถเปิด Pilot ได้'
              : `critical ยังไม่ผ่าน ${criticalFail} ข้อ · รอทดสอบ ${criticalPending} ข้อ`}
          </p>
        </div>
        <div style={{ fontSize:28 }}>{pilotReady ? '✅' : '🔴'}</div>
      </div>

      {/* KPI strip */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {[
          { label:'ทั้งหมด',      value:allTests.length,   color:'#374151' },
          { label:'✅ ผ่าน',      value:counts.pass,        color:'#059669' },
          { label:'❌ ไม่ผ่าน',   value:counts.fail,        color:counts.fail>0?'#dc2626':'#9ca3af' },
          { label:'⬜ รอทดสอบ',   value:counts.pending,     color:counts.pending>0?'#d97706':'#9ca3af' },
          { label:'⭐ Critical',   value:critical.length,    color:'#1d4ed8' },
          { label:'Critical ผ่าน',value:critical.length-criticalFail-criticalPending, color:'#059669' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ flex:1, minWidth:80, background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
            <p style={{ margin:'0 0 2px', fontSize:11, color:'#9ca3af' }}>{label}</p>
            <p style={{ margin:0, fontSize:18, fontWeight:700, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
          <span style={{ fontSize:12, color:'#6b7280' }}>ความคืบหน้า</span>
          <span style={{ fontSize:12, fontWeight:600 }}>{Math.round((counts.pass/(allTests.length||1))*100)}%</span>
        </div>
        <div style={{ height:10, background:'#e5e7eb', borderRadius:99, overflow:'hidden', display:'flex' }}>
          <div style={{ width:`${(counts.pass/allTests.length)*100}%`, background:'#059669' }}/>
          <div style={{ width:`${(counts.fail/allTests.length)*100}%`, background:'#dc2626' }}/>
          <div style={{ width:`${(counts.skip/allTests.length)*100}%`, background:'#d1d5db' }}/>
        </div>
      </div>

      {/* Filters + reset */}
      <div style={{ display:'flex', gap:8, marginBottom:16, justifyContent:'space-between', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6 }}>
          {([['all','ทั้งหมด'],['pending','รอทดสอบ'],['fail','ไม่ผ่าน']] as const).map(([k,l]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ padding:'6px 14px', borderRadius:8, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background:filter===k?'#1f2937':'#f3f4f6', color:filter===k?'#fff':'#374151' }}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={resetAll} style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #fca5a5', cursor:'pointer', fontSize:12, color:'#dc2626', background:'#fff' }}>
          🗑️ รีเซ็ตทั้งหมด
        </button>
      </div>

      {/* Test groups */}
      {UAT_GROUPS.map(group => {
        const groupTests   = group.tests.filter(t => {
          if (filter === 'pending') return !results[t.id] || results[t.id].result === 'pending';
          if (filter === 'fail')    return results[t.id]?.result === 'fail';
          return true;
        });
        if (groupTests.length === 0) return null;

        const gPass    = group.tests.filter(t => results[t.id]?.result === 'pass').length;
        const gTotal   = group.tests.length;
        const isExpand = expanded[group.id] !== false; // default open

        return (
          <div key={group.id} style={{ border:'1px solid #e5e7eb', borderRadius:12, marginBottom:12, overflow:'hidden' }}>
            {/* Group header */}
            <div onClick={() => setExpanded(p => ({ ...p, [group.id]:!isExpand }))}
              style={{ background:'#f9fafb', padding:'12px 16px', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <span style={{ fontWeight:700, fontSize:14 }}>{group.label}</span>
                <span style={{ fontSize:11, color:'#6b7280', marginLeft:8 }}>by {group.role}</span>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:12, color: gPass===gTotal?'#059669':'#6b7280', fontWeight:600 }}>{gPass}/{gTotal} ผ่าน</span>
                <span style={{ fontSize:14, color:'#9ca3af' }}>{isExpand ? '▲' : '▼'}</span>
              </div>
            </div>

            {/* Tests */}
            {isExpand && groupTests.map(test => {
              const res = results[test.id];
              const cfg = RESULT_CFG[res?.result ?? 'pending'];
              return (
                <div key={test.id} style={{ padding:'10px 16px', borderTop:'0.5px solid #f0f0f0', background:res?.result==='fail'?'#fff8f8':undefined }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    {/* Critical badge */}
                    <div style={{ flexShrink:0, marginTop:2 }}>
                      {test.critical && <span style={{ fontSize:9, padding:'1px 5px', borderRadius:4, background:'#DBEAFE', color:'#1E40AF', fontWeight:700 }}>⭐</span>}
                    </div>
                    {/* Label */}
                    <p style={{ flex:1, margin:0, fontSize:13, color: res?.result==='pass'?'#6b7280':res?.result==='fail'?'#991b1b':'#1f2937', textDecoration:res?.result==='skip'?'line-through':undefined }}>
                      {test.label}
                    </p>
                    {/* Buttons */}
                    <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                      {(['pass','fail','skip'] as TestResult[]).map(r => (
                        <button key={r} onClick={() => setResult(test.id, r)}
                          style={{ padding:'3px 8px', borderRadius:6, border:`1px solid ${res?.result===r?RESULT_CFG[r].color:'#e5e7eb'}`, background:res?.result===r?RESULT_CFG[r].bg:'#fff', cursor:'pointer', fontSize:11, fontWeight:res?.result===r?700:400, color:res?.result===r?RESULT_CFG[r].color:'#9ca3af' }}>
                          {RESULT_CFG[r].icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Note input */}
                  {(res?.result === 'fail' || res?.note) && (
                    <div style={{ marginTop:6, paddingLeft:22, display:'flex', gap:6 }}>
                      <input placeholder="บันทึกปัญหาที่พบ..." value={notes[test.id] ?? res?.note ?? ''}
                        onChange={e => setNote(test.id, e.target.value)}
                        onBlur={() => saveNote(test.id)}
                        style={{ flex:1, padding:'4px 8px', borderRadius:6, border:'1px solid #fca5a5', fontSize:12, background:'#fff' }} />
                    </div>
                  )}
                  {/* Tested at */}
                  {res?.testedAt && (
                    <p style={{ margin:'3px 0 0 22px', fontSize:10, color:'#9ca3af' }}>
                      ทดสอบเมื่อ {new Date(res.testedAt).toLocaleString('th-TH', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <p style={{ marginTop:16, fontSize:11, color:'#9ca3af', textAlign:'center' }}>
        ผลทดสอบบันทึกใน localStorage ของ browser นี้ · ⭐ = Critical (ต้องผ่านก่อน Pilot)
      </p>
    </div>
  );
}

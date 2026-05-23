'use client';

import { useState } from 'react';

type Props = {
  inspectionId  : string
  plotName?     : string
  farmerName?   : string
  onSuccess?    : () => void
};

const VERDICT_OPTS = [
  { value:'passed',       label:'✅ ผ่าน',             color:'#059669', bg:'#f0fdf4' },
  { value:'failed',       label:'❌ ไม่ผ่าน',          color:'#dc2626', bg:'#fef2f2' },
  { value:'needs_update', label:'⚠️ ต้องแก้ไขเพิ่มเติม', color:'#d97706', bg:'#fffbeb' },
];

export function InspectorResultForm({ inspectionId, plotName, farmerName, onSuccess }: Props) {
  const [verdict,  setVerdict]  = useState('');
  const [note,     setNote]     = useState('');
  const [gps,      setGps]      = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoad,  setGpsLoad]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [notice,   setNotice]   = useState<string | null>(null);

  function getGps() {
    setGpsLoad(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setGps({ lat:pos.coords.latitude, lng:pos.coords.longitude }); setGpsLoad(false); },
      ()  => { setNotice('❌ ไม่สามารถดึง GPS ได้ กรุณาเปิดสิทธิ์ตำแหน่ง'); setGpsLoad(false); },
      { timeout:10000, enableHighAccuracy:true }
    );
  }

  async function submit() {
    if (!verdict) { setNotice('❌ กรุณาเลือกผลการตรวจ'); return; }
    if (!note.trim()) { setNotice('❌ กรุณากรอกบันทึกผลการตรวจ'); return; }
    setSaving(true);
    const res = await fetch('/api/field/inspections', {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        inspection_id : inspectionId,
        result_status : verdict,
        result_note   : note,
        gps_lat       : gps?.lat,
        gps_lng       : gps?.lng,
      }),
    });
    setSaving(false);
    const d = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice('✅ บันทึกผลการตรวจแล้ว');
    onSuccess?.();
  }

  const selectedVerdict = VERDICT_OPTS.find(v => v.value === verdict);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {notice && (
        <div style={{ background:notice.startsWith('✅')?'#ecfdf5':'#fef2f2', border:`1px solid ${notice.startsWith('✅')?'#86efac':'#fca5a5'}`, borderRadius:10, padding:'10px 14px', fontWeight:600, color:notice.startsWith('✅')?'#14532d':'#991b1b', display:'flex', justifyContent:'space-between' }}>
          <span>{notice}</span>
          <button onClick={()=>setNotice(null)} style={{background:'none',border:'none',cursor:'pointer'}}>✕</button>
        </div>
      )}

      {/* Info */}
      {(plotName || farmerName) && (
        <div className="kaona-card" style={{ background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
          {plotName   && <p style={{ margin:'0 0 2px', fontSize:13, fontWeight:600 }}>🌱 {plotName}</p>}
          {farmerName && <p style={{ margin:0, fontSize:12, color:'#6b7280' }}>👤 {farmerName}</p>}
        </div>
      )}

      {/* Verdict */}
      <div>
        <p style={{ margin:'0 0 8px', fontSize:13, fontWeight:500, color:'#6b7280' }}>ผลการตรวจ <span style={{color:'#dc2626'}}>✱</span></p>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {VERDICT_OPTS.map(opt => (
            <button key={opt.value} onClick={() => setVerdict(opt.value)}
              style={{ padding:'12px 14px', borderRadius:10, border:`2px solid ${verdict===opt.value ? opt.color : '#e5e7eb'}`, background:verdict===opt.value ? opt.bg : '#fff', cursor:'pointer', textAlign:'left', fontWeight:600, fontSize:14, color:verdict===opt.value ? opt.color : '#374151' }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <label className="reg-label">บันทึกผลการตรวจ <span className="reg-required">✱</span>
        <textarea className="reg-input" rows={4}
          placeholder="อธิบายสิ่งที่พบ สภาพแปลง และเหตุผลของผลการตรวจ..."
          value={note} onChange={e => setNote(e.target.value)}
          style={{ resize:'vertical', fontFamily:'inherit' }} />
      </label>

      {/* GPS */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <button className="admin-btn admin-btn--secondary" onClick={getGps} disabled={gpsLoad}
          style={{ fontSize:13 }}>
          {gpsLoad ? '📡 กำลังดึง GPS…' : gps ? '📍 GPS แล้ว — อัปเดต' : '📍 บันทึก GPS'}
        </button>
        {gps && (
          <span style={{ fontSize:11, color:'#059669' }}>
            {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
          </span>
        )}
      </div>

      {/* Submit */}
      <button className="admin-btn admin-btn--primary" onClick={submit}
        disabled={saving || !verdict}
        style={{ minHeight:52, fontSize:16, fontWeight:700, background: selectedVerdict?.color }}>
        {saving ? 'กำลังบันทึก…' : `${selectedVerdict?.label ?? 'บันทึกผลการตรวจ'}`}
      </button>
    </div>
  );
}

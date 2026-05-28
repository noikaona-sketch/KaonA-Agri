'use client';

import { useEffect, useRef, useState } from 'react';
import { Drawer } from '@/shared/components/drawer';
import { useOcrIdCard } from '@/features/register-farmer/use-ocr-id-card';

type Props = {
  open:boolean;
  onClose:()=>void;
  onCreated:(member?: { id: string; full_name: string; phone?: string | null })=>void;
};

const ROLES = [
  { value:'farmer',     label:'🌾 เกษตรกร' },
  { value:'staff',      label:'👷 เจ้าหน้าที่' },
  { value:'inspector',  label:'🔍 ผู้ตรวจแปลง' },
  { value:'leader',     label:'👥 หัวหน้ากลุ่ม' },
  { value:'truck_owner',label:'🚛 รถร่วม' },
];

const PROVINCES = ['กรุงเทพมหานคร','กระบี่','กาญจนบุรี','กาฬสินธุ์','กำแพงเพชร','ขอนแก่น','จันทบุรี','ฉะเชิงเทรา','ชลบุรี','ชัยนาท','ชัยภูมิ','ชุมพร','เชียงราย','เชียงใหม่','ตรัง','ตราด','ตาก','นครนายก','นครปฐม','นครพนม','นครราชสีมา','นครศรีธรรมราช','นครสวรรค์','นนทบุรี','นราธิวาส','น่าน','บึงกาฬ','บุรีรัมย์','ปทุมธานี','ประจวบคีรีขันธ์','ปราจีนบุรี','ปัตตานี','พระนครศรีอยุธยา','พะเยา','พังงา','พัทลุง','พิจิตร','พิษณุโลก','เพชรบุรี','เพชรบูรณ์','แพร่','ภูเก็ต','มหาสารคาม','มุกดาหาร','แม่ฮ่องสอน','ยโสธร','ยะลา','ร้อยเอ็ด','ระนอง','ระยอง','ราชบุรี','ลพบุรี','ลำปาง','ลำพูน','เลย','ศรีสะเกษ','สกลนคร','สงขลา','สตูล','สมุทรปราการ','สมุทรสงคราม','สมุทรสาคร','สระแก้ว','สระบุรี','สิงห์บุรี','สุโขทัย','สุพรรณบุรี','สุราษฎร์ธานี','สุรินทร์','หนองคาย','หนองบัวลำภู','อ่างทอง','อำนาจเจริญ','อุดรธานี','อุตรดิตถ์','อุทัยธานี','อุบลราชธานี'];

const F = ({ label, required, children }: { label:string; required?:boolean; children:React.ReactNode }) => (
  <label style={{ display:'block', marginBottom:14 }}>
    <span style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 }}>
      {label}{required && <span style={{ color:'#DC2626', marginLeft:2 }}>*</span>}
    </span>
    {children}
  </label>
);

const INPUT_STYLE: React.CSSProperties = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:'1.5px solid #E5E7EB', fontSize:13, color:'#111',
  background:'#fff', boxSizing:'border-box',
};

export function CreateMemberDrawer({ open, onClose, onCreated }: Props) {
  const { status: ocrStatus, error: ocrError, scan } = useOcrIdCard();
  const [form, setForm] = useState({
    full_name:'', phone:'', citizen_id:'', date_of_birth:'',
    gender:'', address:'', province:'', district:'', subdistrict:'',
    house_no:'', moo:'',
    bank_name:'', bank_account_number:'', bank_account_name:'',
    role:'farmer',
  });
  const [plots, setPlots] = useState([{ name:'', area_rai:'', province:'', district:'', sub_district:'', description:'' }]);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string|null>(null);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function f(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));
  }

  function applyOcrToForm(ocr: Awaited<ReturnType<typeof scan>>) {
    if (!ocr) return;
    setForm((prev) => ({
      ...prev,
      full_name: prev.full_name || ocr.fullName || '',
      citizen_id: prev.citizen_id || ocr.citizenId || '',
      address: prev.address || ocr.address || '',
      house_no: prev.house_no || ocr.houseNo || '',
      moo: prev.moo || ocr.moo || '',
      subdistrict: prev.subdistrict || ocr.subdistrict || '',
      district: prev.district || ocr.district || '',
      province: prev.province || ocr.province || '',
    }));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setOcrPreview(URL.createObjectURL(file));
    const ocr = await scan(file);
    applyOcrToForm(ocr);
  }

  async function openWebcam() {
    try {
      setWebcamError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setWebcamOpen(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch {
      setWebcamError('ไม่สามารถเปิดกล้องได้ กรุณาอัปโหลดไฟล์แทน');
    }
  }

  function stopWebcam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setWebcamOpen(false);
  }

  async function captureWebcam() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) return;
    const file = new File([blob], `id-card-${Date.now()}.jpg`, { type: 'image/jpeg' });
    setOcrPreview(URL.createObjectURL(file));
    stopWebcam();
    const ocr = await scan(file);
    applyOcrToForm(ocr);
  }


  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => {
    if (!open) stopWebcam();
  }, [open]);

  async function submit() {
    if (!form.full_name.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return; }
    if (!form.citizen_id.trim()) { setError('กรุณากรอกเลขบัตรประชาชน'); return; }
    if (form.citizen_id.replace(/\D/g,'').length !== 13) { setError('เลขบัตรประชาชนต้องมี 13 หลัก'); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/members/create', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        ...form,
        plots: plots
          .filter((p) => p.name.trim() && Number(p.area_rai) > 0)
          .map((p) => ({ ...p, area_rai: Number(p.area_rai) })),
      }),
      
    });
    setSaving(false);
    const d = (await res.json()) as { ok?:boolean; error?:string; member_id?: string };
    if (!res.ok) { setError(d.error ?? 'สร้างไม่สำเร็จ'); return; }
    onCreated({ id: d.member_id ?? '', full_name: form.full_name.trim(), phone: form.phone.trim() || null });
    onClose();
    setForm({ full_name:'', phone:'', citizen_id:'', date_of_birth:'', gender:'', address:'', province:'', district:'', subdistrict:'', house_no:'', moo:'', bank_name:'', bank_account_number:'', bank_account_name:'', role:'farmer' });
    setPlots([{ name:'', area_rai:'', province:'', district:'', sub_district:'', description:'' }]);
  }

  return (
    <Drawer open={open} onClose={onClose} title="➕ สร้างสมาชิกใหม่" width={560}>
      {error && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#991B1B' }}>
          ❌ {error}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
        <div style={{ gridColumn:'1/-1', marginBottom:8, border:'1px dashed #A7F3D0', borderRadius:10, padding:10, background:'#F0FDF4' }}>
          <p style={{ margin:'0 0 8px', fontSize:13, fontWeight:700 }}>📷 OCR บัตรประชาชน</p>
          <p style={{ margin:'0 0 8px', fontSize:12, color:'#4B5563' }}>ถ่ายจากเว็บแคม (เดสก์ท็อป) หรืออัปโหลดไฟล์เพื่อกรอกข้อมูลอัตโนมัติ</p>
          {ocrPreview && <img src={ocrPreview} alt="OCR preview" style={{ width:'100%', maxHeight:150, objectFit:'contain', border:'1px solid #DCFCE7', borderRadius:8, marginBottom:8 }} />}
          {ocrStatus === 'scanning' && <p style={{ margin:'0 0 8px', fontSize:12 }}>กำลังอ่านข้อมูลจากบัตร...</p>}
          {ocrError && <p style={{ margin:'0 0 8px', fontSize:12, color:'#B91C1C' }}>⚠️ {ocrError}</p>}
          {webcamError && <p style={{ margin:'0 0 8px', fontSize:12, color:'#B91C1C' }}>⚠️ {webcamError}</p>}

          {webcamOpen ? (
            <div style={{ marginBottom:8 }}>
              <video ref={videoRef} autoPlay playsInline style={{ width:'100%', borderRadius:8, border:'1px solid #D1D5DB' }} />
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <button type="button" onClick={captureWebcam}>📸 จับภาพ</button>
                <button type="button" onClick={stopWebcam}>ปิดกล้อง</button>
              </div>
            </div>
          ) : null}

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} style={{ display:'none' }} />
          <div style={{ display:'flex', gap:8 }}>
            <button type="button" onClick={openWebcam}>เปิดเว็บแคม</button>
            <button type="button" onClick={() => fileInputRef.current?.click()}>อัปโหลดไฟล์</button>
          </div>
        </div>
        <div style={{ gridColumn:'1/-1' }}>
          <F label="ชื่อ-นามสกุล" required>
            <input style={INPUT_STYLE} placeholder="เช่น สมชาย ใจดี" value={form.full_name} onChange={f('full_name')} />
          </F>
        </div>

        <F label="เลขบัตรประชาชน" required>
          <input style={INPUT_STYLE} placeholder="1 2345 67890 12 3" maxLength={17}
            value={form.citizen_id} onChange={e => setForm(p => ({...p, citizen_id: e.target.value.replace(/[^\d\s-]/g,'')}))} />
        </F>

        <F label="เบอร์โทรศัพท์">
          <input style={INPUT_STYLE} placeholder="0812345678" type="tel" value={form.phone} onChange={f('phone')} />
        </F>

        <F label="วันเกิด">
          <input style={INPUT_STYLE} type="date" value={form.date_of_birth} onChange={f('date_of_birth')} />
        </F>

        <F label="เพศ">
          <select style={INPUT_STYLE} value={form.gender} onChange={f('gender')}>
            <option value="">— เลือก —</option>
            <option value="male">ชาย</option>
            <option value="female">หญิง</option>
            <option value="other">อื่นๆ</option>
          </select>
        </F>

        <div style={{ gridColumn:'1/-1' }}>
          <F label="ที่อยู่">
            <textarea style={{ ...INPUT_STYLE, resize:'vertical' } as React.CSSProperties} rows={2}
              placeholder="บ้านเลขที่ ซอย ถนน" value={form.address} onChange={f('address')} />
          </F>
        </div>
        <F label="บ้านเลขที่"><input style={INPUT_STYLE} value={form.house_no} onChange={f('house_no')} /></F>
        <F label="หมู่"><input style={INPUT_STYLE} value={form.moo} onChange={f('moo')} /></F>

        <F label="จังหวัด">
          <select style={INPUT_STYLE} value={form.province} onChange={f('province')}>
            <option value="">— เลือกจังหวัด —</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </F>

        <F label="อำเภอ">
          <input style={INPUT_STYLE} placeholder="ชื่ออำเภอ" value={form.district} onChange={f('district')} />
        </F>

        <F label="ตำบล">
          <input style={INPUT_STYLE} placeholder="ชื่อตำบล" value={form.subdistrict} onChange={f('subdistrict')} />
        </F>

        <F label="บทบาทเริ่มต้น" required>
          <select style={INPUT_STYLE} value={form.role} onChange={f('role')}>
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </F>
        <F label="ธนาคาร"><input style={INPUT_STYLE} value={form.bank_name} onChange={f('bank_name')} /></F>
        <F label="เลขบัญชี"><input style={INPUT_STYLE} value={form.bank_account_number} onChange={f('bank_account_number')} /></F>
        <F label="ชื่อบัญชี"><input style={INPUT_STYLE} value={form.bank_account_name} onChange={f('bank_account_name')} /></F>
      </div>
      <div style={{ marginTop: 12, borderTop:'1px solid #E5E7EB', paddingTop:12 }}>
        <p style={{ margin:'0 0 8px', fontWeight:700 }}>แปลงเกษตร</p>
        {plots.map((pl, i) => (
          <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, border:'1px solid #E5E7EB', borderRadius:8, padding:8, marginBottom:8 }}>
            <input style={INPUT_STYLE} placeholder="ชื่อแปลง" value={pl.name} onChange={(e)=>setPlots(prev=>prev.map((x,idx)=>idx===i?{...x,name:e.target.value}:x))}/>
            <input style={INPUT_STYLE} placeholder="พื้นที่ (ไร่)" value={pl.area_rai} onChange={(e)=>setPlots(prev=>prev.map((x,idx)=>idx===i?{...x,area_rai:e.target.value}:x))}/>
            <input style={INPUT_STYLE} placeholder="จังหวัด" value={pl.province} onChange={(e)=>setPlots(prev=>prev.map((x,idx)=>idx===i?{...x,province:e.target.value}:x))}/>
            <input style={INPUT_STYLE} placeholder="อำเภอ" value={pl.district} onChange={(e)=>setPlots(prev=>prev.map((x,idx)=>idx===i?{...x,district:e.target.value}:x))}/>
            <input style={INPUT_STYLE} placeholder="ตำบล" value={pl.sub_district} onChange={(e)=>setPlots(prev=>prev.map((x,idx)=>idx===i?{...x,sub_district:e.target.value}:x))}/>
            <input style={INPUT_STYLE} placeholder="รายละเอียด" value={pl.description} onChange={(e)=>setPlots(prev=>prev.map((x,idx)=>idx===i?{...x,description:e.target.value}:x))}/>
          </div>
        ))}
        <button type="button" onClick={()=>setPlots(p=>[...p,{ name:'', area_rai:'', province:'', district:'', sub_district:'', description:'' }])}>+ เพิ่มแปลง</button>
      </div>

      <div style={{ display:'flex', gap:10, marginTop:8 }}>
        <button onClick={onClose}
          style={{ flex:1, padding:'10px', borderRadius:8, border:'1.5px solid #E5E7EB', background:'#fff', color:'#374151', fontWeight:600, fontSize:14, cursor:'pointer' }}>
          ยกเลิก
        </button>
        <button onClick={submit} disabled={saving}
          style={{ flex:2, padding:'10px', borderRadius:8, border:'none', background:'#16A34A', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer', opacity:saving?0.7:1 }}>
          {saving ? '⏳ กำลังสร้าง…' : '✅ สร้างสมาชิก'}
        </button>
      </div>
    </Drawer>
  );
}

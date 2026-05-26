'use client';

import { useState } from 'react';
import { Drawer } from '@/shared/components/drawer';

type Props = { open:boolean; onClose:()=>void; onCreated:()=>void };

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
  const [form, setForm] = useState({
    full_name:'', phone:'', citizen_id:'', date_of_birth:'',
    gender:'', address:'', province:'', district:'', subdistrict:'',
    role:'farmer',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string|null>(null);

  function f(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
      setForm(p => ({ ...p, [k]: e.target.value }));
  }

  async function submit() {
    if (!form.full_name.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return; }
    if (!form.citizen_id.trim()) { setError('กรุณากรอกเลขบัตรประชาชน'); return; }
    if (form.citizen_id.replace(/\D/g,'').length !== 13) { setError('เลขบัตรประชาชนต้องมี 13 หลัก'); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/admin/members/create', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(form),
    });
    setSaving(false);
    const d = (await res.json()) as { ok?:boolean; error?:string };
    if (!res.ok) { setError(d.error ?? 'สร้างไม่สำเร็จ'); return; }
    onCreated();
    onClose();
    setForm({ full_name:'', phone:'', citizen_id:'', date_of_birth:'', gender:'', address:'', province:'', district:'', subdistrict:'', role:'farmer' });
  }

  return (
    <Drawer open={open} onClose={onClose} title="➕ สร้างสมาชิกใหม่" width={560}>
      {error && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FCA5A5', borderRadius:8, padding:'10px 14px', marginBottom:16, fontSize:13, color:'#991B1B' }}>
          ❌ {error}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 16px' }}>
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

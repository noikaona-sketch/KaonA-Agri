'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Location  = { id: string; name: string; accepts_wet: boolean };
type Preview   = { net_weight_kg: number; net_amount: number; final_price: number; deduct_pct: number; total_bonus: number; applied_promos: { title: string; promo_bonus_per_kg: number }[] };

const GRADE_OPTS = [
  { value:'A', label:'A — ความชื้นต่ำ (< 22%)', color:'#059669' },
  { value:'B', label:'B — ปกติ (22–28%)',         color:'#D97706' },
  { value:'C', label:'C — ชื้นสูง (> 28%)',       color:'#DC2626' },
  { value:'reject', label:'❌ ปฏิเสธ — ส่งคืน',   color:'#6B7280' },
];
const PAY_OPTS = [
  { value:'transfer', label:'โอนเงิน' },
  { value:'cash',     label:'เงินสด' },
  { value:'debit_account', label:'ตัดบัญชีเครดิต' },
];
const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });

export function StaffIntakeForm({ onSuccess }: { onSuccess?: (bookingId: string) => void }) {
  const [locations,  setLocations]  = useState<Location[]>([]);
  const [form, setForm] = useState({
    member_phone: '', location_id: '',
    gross_weight_kg: '', moisture_pct: '',
    quality_grade: 'B', scale_ticket_no: '',
    payment_method: 'transfer', intake_note: '',
  });
  const [preview,    setPreview]    = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice,     setNotice]     = useState<string | null>(null);
  const [memberName, setMemberName] = useState('');

  useEffect(() => {
    const s = createSupabaseBrowserClient();
    void s.from('pickup_locations').select('id,name,accepts_wet').eq('active', true)
      .eq('accepts_wet', true).order('sort_order').then(({ data }) => setLocations(data ?? []));
  }, []);

  function field<K extends keyof typeof form>(k: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(p => ({ ...p, [k]: e.target.value }));
      setPreview(null);
    };
  }

  async function lookupMember() {
    if (!form.member_phone) return;
    const s = createSupabaseBrowserClient();
    const { data } = await s.from('members').select('id,full_name').eq('phone', form.member_phone).maybeSingle();
    setMemberName(data ? (data.full_name as string) : '❌ ไม่พบสมาชิก');
  }

  async function loadPreview() {
    if (!form.gross_weight_kg || !form.moisture_pct || !form.location_id || !form.member_phone) return;
    setPreviewing(true);
    const res = await fetch('/api/intake/manual?preview=1', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ member_phone:form.member_phone, location_id:form.location_id, gross_weight_kg:Number(form.gross_weight_kg), moisture_pct:Number(form.moisture_pct) }),
    });
    const d = (await res.json()) as { preview?: Preview; error?: string };
    setPreviewing(false);
    if (d.preview) setPreview(d.preview);
    else setNotice(`❌ ${d.error}`);
  }

  async function submit() {
    if (!preview && form.quality_grade !== 'reject') { await loadPreview(); return; }
    setSubmitting(true);
    const res = await fetch('/api/intake/manual', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ member_phone:form.member_phone, location_id:form.location_id, gross_weight_kg:Number(form.gross_weight_kg), moisture_pct:Number(form.moisture_pct), quality_grade:form.quality_grade, scale_ticket_no:form.scale_ticket_no||undefined, payment_method:form.payment_method, intake_note:form.intake_note||undefined }),
    });
    setSubmitting(false);
    const d = (await res.json()) as { ok?: boolean; booking_id?: string; rejected?: boolean; error?: string };
    if (!res.ok) { setNotice(`❌ ${d.error}`); return; }
    setNotice(d.rejected ? '✅ บันทึกการปฏิเสธแล้ว' : `✅ บันทึกสำเร็จ — booking ${d.booking_id?.slice(0,8)}`);
    setForm(p => ({ ...p, member_phone:'', gross_weight_kg:'', moisture_pct:'', scale_ticket_no:'' }));
    setPreview(null); setMemberName('');
    if (d.booking_id) onSuccess?.(d.booking_id);
  }

  const isReject = form.quality_grade === 'reject';
  const canPreview = !!(form.member_phone && form.location_id && form.gross_weight_kg && form.moisture_pct && !isReject);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {notice && (
        <div style={{ background:notice.startsWith('✅')?'#ecfdf5':'#fef2f2', border:`1px solid ${notice.startsWith('✅')?'#86efac':'#fca5a5'}`, borderRadius:10, padding:'10px 14px', fontWeight:600, color:notice.startsWith('✅')?'#14532d':'#991b1b', display:'flex', justifyContent:'space-between' }}>
          <span>{notice}</span>
          <button onClick={()=>setNotice(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16}}>✕</button>
        </div>
      )}

      <div className="kaona-card" style={{ display:'flex', flexDirection:'column', gap:12 }}>
        <p style={{ margin:0, fontSize:13, fontWeight:500, color:'#6b7280' }}>── ข้อมูลการรับซื้อ ──</p>

        {/* Member phone */}
        <label className="reg-label">เบอร์โทรสมาชิก <span className="reg-required">✱</span>
          <div style={{ display:'flex', gap:8 }}>
            <input className="reg-input" type="tel" placeholder="0812345678" value={form.member_phone}
              onChange={field('member_phone')} onBlur={lookupMember} style={{ flex:1 }} />
            <button className="admin-btn admin-btn--secondary" onClick={lookupMember} style={{ flexShrink:0 }}>ค้นหา</button>
          </div>
          {memberName && <span style={{ fontSize:12, color:memberName.startsWith('❌')?'#dc2626':'#059669', fontWeight:500 }}>{memberName}</span>}
        </label>

        {/* Location */}
        <label className="reg-label">จุดรับ <span className="reg-required">✱</span>
          <select className="reg-input" value={form.location_id} onChange={field('location_id')}>
            <option value="">— เลือกจุดรับ —</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <label className="reg-label">น้ำหนักรวม (กก.) <span className="reg-required">✱</span>
            <input className="reg-input" type="number" step="1" placeholder="เช่น 5200" value={form.gross_weight_kg}
              onChange={field('gross_weight_kg')} />
          </label>
          <label className="reg-label">ความชื้น (%) <span className="reg-required">✱</span>
            <input className="reg-input" type="number" step="0.5" placeholder="เช่น 28.5" value={form.moisture_pct}
              onChange={field('moisture_pct')} />
          </label>
          <label className="reg-label">คุณภาพ
            <select className="reg-input" value={form.quality_grade} onChange={field('quality_grade')}>
              {GRADE_OPTS.map(g => <option key={g.value} value={g.value} style={{ color:g.color }}>{g.label}</option>)}
            </select>
          </label>
          <label className="reg-label">เลขใบชั่ง
            <input className="reg-input" placeholder="TK-2569-00123" value={form.scale_ticket_no} onChange={field('scale_ticket_no')} />
          </label>
          {!isReject && (
            <label className="reg-label">การชำระ
              <select className="reg-input" value={form.payment_method} onChange={field('payment_method')}>
                {PAY_OPTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
          )}
          <label className="reg-label" style={{ gridColumn: isReject ? '1/-1' : 'auto' }}>หมายเหตุ
            <input className="reg-input" placeholder={isReject ? 'เหตุผลที่ปฏิเสธ' : 'ข้อมูลเพิ่มเติม'} value={form.intake_note} onChange={field('intake_note')} />
          </label>
        </div>
      </div>

      {/* Preview */}
      {!isReject && (
        <button className="admin-btn admin-btn--secondary" onClick={loadPreview} disabled={!canPreview||previewing}
          style={{ fontSize:13 }}>
          {previewing ? 'กำลังคำนวณ…' : '🔍 ดูตัวเลขก่อนบันทึก'}
        </button>
      )}

      {preview && (
        <div className="kaona-card" style={{ background:'#f0fdf4', border:'1px solid #bbf7d0' }}>
          <p style={{ margin:'0 0 10px', fontSize:13, fontWeight:500, color:'#166534' }}>── ผลการคำนวณ (ยืนยันก่อนบันทึก) ──</p>
          {[
            { label:'น้ำหนักหัก',  value:`${preview.deduct_pct}% = ${fmt(Number(form.gross_weight_kg) - preview.net_weight_kg)} กก.`, red:true },
            { label:'น้ำหนักสุทธิ', value:`${fmt(preview.net_weight_kg)} กก.`, bold:true },
            { label:'ราคา/กก.',    value:`${preview.final_price.toFixed(4)} บาท`, green:true },
            ...(preview.total_bonus > 0 ? [{ label:'  รวมโบนัส', value:`+${preview.total_bonus.toFixed(2)} บาท/กก.`, green:true }] : []),
          ].map(({label,value,red,green,bold}) => (
            <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom:'1px solid #dcfce7' }}>
              <span style={{ fontSize:13, color:'#6b7280' }}>{label}</span>
              <span style={{ fontSize:13, fontWeight:bold?700:500, color:red?'#dc2626':green?'#059669':'#111' }}>{value}</span>
            </div>
          ))}
          <div style={{ background:'#166534', borderRadius:10, padding:'12px', textAlign:'center', marginTop:10 }}>
            <p style={{ margin:'0 0 2px', fontSize:12, color:'#bbf7d0' }}>ยอดที่สมาชิกจะได้รับ</p>
            <p style={{ margin:0, fontSize:24, fontWeight:800, color:'#fff' }}>฿{fmt(preview.net_amount)}</p>
          </div>
        </div>
      )}

      <button className="admin-btn admin-btn--primary" onClick={submit} disabled={submitting || (!preview && !isReject)}
        style={{ minHeight:52, fontSize:16, fontWeight:700 }}>
        {submitting ? 'กำลังบันทึก…' : isReject ? '❌ บันทึกการปฏิเสธ' : '✅ ยืนยันและบันทึก'}
      </button>
    </div>
  );
}

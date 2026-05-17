'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCurrentMember } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { UIButton } from '@/shared/components/ui-button';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

const S = {
  label: { fontSize: 12, color: 'var(--color-text-secondary,#888)', fontWeight: 500 as const, margin: '0 0 4px' },
  input: { width: '100%', padding: '10px 12px', borderRadius: 10, border: '0.5px solid var(--color-border-tertiary,#e4ede4)', fontSize: 14, background: 'var(--color-background-primary,#fff)', color: 'var(--color-text-primary,#111)', boxSizing: 'border-box' as const },
  section: { fontSize: 13, fontWeight: 500 as const, color: 'var(--color-text-primary,#111)', margin: '4px 0 12px', paddingBottom: 8, borderBottom: '0.5px solid var(--color-border-tertiary,#e4ede4)' },
};

export default function ProfileEditPage() {
  const router = useRouter();
  const member = useCurrentMember();

  const [fullName,    setFullName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [address,     setAddress]     = useState('');
  const [bankName,    setBankName]    = useState('');
  const [bankAccNo,   setBankAccNo]   = useState('');
  const [bankAccName, setBankAccName] = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [notice,      setNotice]      = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('members')
        .select('full_name,phone,address,bank_name,bank_account_number,bank_account_name')
        .eq('id', member.member_id).maybeSingle();
      if (data) {
        const d = data as Record<string, string | null>;
        setFullName(d.full_name ?? '');
        setPhone(d.phone ?? '');
        setAddress(d.address ?? '');
        setBankName(d.bank_name ?? '');
        setBankAccNo(d.bank_account_number ?? '');
        setBankAccName(d.bank_account_name ?? '');
      }
      setLoading(false);
    })();
  }, [member?.member_id]);

  async function save() {
    if (!member?.member_id) return;
    if (!fullName.trim()) { setError('กรุณากรอกชื่อ'); return; }
    setSubmitting(true); setError(null);
    const s = createSupabaseBrowserClient();
    const { error: err } = await s.from('members').update({
      full_name:           fullName.trim(),
      phone:               phone.trim() || null,
      address:             address.trim() || null,
      bank_name:           bankName.trim() || null,
      bank_account_number: bankAccNo.trim() || null,
      bank_account_name:   bankAccName.trim() || null,
    }).eq('id', member.member_id);
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setNotice('✅ บันทึกแล้ว');
    setTimeout(() => router.replace('/profile'), 1200);
  }

  if (!member || loading) return <LoadingState label="กำลังโหลด…" />;

  return (
    <MobileAppShell title="" subtitle="">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: 'var(--color-text-primary,#111)', fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>←</button>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>แก้ไขโปรไฟล์</p>
        </div>

        {error  && <div style={{ background: '#FEE2E2', borderRadius: 10, padding: '10px 14px', color: '#991B1B', fontSize: 14 }}>{error}</div>}
        {notice && <div style={{ background: '#EAF3DE', borderRadius: 10, padding: '10px 14px', color: '#3B6D11', fontSize: 14, fontWeight: 500 }}>{notice}</div>}

        {/* ข้อมูลส่วนตัว */}
        <div>
          <p style={S.section}>ข้อมูลส่วนตัว</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><p style={S.label}>ชื่อ-นามสกุล *</p><input style={S.input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อเต็ม" /></div>
            <div><p style={S.label}>เบอร์โทรศัพท์</p><input style={S.input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08X-XXX-XXXX" type="tel" /></div>
            <div><p style={S.label}>ที่อยู่</p><textarea style={{ ...S.input, resize: 'none' as const, height: 72 }} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="บ้านเลขที่ ตำบล อำเภอ จังหวัด" /></div>
          </div>
        </div>

        {/* บัญชีธนาคาร */}
        <div>
          <p style={S.section}>บัญชีธนาคาร</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div><p style={S.label}>ธนาคาร</p>
              <select style={S.input} value={bankName} onChange={(e) => setBankName(e.target.value)}>
                <option value="">— เลือกธนาคาร —</option>
                {['กสิกรไทย','กรุงเทพ','กรุงไทย','ไทยพาณิชย์','ทหารไทยธนชาต','ออมสิน','ธ.ก.ส.','อื่นๆ'].map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
            <div><p style={S.label}>เลขบัญชี</p><input style={S.input} value={bankAccNo} onChange={(e) => setBankAccNo(e.target.value)} placeholder="XXX-X-XXXXX-X" /></div>
            <div><p style={S.label}>ชื่อบัญชี (ตามที่ธนาคารออกให้)</p><input style={S.input} value={bankAccName} onChange={(e) => setBankAccName(e.target.value)} placeholder="ชื่อ-นามสกุล ในบัญชี" /></div>
          </div>
        </div>

        {/* เอกสาร */}
        <div>
          <p style={S.section}>เอกสารประกอบ</p>
          <div style={{ background: 'var(--color-background-secondary,#f9fafb)', borderRadius: 12, padding: '14px', border: '0.5px solid var(--color-border-tertiary,#e4ede4)', fontSize: 13, color: 'var(--color-text-secondary,#888)', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 6px', fontWeight: 500, color: 'var(--color-text-primary,#111)' }}>เอกสารที่ต้องใช้:</p>
            <p style={{ margin: 0 }}>🪪 บัตรประชาชน</p>
            <p style={{ margin: 0 }}>📗 ทะเบียนเกษตรกร</p>
            <p style={{ margin: 0 }}>📄 โฉนด หรือ นส.3 (ถ้ามี)</p>
            <p style={{ margin: '8px 0 0', fontSize: 12, color: '#B45309' }}>
              ⚠️ การอัปโหลดเอกสารต้องดำเนินการผ่านเจ้าหน้าที่<br/>
              ติดต่อได้ที่ LINE @kaona-agri
            </p>
          </div>
        </div>

        <UIButton variant="primary" fullWidth onClick={save} disabled={submitting}>
          {submitting ? 'กำลังบันทึก…' : '💾 บันทึก'}
        </UIButton>

      </div>
    </MobileAppShell>
  );
}

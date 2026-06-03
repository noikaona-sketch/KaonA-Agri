'use client';

import { useEffect, useState } from 'react';
import { useRouter }           from 'next/navigation';
import { useCurrentMember }    from '@/providers/auth-provider';
import { MobileAppShell }      from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }      from '@/shared/components/protected-route';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMemberApiAuthHeaders } from '@/shared/auth/member-api-auth';

const BANKS = [
  'ธนาคารกรุงเทพ','ธนาคารกสิกรไทย','ธนาคารกรุงไทย','ธนาคารไทยพาณิชย์',
  'ธนาคารกรุงศรีอยุธยา','ธนาคารทหารไทยธนชาต','ธนาคารออมสิน',
  'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)','ธนาคารอื่นๆ',
];

const S = {
  label: { display: 'grid', gap: 5, fontSize: 13, fontWeight: 600, color: '#374151' } as React.CSSProperties,
  input: { padding: '11px 14px', border: '1.5px solid #e5e7eb', borderRadius: 10, fontSize: 15, width: '100%', background: '#fff', fontFamily: 'inherit' } as React.CSSProperties,
  section: { fontWeight: 700, fontSize: 14, color: '#1a1f1c', marginTop: 8, marginBottom: 4 } as React.CSSProperties,
};

function ProfileEditContent() {
  const member = useCurrentMember();
  const router = useRouter();

  const [fullName,    setFullName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [address,     setAddress]     = useState('');
  const [subdistrict, setSubdistrict] = useState('');
  const [district,    setDistrict]    = useState('');
  const [province,    setProvince]    = useState('');
  const [bankName,    setBankName]    = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankAccName, setBankAccName] = useState('');
  const [loaded,      setLoaded]      = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [notice,      setNotice]      = useState<string | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!member?.member_id || loaded) return;
    const sb = tryCreateSupabaseBrowserClient();
    if (!sb) return;
    void sb.from('members')
      .select('full_name,phone,address,subdistrict,district,province,bank_name,bank_account_number,bank_account_name')
      .eq('id', member.member_id).maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const d = data as Record<string,string|null>;
        setFullName(d.full_name ?? '');
        setPhone(d.phone ?? '');
        setAddress(d.address ?? '');
        setSubdistrict(d.subdistrict ?? '');
        setDistrict(d.district ?? '');
        setProvince(d.province ?? '');
        setBankName(d.bank_name ?? '');
        setBankAccount(d.bank_account_number ?? '');
        setBankAccName(d.bank_account_name ?? '');
        setLoaded(true);
      });
  }, [member?.member_id, loaded]);

  async function save() {
    if (!fullName.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return; }
    setSaving(true); setError(null);
    const authHeaders = await getMemberApiAuthHeaders();
    const res = await fetch('/api/member/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        full_name:           fullName.trim(),
        phone:               phone.trim()       || null,
        address:             address.trim()     || null,
        subdistrict:         subdistrict.trim() || null,
        district:            district.trim()    || null,
        province:            province.trim()    || null,
        bank_name:           bankName           || null,
        bank_account_number: bankAccount.trim() || null,
        bank_account_name:   bankAccName.trim() || null,
      }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setError(j.error ?? 'บันทึกไม่สำเร็จ'); return; }
    setNotice('✅ อัปเดตข้อมูลแล้ว');
    setTimeout(() => router.push('/profile'), 1500);
  }

  if (!loaded) return (
    <MobileAppShell title="แก้ไขโปรไฟล์" subtitle="อัปเดตข้อมูลส่วนตัว">
      <p style={{ textAlign: 'center', color: '#9ca3af', padding: 24 }}>กำลังโหลด…</p>
    </MobileAppShell>
  );

  return (
    <MobileAppShell title="แก้ไขโปรไฟล์" subtitle="อัปเดตข้อมูลส่วนตัว">
      <div className="mobile-stack">
        {notice && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#e8f5e9', color: '#1b5e20', fontSize: 13, fontWeight: 600 }}>{notice}</div>}
        {error  && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#ffebee', color: '#c62828', fontSize: 13, fontWeight: 600 }}>{error}</div>}

        {/* ข้อมูลส่วนตัว */}
        <p style={S.section}>👤 ข้อมูลส่วนตัว</p>
        <label style={S.label}>
          ชื่อ-นามสกุล *
          <input style={S.input} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
        </label>
        <label style={S.label}>
          เบอร์โทรศัพท์
          <input style={S.input} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812345678" />
        </label>

        {/* ที่อยู่ */}
        <p style={S.section}>📍 ที่อยู่</p>
        <label style={S.label}>
          บ้านเลขที่ / หมู่
          <input style={S.input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="เลขที่บ้าน หมู่บ้าน" />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={S.label}>
            ตำบล
            <input style={S.input} value={subdistrict} onChange={(e) => setSubdistrict(e.target.value)} placeholder="ตำบล" />
          </label>
          <label style={S.label}>
            อำเภอ
            <input style={S.input} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="อำเภอ" />
          </label>
        </div>
        <label style={S.label}>
          จังหวัด
          <input style={S.input} value={province} onChange={(e) => setProvince(e.target.value)} placeholder="จังหวัด" />
        </label>

        {/* บัญชีธนาคาร */}
        <p style={S.section}>🏦 บัญชีธนาคาร</p>
        <label style={S.label}>
          ธนาคาร
          <select style={S.input} value={bankName} onChange={(e) => setBankName(e.target.value)}>
            <option value="">— เลือกธนาคาร —</option>
            {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        <label style={S.label}>
          เลขบัญชี
          <input style={S.input} value={bankAccount} inputMode="numeric"
            onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ''))}
            placeholder="xxxxxxxxxx" />
        </label>
        <label style={S.label}>
          ชื่อบัญชี
          <input style={S.input} value={bankAccName} onChange={(e) => setBankAccName(e.target.value)} placeholder="ชื่อ-นามสกุลเจ้าของบัญชี" />
        </label>

        <button onClick={save} disabled={saving}
          style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginTop: 8 }}>
          {saving ? 'กำลังบันทึก…' : '💾 บันทึกข้อมูล'}
        </button>
      </div>
    </MobileAppShell>
  );
}

export default function ProfileEditPage() {
  return <ProtectedRoute><ProfileEditContent /></ProtectedRoute>;
}

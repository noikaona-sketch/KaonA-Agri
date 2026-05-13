'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useCurrentMember } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { UIButton } from '@/shared/components/ui-button';
import { ErrorState } from '@/shared/components/error-state';
import { LoadingState } from '@/shared/components/loading-state';

export default function ProfileEditPage() {
  const router = useRouter();
  const member = useCurrentMember();

  const [fullName,    setFullName]    = useState('');
  const [phone,       setPhone]       = useState('');
  const [address,     setAddress]     = useState('');
  const [citizenId,   setCitizenId]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [notice,      setNotice]      = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!member?.member_id) return;
    void (async () => {
      const s = createSupabaseBrowserClient();
      const { data } = await s.from('members')
        .select('full_name,phone,address,citizen_id_masked')
        .eq('id', member.member_id).maybeSingle();
      if (data) {
        setFullName((data as Record<string, string>).full_name ?? '');
        setPhone((data as Record<string, string>).phone ?? '');
        setAddress((data as Record<string, string>).address ?? '');
        setCitizenId((data as Record<string, string>).citizen_id_masked ?? '');
      }
      setLoadingData(false);
    })();
  }, [member?.member_id]);

  async function handleSave() {
    if (!member?.member_id) return;
    if (!fullName.trim()) { setError('กรุณากรอกชื่อ-นามสกุล'); return; }
    setSubmitting(true); setError(null);

    const res = await fetch(`/api/member/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        memberId: member.member_id,
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        citizenIdMasked: citizenId.trim() || null,
      }),
    });
    const payload = (await res.json()) as { ok?: boolean; error?: string };
    setSubmitting(false);
    if (!res.ok) { setError(payload.error ?? 'บันทึกไม่สำเร็จ'); return; }
    setNotice('✅ บันทึกข้อมูลแล้ว');
    setTimeout(() => router.replace('/profile'), 1200);
  }

  if (loadingData) return <LoadingState label="กำลังโหลด…" />;

  return (
    <MobileAppShell title="แก้ไขโปรไฟล์" subtitle="อัปเดตข้อมูลส่วนตัวของคุณ">
      <div className="mobile-stack" style={{ paddingBottom: 24 }}>

        {notice && (
          <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 10, padding: '12px 16px', fontWeight: 600, color: '#1b5e20' }}>
            {notice}
          </div>
        )}

        {error && <ErrorState title="บันทึกไม่สำเร็จ" detail={error} />}

        <label className="reg-label">ชื่อ-นามสกุล <span className="reg-required">*</span>
          <input className="reg-input" value={fullName} onChange={(e) => setFullName(e.target.value)}
            placeholder="ชื่อตามบัตรประชาชน" />
        </label>

        <label className="reg-label">เบอร์โทรศัพท์
          <input className="reg-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="0XX-XXX-XXXX" />
        </label>

        <label className="reg-label">เลขบัตรประชาชน (ปกปิดบางส่วน)
          <input className="reg-input" value={citizenId} onChange={(e) => setCitizenId(e.target.value)}
            placeholder="****-***-****" maxLength={20} />
          <span className="reg-hint">เช่น *****-12345 ระบบเก็บแบบปกปิด ไม่เก็บเลขจริง</span>
        </label>

        <label className="reg-label">ที่อยู่
          <textarea className="reg-input reg-textarea" rows={3} value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="บ้านเลขที่ หมู่ ตำบล อำเภอ จังหวัด" />
        </label>

        <UIButton fullWidth onClick={handleSave} loading={submitting} disabled={submitting}>
          💾 บันทึกข้อมูล
        </UIButton>

        <UIButton variant="ghost" fullWidth onClick={() => router.back()}>
          ← ยกเลิก
        </UIButton>

      </div>
    </MobileAppShell>
  );
}

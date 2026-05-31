'use client';

import { useState }         from 'react';
import { useRouter }        from 'next/navigation';
import { useCurrentMember } from '@/providers/auth-provider';
import { MobileAppShell }   from '@/shared/components/mobile-app-shell';
import { ProtectedRoute }   from '@/shared/components/protected-route';

function ProfileEditContent() {
  const member = useCurrentMember();
  const router = useRouter();
  const [fullName, setFullName] = useState(member?.full_name ?? '');
  const [phone,    setPhone]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [notice,   setNotice]   = useState<string | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  async function save() {
    if (!fullName.trim()) { setError('กรุณากรอกชื่อ'); return; }
    setSaving(true); setError(null);
    const res = await fetch('/api/member/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim() || null }),
    });
    const j = (await res.json()) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) { setError(j.error ?? 'บันทึกไม่สำเร็จ'); return; }
    setNotice('✅ อัปเดตข้อมูลแล้ว');
    setTimeout(() => router.push('/profile'), 1500);
  }

  return (
    <MobileAppShell title="แก้ไขโปรไฟล์" subtitle="อัปเดตข้อมูลส่วนตัว">
      <div className="mobile-stack">
        {notice && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#e8f5e9', color: '#1b5e20', fontSize: 13, fontWeight: 600 }}>{notice}</div>}
        {error  && <div style={{ padding: '10px 14px', borderRadius: 10, background: '#ffebee', color: '#c62828', fontSize: 13, fontWeight: 600 }}>{error}</div>}

        <label className="reg-label">ชื่อ-นามสกุล
          <input className="reg-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="ชื่อ-นามสกุล" />
        </label>
        <label className="reg-label">เบอร์โทรศัพท์
          <input className="reg-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="0812345678" />
        </label>
        <button onClick={save} disabled={saving}
          style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: saving ? '#e5e7eb' : '#2e7d32', color: saving ? '#9ca3af' : '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          {saving ? 'กำลังบันทึก…' : 'บันทึก'}
        </button>
      </div>
    </MobileAppShell>
  );
}

export default function ProfileEditPage() {
  return <ProtectedRoute><ProfileEditContent /></ProtectedRoute>;
}

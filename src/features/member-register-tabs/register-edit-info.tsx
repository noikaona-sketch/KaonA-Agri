'use client';

import { useState } from 'react';
import { useCurrentMember } from '@/providers/auth-provider';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { UIButton } from '@/shared/components/ui-button';

export function RegisterEditInfo() {
  const member = useCurrentMember();
  const [fullName, setFullName] = useState(member?.full_name ?? '');
  const [phone,    setPhone]    = useState('');
  const [saving, setSaving]     = useState(false);
  const [notice, setNotice]     = useState<string | null>(null);

  async function save() {
    if (!member?.member_id || !fullName.trim()) return;
    setSaving(true);
    const s = createSupabaseBrowserClient();
    const { error } = await s.from('members').update({
      full_name:  fullName.trim(),
      phone:      phone || null,
      updated_at: new Date().toISOString(),
    }).eq('id', member.member_id);
    setSaving(false);
    setNotice(error ? `❌ ${error.message}` : '✅ อัปเดตข้อมูลแล้ว รอ admin ตรวจสอบใหม่');
  }

  return (
    <div className="mobile-stack">
      {notice && (
        <div style={{ background: notice.startsWith('✅') ? '#e8f5e9' : '#ffebee', border: `1px solid ${notice.startsWith('✅') ? '#a5d6a7' : '#ef9a9a'}`, borderRadius: 12, padding: '12px 16px', fontWeight: 600, color: notice.startsWith('✅') ? '#1b5e20' : '#c62828' }}>
          {notice}
        </div>
      )}

      <div className="kaona-card" style={{ background: '#fff8e1', borderColor: '#ffe082' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#e65100' }}>
          ⚠️ การแก้ไขข้อมูลจะทำให้ต้องรอ admin ตรวจสอบใหม่อีกครั้ง
        </p>
      </div>

      <label className="reg-label">ชื่อ-นามสกุล <span className="reg-required">*</span>
        <input className="reg-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </label>
      <label className="reg-label">เบอร์โทรศัพท์
        <input className="reg-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08X-XXX-XXXX" />
      </label>

      <UIButton fullWidth onClick={save} loading={saving} disabled={!fullName.trim() || saving}>
        💾 บันทึกการแก้ไข
      </UIButton>
    </div>
  );
}

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorState } from '@/shared/components/error-state';
import { UIButton } from '@/shared/components/ui-button';

type Draft = { email: string; password: string; confirmPassword: string; fullName: string; department: string };

const DEPARTMENTS: { value: string; label: string }[] = [
  { value: 'admin',      label: 'แอดมิน' },
  { value: 'sales',      label: 'ฝ่ายขาย' },
  { value: 'accounting', label: 'บัญชี' },
  { value: 'finance',    label: 'การเงิน' },
  { value: 'field',      label: 'ภาคสนาม' },
  { value: 'stock',      label: 'สต๊อก' },
];

export function AdminRegisterForm() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ email: '', password: '', confirmPassword: '', fullName: '', department: '' });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof Draft) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft((p) => ({ ...p, [field]: e.target.value }));
  }

  const canSubmit = draft.email && draft.password.length >= 8 && draft.password === draft.confirmPassword && draft.fullName && draft.department;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/register', { credentials: 'include', 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: draft.email, password: draft.password, fullName: draft.fullName, department: draft.department }),
      });
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) { setError(payload.error ?? 'สมัครไม่สำเร็จ'); return; }
      setDone(true);
    } catch { setError('การเชื่อมต่อขัดข้อง'); } finally { setSubmitting(false); }
  }

  if (done) {
    return (
      <div className="mobile-stack" style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 48 }}>✅</div>
        <h2 style={{ margin: '8px 0 4px' }}>ส่งคำขอแล้ว</h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          รอ super_admin อนุมัติสิทธิ์การเข้าใช้งานหลังบ้าน
        </p>
        <UIButton fullWidth onClick={() => router.replace('/admin-login')}>ไปหน้า Login</UIButton>
      </div>
    );
  }

  return (
    <div className="mobile-stack">
      {error && <ErrorState title="สมัครไม่สำเร็จ" detail={error} />}

      <label className="reg-label">ชื่อ-นามสกุล <span className="reg-required">*</span>
        <input className="reg-input" value={draft.fullName} onChange={set('fullName')} placeholder="ชื่อจริง นามสกุล" disabled={submitting} />
      </label>

      <label className="reg-label">อีเมล <span className="reg-required">*</span>
        <input className="reg-input" type="email" value={draft.email} onChange={set('email')} placeholder="email@company.com" disabled={submitting} />
      </label>

      <label className="reg-label">แผนก <span className="reg-required">*</span>
        <select className="reg-input" value={draft.department} onChange={set('department')} disabled={submitting}>
          <option value="">เลือกแผนก</option>
          {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </label>

      <label className="reg-label">รหัสผ่าน (อย่างน้อย 8 ตัว) <span className="reg-required">*</span>
        <input className="reg-input" type="password" value={draft.password} onChange={set('password')} placeholder="••••••••" disabled={submitting} />
      </label>

      <label className="reg-label">ยืนยันรหัสผ่าน <span className="reg-required">*</span>
        <input className="reg-input" type="password" value={draft.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••••" disabled={submitting} />
        {draft.confirmPassword && draft.password !== draft.confirmPassword && (
          <span style={{ fontSize: 12, color: 'var(--danger)' }}>รหัสผ่านไม่ตรงกัน</span>
        )}
      </label>

      <UIButton fullWidth onClick={handleSubmit} disabled={!canSubmit || submitting} loading={submitting}>
        ส่งคำขอสมัคร
      </UIButton>

      <UIButton variant="ghost" fullWidth onClick={() => router.replace('/admin-login')}>
        มีบัญชีแล้ว → Login
      </UIButton>
    </div>
  );
}

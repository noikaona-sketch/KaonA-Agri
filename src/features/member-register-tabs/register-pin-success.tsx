import { UIButton } from '@/shared/components/ui-button';

const ROLE_LABELS: Record<string, { icon: string; label: string; desc: string }> = {
  inspector: { icon: '🔍', label: 'ผู้ตรวจสอบ', desc: 'คุณสามารถรับงานตรวจแปลงและบันทึกผลได้แล้ว' },
  staff:     { icon: '👷', label: 'เจ้าหน้าที่ภาคสนาม', desc: 'คุณสามารถช่วยลงทะเบียนและจัดการสมาชิกได้แล้ว' },
  leader:    { icon: '👥', label: 'หัวหน้ากลุ่ม', desc: 'คุณสามารถดูแลและติดตามทีมของคุณได้แล้ว' },
  truck_owner: { icon: '🚛', label: 'ทีมบริการ', desc: 'คุณสามารถรับงานขนส่งและบริการได้แล้ว' },
};

type PinSuccessProps = {
  role: string;
  onDone: () => void;
};

export function RegisterPinSuccess({ role, onDone }: PinSuccessProps) {
  const info = ROLE_LABELS[role] ?? { icon: '✅', label: role, desc: 'เข้าใช้งานระบบได้แล้ว' };

  return (
    <div className="mobile-stack" style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: 56 }}>{info.icon}</div>

      <div>
        <h2 style={{ margin: '8px 0 4px', fontSize: 20, color: 'var(--primary)' }}>
          ยืนยันตัวตนสำเร็จ!
        </h2>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>บทบาท: {info.label}</p>
      </div>

      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {info.desc}
      </p>

      <div className="kaona-card" style={{ background: '#e8f5e9', borderColor: '#a5d6a7', textAlign: 'left' }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--primary)', fontWeight: 700 }}>
          ✅ อนุมัติอัตโนมัติแล้ว
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
          ไม่ต้องรอเจ้าหน้าที่ — เข้าใช้งานได้ทันที
        </p>
      </div>

      <UIButton fullWidth onClick={onDone}>
        เข้าสู่ระบบ
      </UIButton>
    </div>
  );
}

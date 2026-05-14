'use client';

import { useAuth } from '@/providers/auth-provider';

const STATUS_CFG: Record<string, { icon: string; title: string; desc: string; color: string; bg: string }> = {
  pending_approval: {
    icon: '⏳', title: 'รอการอนุมัติ',
    desc: 'ทีมงาน KaonA กำลังตรวจสอบข้อมูลของคุณ โดยปกติใช้เวลา 1-3 วันทำการ',
    color: '#e65100', bg: '#fff8e1',
  },
  rejected: {
    icon: '❌', title: 'ไม่ผ่านการอนุมัติ',
    desc: 'คำขอสมัครของคุณไม่ผ่านการอนุมัติ กรุณาติดต่อ admin เพื่อขอข้อมูลเพิ่มเติม หรือแก้ไขข้อมูลแล้วสมัครใหม่',
    color: '#c62828', bg: '#ffebee',
  },
  suspended: {
    icon: '⛔', title: 'บัญชีถูกระงับ',
    desc: 'บัญชีของคุณถูกระงับชั่วคราว กรุณาติดต่อ admin',
    color: '#9e9e9e', bg: '#f5f5f5',
  },
};

export function RegisterStatus() {
  const { status, member } = useAuth();
  const cfg = STATUS_CFG[status] ?? STATUS_CFG.pending_approval;

  return (
    <div className="mobile-stack">
      <div style={{ background: cfg.bg, border: `2px solid ${cfg.color}44`, borderRadius: 18, padding: '24px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{cfg.icon}</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: cfg.color }}>{cfg.title}</h2>
        <p style={{ margin: 0, fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>{cfg.desc}</p>
      </div>

      {member?.full_name && (
        <div className="kaona-card">
          <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14, color: 'var(--primary)' }}>ข้อมูลที่สมัคร</p>
          <div className="info-row">
            <span className="info-row__label">ชื่อ</span>
            <span className="info-row__value">{member.full_name}</span>
          </div>
          <div className="info-row">
            <span className="info-row__label">LINE</span>
            <span className="info-row__value">{member.line_user_id ?? '—'}</span>
          </div>
        </div>
      )}

      <div className="kaona-card" style={{ background: '#f0f4f0' }}>
        <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: 14 }}>📞 ต้องการความช่วยเหลือ?</p>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.7 }}>
          ติดต่อ admin ผ่านเมนู "ติดต่อ admin" ด้านล่าง หรือโทร/LINE หา KaonA โดยตรง
        </p>
      </div>
    </div>
  );
}

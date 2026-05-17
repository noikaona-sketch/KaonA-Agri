'use client';
import { useState } from 'react';

export function ReturnRejectModal({ type, acting, onConfirm, onCancel }: {
  type: 'return' | 'reject'; acting: boolean;
  onConfirm: (reason: string) => void; onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const isReturn = type === 'return';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 480, width: '90%' }}>
        <h3 style={{ margin: '0 0 12px', color: isReturn ? '#1565c0' : '#c62828' }}>
          {isReturn ? '↩️ ตีกลับให้แก้ไข' : '❌ ปฏิเสธการสมัคร'}
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: 14, color: '#6b7280' }}>
          {isReturn ? 'ระบุสิ่งที่ต้องแก้ไข (จำเป็น)' : 'ระบุเหตุผลที่ปฏิเสธ (จำเป็น)'}
        </p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
          placeholder={isReturn ? 'เช่น: เลขบัตรไม่ตรงเอกสาร, กรุณาแนบรูปใหม่…' : 'เช่น: ข้อมูลไม่ถูกต้อง…'}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${isReturn ? '#90caf9' : '#ffcdd2'}`, fontSize: 14, boxSizing: 'border-box' as const, resize: 'none' as const }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button className="admin-btn admin-btn--secondary" onClick={onCancel}>ยกเลิก</button>
          <button className={`admin-btn ${isReturn ? 'admin-btn--primary' : 'admin-btn--danger'}`}
            disabled={!reason.trim() || acting} onClick={() => onConfirm(reason.trim())}>
            {isReturn ? '↩️ ตีกลับ' : '❌ ปฏิเสธ'}
          </button>
        </div>
      </div>
    </div>
  );
}

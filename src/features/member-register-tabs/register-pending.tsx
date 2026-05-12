import { StatusChip } from '@/shared/components/status-chip';
import { UIButton } from '@/shared/components/ui-button';

type RegisterPendingProps = {
  onReset: () => void;
};

export function RegisterPending({ onReset }: RegisterPendingProps) {
  return (
    <div className="mobile-stack" style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{ fontSize: 48 }}>🌱</div>
      <h2 style={{ margin: '8px 0 4px', fontSize: 20 }}>ส่งคำขอสำเร็จแล้ว</h2>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>
        เจ้าหน้าที่จะตรวจสอบและแจ้งผลทาง LINE
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
        <StatusChip status="submitted" />
      </div>

      <div className="kaona-card" style={{ textAlign: 'left', marginTop: 8 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14 }}>ขั้นตอนต่อไป</p>
        <ul style={{ margin: '8px 0 0', paddingLeft: 16, fontSize: 14, color: 'var(--text-secondary)', display: 'grid', gap: 6 }}>
          <li>เจ้าหน้าที่รับข้อมูลและตรวจสอบ</li>
          <li>ได้รับแจ้งผลทาง LINE ภายใน 1-3 วันทำการ</li>
          <li>เมื่ออนุมัติแล้ว เปิด LINE Mini App เข้าใช้งานได้ทันที</li>
        </ul>
      </div>

      <UIButton variant="ghost" fullWidth onClick={onReset} style={{ marginTop: 8 }}>
        กลับหน้าหลัก
      </UIButton>
    </div>
  );
}

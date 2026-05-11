import { FormSheet } from '@/shared/components/form-sheet';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { UIButton } from '@/shared/components/ui-button';

export default function ServiceRegisterPage() {
  return (
    <MobileAppShell title="ลงทะเบียนผู้ให้บริการ" subtitle="สำหรับผู้ให้บริการรายใหม่และการตั้งค่าทีม" roleBadge="ผู้ให้บริการ">
      <FormSheet title="แบบฟอร์มลงทะเบียนผู้ให้บริการ (MVP)">
        <label>
          ชื่อผู้ให้บริการ/ชื่อทีม
          <input type="text" placeholder="เช่น ทีมรถไถบ้านหนองบัว" defaultValue="ทีมเครื่องจักรการเกษตรหนองบัว" />
        </label>

        <label>
          ประเภทบริการที่ให้
          <input type="text" placeholder="เช่น ไถพรวน, หว่านปุ๋ย, ขนส่ง" defaultValue="รถไถเตรียมดิน, รถขนส่งผลผลิต" />
        </label>

        <label>
          ช่องทางติดต่อ
          <input type="text" placeholder="โทรศัพท์/LINE" defaultValue="08x-xxx-2244" />
        </label>

        <UIButton fullWidth>ส่งคำขอลงทะเบียนผู้ให้บริการ</UIButton>
      </FormSheet>
    </MobileAppShell>
  );
}

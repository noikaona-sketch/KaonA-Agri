import Link from 'next/link';

import { FormSheet } from '@/shared/components/form-sheet';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { UIButton } from '@/shared/components/ui-button';

export default function ServicePage() {
  return (
    <MobileAppShell title="ศูนย์ผู้ให้บริการ" subtitle="จัดการทีมผู้ให้บริการ และเข้าถึงเมนูที่เกี่ยวข้อง" roleBadge="ผู้ให้บริการ/หัวหน้าทีม">
      <FormSheet title="เมนูผู้ให้บริการ">
        <p style={{ marginTop: 0 }}>เลือกเมนูที่ต้องการใช้งาน</p>
        <div className="service-booking__actions">
          <Link href="/service/register" style={{ textDecoration: 'none' }}>
            <UIButton fullWidth>ลงทะเบียนผู้ให้บริการ</UIButton>
          </Link>
          <Link href="/service/booking" style={{ textDecoration: 'none' }}>
            <UIButton variant="ghost" fullWidth>
              ไปหน้าจองบริการ (สมาชิก)
            </UIButton>
          </Link>
        </div>
      </FormSheet>
    </MobileAppShell>
  );
}

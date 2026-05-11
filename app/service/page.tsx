import Link from 'next/link';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';

export default function ServicePage() {
  return (
    <MobileAppShell
      title="ศูนย์บริการและทีมผู้ให้บริการ"
      subtitle="เลือกเมนูสำหรับทีมบริการหรือผู้ให้บริการ"
      roleBadge="ทีมบริการ"
    >
      <section className="mobile-stack" aria-label="Service entry actions">
        <article className="kaona-card">
          <h2 className="kaona-card__title">ลงทะเบียนผู้ให้บริการ</h2>
          <p className="kaona-card__body">สำหรับผู้ให้บริการรายใหม่และทีมที่ต้องการสมัครเข้าระบบ</p>
          <Link href="/service/register">ไปหน้าลงทะเบียนผู้ให้บริการ</Link>
        </article>

        <article className="kaona-card">
          <h2 className="kaona-card__title">เข้าใช้งานระบบจองบริการสมาชิก</h2>
          <p className="kaona-card__body">เปิดหน้าการจองบริการสำหรับสมาชิกเกษตรกร</p>
          <Link href="/service/booking">ไปหน้าจองบริการ</Link>
        </article>
      </section>
    </MobileAppShell>
  );
}

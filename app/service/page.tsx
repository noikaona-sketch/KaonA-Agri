import Link from 'next/link';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';

export default function ServicePage() {
  return (
    <MobileAppShell title="ศูนย์บริการ" subtitle="เลือกงานของทีมบริการ" roleBadge="ทีมบริการ">
      <section className="mobile-stack" aria-label="Service entry actions">
        <article className="kaona-card">
          <h2 className="kaona-card__title">สมัครทีมบริการ</h2>
          <p className="kaona-card__body">สำหรับผู้ให้บริการใหม่ กดเพื่อส่งคำขอบทบาท</p>
          <Link href="/service/register">ไปสมัครทีมบริการ</Link>
        </article>

        <article className="kaona-card">
          <h2 className="kaona-card__title">จองบริการ</h2>
          <p className="kaona-card__body">สำหรับสมาชิก กดเพื่อเลือกบริการและส่งคำขอ</p>
          <Link href="/service/booking">ไปหน้าจองบริการ</Link>
        </article>
      </section>
    </MobileAppShell>
  );
}

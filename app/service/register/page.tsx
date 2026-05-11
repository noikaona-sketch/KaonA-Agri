import { MobileAppShell } from '@/shared/components/mobile-app-shell';

export default function ServiceRegisterPage() {
  return (
    <MobileAppShell
      title="ลงทะเบียนผู้ให้บริการ"
      subtitle="สำหรับทีมบริการและผู้ให้บริการที่ต้องการเข้าระบบ"
      roleBadge="ทีมบริการ"
    >
      <section className="mobile-stack" aria-label="Provider registration">
        <article className="kaona-card">
          <h2 className="kaona-card__title">ฟอร์มลงทะเบียนผู้ให้บริการ</h2>
          <p className="kaona-card__body">
            หน้านี้เตรียมไว้สำหรับ Issue #140 เพื่อรองรับการลงทะเบียนผู้ให้บริการและทีมบริการ โดยยังไม่เปลี่ยนแปลง auth/session เดิม
          </p>
        </article>
      </section>
    </MobileAppShell>
  );
}

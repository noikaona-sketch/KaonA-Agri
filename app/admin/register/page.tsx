import { AdminRegisterForm } from '@/features/admin-register/admin-register-form';

export default function AdminRegisterPage() {
  return (
    <main className="mobile-shell">
      <section className="mobile-shell__card">
        <p className="mobile-shell__kicker">KaonA Agri — หลังบ้าน</p>
        <h1 className="mobile-shell__title">สมัครบัญชีเจ้าหน้าที่</h1>
        <p className="mobile-shell__subtitle">
          กรอกข้อมูลและเลือกแผนก — รอ super admin อนุมัติก่อนเข้าใช้งาน
        </p>
        <div style={{ marginTop: 16 }}>
          <AdminRegisterForm />
        </div>
      </section>
    </main>
  );
}

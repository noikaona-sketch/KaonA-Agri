import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function AdminGroupsPage() {
  return (
    <AdminWebShell title="🗂️ จัดกลุ่มสมาชิก" subtitle="สร้างและจัดการกลุ่มสมาชิก">
      <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
        <div style={{ fontSize: 48 }}>🗂️</div>
        <p style={{ margin: '12px 0 4px', fontSize: 16, fontWeight: 600 }}>กำลังพัฒนา</p>
        <p style={{ margin: 0, fontSize: 14 }}>ฟีเจอร์จัดกลุ่มสมาชิกจะมีในเร็วๆ นี้</p>
      </div>
    </AdminWebShell>
  );
}

import Link from 'next/link';

import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminProductsList } from '@/features/admin-products/admin-products-list';

export default function AdminProductMasterPage() {
  return (
    <AdminWebShell
      title="🧾 Product Master"
      subtitle="จัดการข้อมูลสินค้าที่ใช้ในหน้ารับเข้าสินค้าคงคลัง"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>
          ตั้งค่าชื่อสินค้า หมวดหมู่ หน่วยนับ และราคา เพื่อให้ทีมคลังเลือกสินค้าได้ถูกต้องตอนรับเข้า
        </p>
        <Link href="/admin/stock" className="admin-btn admin-btn--ghost" style={{ textDecoration: 'none' }}>
          📥 ไปหน้ารับเข้าสต๊อก
        </Link>
      </div>
      <AdminProductsList />
    </AdminWebShell>
  );
}

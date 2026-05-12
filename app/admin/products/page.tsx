import { AdminProductsList } from '@/features/admin-products/admin-products-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="🛍️ จัดการสินค้า" subtitle="เพิ่ม แก้ไข และตั้งค่าสินค้าเมล็ดพันธุ์"><AdminProductsList /></AdminWebShell>;
}

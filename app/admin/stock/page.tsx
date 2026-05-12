import { AdminStockList } from '@/features/admin-stock/admin-stock-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="📦 สต๊อกสินค้า" subtitle="ดูสต๊อก รับสินค้าเข้า และปรับยอด"><AdminStockList /></AdminWebShell>;
}

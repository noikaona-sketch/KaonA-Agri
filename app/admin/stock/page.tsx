'use client';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminStockDashboard } from '@/features/admin-stock/admin-stock-dashboard';

export default function StockPage() {
  return (
    <AdminWebShell title="📦 คลังสินค้า" subtitle="สต๊อก รับเข้า โอน เคลื่อนไหว · มีหน้าปิดงวดรายเดือน">
      <AdminStockDashboard />
    </AdminWebShell>
  );
}

'use client';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminStockDashboard } from '@/features/admin-stock/admin-stock-dashboard';

export default function StockMonthlyClosingPage() {
  return (
    <AdminWebShell title="🔒 ปิดงวดสต๊อกรายเดือน" subtitle="ตรวจสอบ ปิดงวด เปิดงวดใหม่ และดู audit history ของสต๊อก">
      <AdminStockDashboard initialTab="periods" />
    </AdminWebShell>
  );
}

'use client';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
import { AdminStockClosingPage } from '@/features/admin-stock-closing/admin-stock-closing-page';

export default function StockClosingPage() {
  return (
    <AdminWebShell title="🧾 ปิดงวดสต๊อกรายเดือน" subtitle="ตรวจยอดเปิดงวด รับเข้า จ่ายออก โอน จอง และบันทึก snapshot ก่อนปิดงวด">
      <AdminStockClosingPage />
    </AdminWebShell>
  );
}

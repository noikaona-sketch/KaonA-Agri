import { AdminOrdersList } from '@/features/admin-orders/admin-orders-list';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="📋 คำสั่งซื้อ/จอง" subtitle="ติดตามและจัดการคำสั่งซื้อและการจอง"><AdminOrdersList /></AdminWebShell>;
}

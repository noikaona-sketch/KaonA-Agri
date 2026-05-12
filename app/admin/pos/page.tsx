import { AdminPos } from '@/features/admin-pos/admin-pos';
import { AdminWebShell } from '@/shared/components/admin-web-shell';
export default function Page() {
  return <AdminWebShell title="💰 POS ขาย / จอง" subtitle="เลือกสินค้า → เลือกสมาชิก → ขายหรือจอง"><AdminPos /></AdminWebShell>;
}

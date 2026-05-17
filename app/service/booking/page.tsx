'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MobileAppShell } from '@/shared/components/mobile-app-shell';
import { ProtectedRoute } from '@/shared/components/protected-route';
import { MemberShopCatalog } from '@/features/member-shop/member-shop-catalog';
import { MemberCheckout } from '@/features/member-shop/member-checkout';

type CartItem = { product: { id: string; name: string; unit: string; price_per_unit: number; category: string }; qty: number };

export default function BookingPage() {
  const router = useRouter();
  const [checkoutItems, setCheckoutItems] = useState<CartItem[] | null>(null);

  if (checkoutItems) {
    return (
      <ProtectedRoute>
        <MobileAppShell title="ยืนยันคำสั่ง" subtitle="ตรวจสอบรายการและชำระเงิน">
          <MemberCheckout
            items={checkoutItems}
            onBack={() => setCheckoutItems(null)}
            onSuccess={(orderId) => router.replace('/planting-cycles')}
          />
        </MobileAppShell>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <MobileAppShell title="ร้านค้า" subtitle="เมล็ดพันธุ์ ปุ๋ย และสินค้าเกษตร">
        <MemberShopCatalog onCheckout={(items) => setCheckoutItems(items)} />
      </MobileAppShell>
    </ProtectedRoute>
  );
}

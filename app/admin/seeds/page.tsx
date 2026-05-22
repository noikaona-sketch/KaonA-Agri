'use client';

import { useState }                    from 'react';
import { AdminWebShell }               from '@/shared/components/admin-web-shell';
import { AdminPickupSlots }            from '@/features/admin-seed-lots/admin-pickup-slots';
import { AdminIntakeQuota }            from '@/features/admin-seed-lots/admin-intake-quota';
import { AdminSeedVarieties }          from '@/features/admin-seed-varieties/admin-seed-varieties';
import { AdminSeedSuppliers }          from '@/features/admin-seed-suppliers/admin-seed-suppliers';
import { StockMovementPanel }          from '@/features/admin-stock-movements/stock-movement-panel';
import { AdminMarketPrice }            from '@/features/admin-appointments/admin-market-price';
import { AdminMoistureDeductions }     from '@/features/admin-appointments/admin-moisture-deductions';
import { AdminPromoList }              from '@/features/admin-appointments/admin-promo-list';
import { AdminProductsList }           from '@/features/admin-products/admin-products-list';

import { AdminPickupLocations }        from '@/features/admin-seed-lots/admin-pickup-locations';

type Tab = 'quota' | 'price' | 'deductions' | 'promos' | 'products' | 'movements' | 'pickup' | 'locations' | 'varieties' | 'suppliers';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'quota',      icon: '⚖️', label: 'โควต้ารับซื้อ' },
  { key: 'price',      icon: '💹', label: 'ราคารับซื้อ'   },
  { key: 'deductions', icon: '📉', label: 'ตารางส่วนลด'   },
  { key: 'promos',     icon: '🎁', label: 'โปรโมชั่น'     },
  { key: 'products',   icon: '🛍️', label: 'สินค้า'        },
  { key: 'movements',  icon: '📊', label: 'เคลื่อนไหว'    },
  { key: 'pickup',     icon: '📅', label: 'รอบรับสินค้า'   },
  { key: 'locations',  icon: '📍', label: 'จุดรับ'         },
  { key: 'varieties',  icon: '🌾', label: 'พันธุ์'         },
  { key: 'suppliers',  icon: '🏪', label: 'Supplier'       },
];

export default function AdminSeedsPage() {
  const [tab, setTab] = useState<Tab>('quota');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} เมล็ดพันธุ์ — ${cur.label}`} subtitle="โควต้ารับซื้อ ราคา โปรโมชั่น สินค้า และสต๊อก">
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap', borderBottom:'1px solid #e8ede8', paddingBottom:12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize:13, padding:'7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'quota'      && <AdminIntakeQuota />}
      {tab === 'price'      && <AdminMarketPrice />}
      {tab === 'deductions' && <AdminMoistureDeductions />}
      {tab === 'promos'     && <AdminPromoList />}
      {tab === 'products'   && <AdminProductsList />}
      {tab === 'movements'  && <StockMovementPanel />}
      {tab === 'pickup'     && <AdminPickupSlots />}
      {tab === 'locations'  && <AdminPickupLocations />}
      {tab === 'varieties'  && <AdminSeedVarieties />}
      {tab === 'suppliers'  && <AdminSeedSuppliers />}
    </AdminWebShell>
  );
}

'use client';

import { useState }                         from 'react';
import { AdminWebShell }                    from '@/shared/components/admin-web-shell';
import { SalesByProductReport }             from '@/features/admin-reports/sales-by-product-report';
import { StockSummaryReport }               from '@/features/admin-reports/stock-summary-report';
import { DailyStockMovementReport }         from '@/features/admin-reports/daily-stock-movement-report';
import { ByAreaReport }                     from '@/features/admin-reports/by-area-report';
import { ExpectedVsActualReport }           from '@/features/admin-reports/expected-vs-actual-report';
import { MemberSummaryReport }              from '@/features/admin-reports/member-summary-report';
import { BookingReport }                    from '@/features/admin-reports/booking-report';
import { ByVehicleReport }                  from '@/features/admin-reports/by-vehicle-report';

type Tab = 'members' | 'bookings' | 'sales' | 'stock' | 'stockMovement' | 'area' | 'accuracy' | 'vehicle';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'members',  icon: '👥', label: 'สมาชิก'        },
  { key: 'bookings', icon: '📅', label: 'การจองขาย'      },
  { key: 'accuracy', icon: '🎯', label: 'คาด vs จริง'    },
  { key: 'vehicle',  icon: '🚛', label: 'ตามรถ'          },
  { key: 'sales',    icon: '💰', label: 'ยอดขายสินค้า'   },
  { key: 'stock',    icon: '📦', label: 'สต็อก'          },
  { key: 'stockMovement', icon: '📊', label: 'เคลื่อนไหวรายวัน' },
  { key: 'area',     icon: '📍', label: 'ตามพื้นที่'      },
];

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>('members');
  const cur = TABS.find(t => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} รายงาน — ${cur.label}`} subtitle="ข้อมูลสมาชิก การจอง รับซื้อ และสต็อก">
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap', borderBottom:'1px solid #e8ede8', paddingBottom:12 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab===t.key?'admin-btn--primary':'admin-btn--secondary'}`}
            style={{ fontSize:13, padding:'7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'members'  && <MemberSummaryReport />}
      {tab === 'bookings' && <BookingReport />}
      {tab === 'accuracy' && <ExpectedVsActualReport />}
      {tab === 'vehicle'  && <ByVehicleReport />}
      {tab === 'sales'    && <SalesByProductReport />}
      {tab === 'stock'    && <StockSummaryReport />}
      {tab === 'stockMovement' && <DailyStockMovementReport />}
      {tab === 'area'     && <ByAreaReport />}
    </AdminWebShell>
  );
}

'use client';

import { useState }                    from 'react';
import { AdminWebShell }               from '@/shared/components/admin-web-shell';
import { SalesByProductReport }        from '@/features/admin-reports/sales-by-product-report';
import { StockSummaryReport }          from '@/features/admin-reports/stock-summary-report';
import { ByAreaReport }                from '@/features/admin-reports/by-area-report';

type Tab = 'sales' | 'stock' | 'area';
const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'sales', icon: '💰', label: 'ยอดขายตามสินค้า' },
  { key: 'stock', icon: '📦', label: 'สต็อกสินค้า'     },
  { key: 'area',  icon: '📍', label: 'ตามพื้นที่'       },
];

export default function AdminReportsPage() {
  const [tab, setTab] = useState<Tab>('sales');
  const cur = TABS.find((t) => t.key === tab)!;
  return (
    <AdminWebShell title={`${cur.icon} รายงาน — ${cur.label}`} subtitle="ยอดขาย สต็อก และการกระจายตามพื้นที่">
      <div style={{ display:'flex', gap:6, marginBottom:20, flexWrap:'wrap', borderBottom:'1px solid #e8ede8', paddingBottom:12 }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`admin-btn ${tab === t.key ? 'admin-btn--primary' : 'admin-btn--secondary'}`}
            style={{ fontSize:13, padding:'7px 14px' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {tab === 'sales' && <SalesByProductReport />}
      {tab === 'stock' && <StockSummaryReport />}
      {tab === 'area'  && <ByAreaReport />}
    </AdminWebShell>
  );
}

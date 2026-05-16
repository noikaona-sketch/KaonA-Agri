'use client';

type Props = {
  receipt: { order_no: string; total: number; change: number };
  mode: 'sale' | 'reservation';
  memberName: string;
  items: { name: string; qty: number; unit_price: number; isReservedSeed?: boolean }[];
  payMethod: string;
  cashReceived: string;
  onNew: () => void;
};

export function PosReceipt({ receipt, mode, memberName, items, payMethod, cashReceived, onNew }: Props) {
  function printBill(type: 'sale' | 'reservation') {
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    const isRes = type === 'reservation';
    const rows = items
      .filter((i) => isRes ? i.isReservedSeed : true)
      .map((i) => `<tr><td>${i.name}</td><td style="text-align:right">${i.qty}</td><td style="text-align:right">${(i.qty * i.unit_price).toLocaleString()}</td></tr>`)
      .join('');
    win.document.write(`
      <html><head><title>${isRes ? 'ใบจอง' : 'ใบขาย'} ${receipt.order_no}</title>
      <style>body{font-family:sans-serif;font-size:13px;padding:16px}table{width:100%;border-collapse:collapse}td{padding:4px 2px}hr{border:1px dashed #ccc}.total{font-size:16px;font-weight:900}</style></head>
      <body>
        <h3 style="text-align:center;margin:0">${isRes ? '📋 ใบจองสินค้า' : '🧾 ใบขายสินค้า'}</h3>
        <p style="text-align:center;margin:4px 0;font-size:11px">${new Date().toLocaleString('th-TH')}</p>
        <hr/>
        <p><strong>เลขที่:</strong> ${receipt.order_no}</p>
        <p><strong>ลูกค้า:</strong> ${memberName}</p>
        <hr/>
        <table><tr><th style="text-align:left">สินค้า</th><th style="text-align:right">จำนวน</th><th style="text-align:right">ราคา</th></tr>
        ${rows}</table>
        <hr/>
        <p class="total" style="text-align:right">รวม: ${receipt.total.toLocaleString()} บาท</p>
        ${!isRes && payMethod === 'cash' ? `<p style="text-align:right">รับ: ${Number(cashReceived).toLocaleString()} บาท</p><p style="text-align:right">ทอน: ${receipt.change.toLocaleString()} บาท</p>` : ''}
        <script>window.print();window.close();<\/script>
      </body></html>
    `);
    win.document.close();
  }

  const hasReservation = items.some((i) => i.isReservedSeed);

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 56 }}>{mode === 'sale' ? '🧾' : '📋'}</div>
        <h2 style={{ margin: '8px 0 4px', color: mode === 'sale' ? '#1b5e20' : '#1565c0' }}>ทำรายการสำเร็จ</h2>
        <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 16, fontWeight: 700 }}>{receipt.order_no}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{memberName}</p>
      </div>

      <div style={{ background: mode === 'sale' ? '#e8f5e9' : '#e3f2fd', borderRadius: 14, padding: 16, marginBottom: 16 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
            <span>{item.name} × {item.qty} {item.isReservedSeed ? '🔒' : ''}</span>
            <span style={{ fontWeight: 700 }}>{(item.qty * item.unit_price).toLocaleString()}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #aaa', paddingTop: 8, marginTop: 4, display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900 }}>
          <span>รวม</span><span>{receipt.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
        </div>
        {payMethod === 'cash' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, marginTop: 4 }}>
            <span>เงินทอน</span><span>{receipt.change.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={() => printBill('sale')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #1b5e20', background: '#fff', color: '#1b5e20', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          🖨️ พิมพ์ใบขาย
        </button>
        {hasReservation && (
          <button onClick={() => printBill('reservation')} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #1565c0', background: '#fff', color: '#1565c0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🖨️ พิมพ์ใบจอง
          </button>
        )}
      </div>

      <button onClick={onNew} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: mode === 'sale' ? '#1b5e20' : '#1565c0', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        ✅ ทำรายการใหม่
      </button>
    </div>
  );
}

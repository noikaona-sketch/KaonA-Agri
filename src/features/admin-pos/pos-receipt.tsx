'use client';

const SHOP_NAME = 'KaonA Agri';
const SHOP_TEL  = '';

type ReceiptItem = { name: string; qty: number; unit_price: number; unit?: string; isReservedSeed?: boolean };

type Props = {
  receipt: { order_no: string; total: number; change: number };
  mode: 'sale' | 'reservation';
  memberName: string;
  memberPhone: string | null;
  items: ReceiptItem[];
  payMethod: string;
  cashReceived: string;
  discount: number;
  resNote: string | null;
  resChannel: string | null;
  reservationNo: string | null;
  reservationStatus: string | null;
  qtyReserved: number | null;
  qtySold: number | null;
  pickupDate: string | null;
  onNew: () => void;
};

const PAY_LABEL: Record<string, string> = { cash: 'เงินสด', transfer: 'โอนเงิน', credit: 'เครดิต' };

// ── ตัดสินใจประเภทใบ ───────────────────────────────────────────────────────
// จ่ายเงินสด/โอน → ใบเสร็จรับเงิน (ไม่ว่าจะจองหรือขาย)
// ไม่จ่าย (credit / จองล้วนๆ) → ใบจอง
function docType(mode: 'sale' | 'reservation', payMethod: string, printAs: 'sale' | 'reservation'): 'receipt' | 'reservation' {
  if (printAs === 'reservation') return 'reservation';
  if (mode === 'reservation' && payMethod === 'credit') return 'reservation';
  return 'receipt';
}

function buildHtml(props: Omit<Props,'onNew'>, printAs: 'sale' | 'reservation'): string {
  const { receipt, mode, memberName, memberPhone, items, payMethod, cashReceived, discount,
          resNote, resChannel, reservationNo, reservationStatus, qtyReserved, qtySold, pickupDate } = props;

  const doc        = docType(mode, payMethod, printAs);
  const isReceipt  = doc === 'receipt';
  const isRes      = doc === 'reservation';
  const paidCash   = payMethod === 'cash';
  const printItems = printAs === 'reservation' ? items.filter((i) => i.isReservedSeed) : items;
  const subtotal   = printItems.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const total      = Math.max(0, subtotal - (isReceipt ? discount : 0));
  const paidAmt    = paidCash ? Number(cashReceived) : (isReceipt ? total : 0);
  const changeAmt  = paidCash ? Math.max(0, paidAmt - total) : 0;
  const now        = new Date().toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

  // สถานะจอง
  const qtyPending = (qtyReserved ?? 0) - (qtySold ?? 0);
  const resStatusBadge = reservationStatus === 'ครบ'
    ? `<span style="background:#1b5e20;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">✅ รับครบแล้ว</span>`
    : reservationStatus === 'ค้าง'
    ? `<span style="background:#e65100;color:#fff;padding:2px 8px;border-radius:4px;font-size:11px">⏳ ค้างรับ ${qtyPending} ถุง</span>`
    : '';

  const itemRows = printItems.map((i) => `
    <tr>
      <td>${i.name}${i.isReservedSeed ? ' <span style="font-size:10px;color:#1b5e20;border:1px solid #1b5e20;border-radius:3px;padding:0 3px">จอง</span>' : ''}</td>
      <td style="text-align:center">${i.qty} ${i.unit ?? 'ถุง'}</td>
      <td style="text-align:right">${i.unit_price.toLocaleString()}</td>
      <td style="text-align:right;font-weight:700">${(i.qty * i.unit_price).toLocaleString()}</td>
    </tr>`).join('');

  // หัวใบ
  const docTitle   = isReceipt ? '🧾 ใบเสร็จรับเงิน' : '📋 ใบจองสินค้า';
  const docColor   = isReceipt ? '#1b5e20' : '#1565c0';
  const docWarning = isRes
    ? `<div style="text-align:center;font-size:11px;color:#1565c0;border:2px dashed #1565c0;border-radius:6px;padding:4px;margin:6px 0;font-weight:700;">⚠️ ใบจองสินค้า — ยังไม่ใช่ใบเสร็จรับเงิน</div>`
    : mode === 'reservation' && isReceipt && qtyPending > 0
    ? `<div style="text-align:center;font-size:11px;color:#e65100;border:2px dashed #e65100;border-radius:6px;padding:4px;margin:6px 0;font-weight:700;">⏳ ชำระแล้ว — ค้างรับสินค้าอีก ${qtyPending} ถุง</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="th"><head>
<meta charset="UTF-8"/>
<title>${docTitle} ${receipt.order_no}</title>
<style>
  @page { size: A5; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Sarabun','Tahoma',sans-serif; font-size: 13px; color: #111; margin: 0; }
  .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 8px; }
  .header h2 { margin: 0 0 2px; font-size: 18px; }
  .header h3 { margin: 0; font-size: 16px; color: ${docColor}; font-weight: 900; letter-spacing: 1px; }
  .meta { font-size: 12px; margin-bottom: 8px; line-height: 1.7; }
  .meta .row { display: flex; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0; }
  thead tr { border-top: 1.5px solid #111; border-bottom: 1.5px solid #111; }
  th { font-size: 12px; padding: 4px 2px; font-weight: 700; }
  td { font-size: 13px; padding: 4px 2px; vertical-align: top; }
  tbody tr:last-child td { border-bottom: 1.5px solid #111; }
  .totals .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
  .totals .grand { font-size: 18px; font-weight: 900; border-top: 2px solid #111; padding-top: 6px; margin-top: 4px; color: ${docColor}; }
  .quota-box { background: #f0faf0; border: 1px solid #a5d6a7; border-radius: 6px; padding: 8px 10px; margin-top: 8px; font-size: 12px; line-height: 1.8; }
  .pending-box { background: #fff8e1; border: 1px solid #ffe082; border-radius: 6px; padding: 8px 10px; margin-top: 8px; font-size: 12px; font-weight: 700; color: #e65100; }
  .footer { text-align: center; margin-top: 14px; font-size: 11px; color: #666; border-top: 1px dashed #aaa; padding-top: 8px; }
</style>
</head><body>

<div class="header">
  <h2>${SHOP_NAME}</h2>
  ${SHOP_TEL ? `<p style="margin:2px 0;font-size:12px">โทร ${SHOP_TEL}</p>` : ''}
  <h3>${docTitle}</h3>
</div>

${docWarning}

<div class="meta">
  <div class="row"><span><strong>เลขที่:</strong> ${receipt.order_no}</span><span>${now}</span></div>
  <div class="row"><strong>ลูกค้า:</strong><span>${memberName}</span></div>
  ${memberPhone  ? `<div class="row"><strong>เบอร์:</strong><span>${memberPhone}</span></div>` : ''}
  ${resChannel   ? `<div class="row"><strong>ช่องทาง:</strong><span>${resChannel}</span></div>` : ''}
  ${reservationNo ? `<div class="row"><strong>เลขจอง:</strong><span>${reservationNo} &nbsp;${resStatusBadge}</span></div>` : ''}
  ${pickupDate   ? `<div class="row"><strong>วันนัดรับ:</strong><span style="color:#1565c0;font-weight:700">${pickupDate}</span></div>` : ''}
  ${resNote      ? `<div class="row"><strong>หมายเหตุ:</strong><span>${resNote}</span></div>` : ''}
</div>

<table>
  <thead><tr>
    <th style="text-align:left">สินค้า</th>
    <th style="text-align:center">จำนวน</th>
    <th style="text-align:right">ราคา/หน่วย</th>
    <th style="text-align:right">รวม (บาท)</th>
  </tr></thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="totals">
  ${discount > 0 && isReceipt ? `<div class="row"><span>ส่วนลด</span><span>−${discount.toLocaleString()}</span></div>` : ''}
  <div class="row grand"><span>${isReceipt ? 'ยอดชำระ' : 'ยอดจอง'}</span><span>${total.toLocaleString('th-TH',{minimumFractionDigits:2})} บาท</span></div>
  ${isReceipt ? `<div class="row"><span>ชำระด้วย</span><span>${PAY_LABEL[payMethod] ?? payMethod}</span></div>` : ''}
  ${isReceipt && paidCash ? `
  <div class="row"><span>รับเงิน</span><span>${paidAmt.toLocaleString()} บาท</span></div>
  <div class="row" style="font-weight:700"><span>เงินทอน</span><span>${changeAmt.toLocaleString('th-TH',{minimumFractionDigits:2})} บาท</span></div>` : ''}
</div>

${qtyReserved != null ? `
<div class="quota-box">
  <strong>โควต้าการจอง</strong><br/>
  จองทั้งหมด: <strong>${qtyReserved} ถุง</strong> &nbsp;·&nbsp;
  รับไปแล้ว: <strong>${qtySold ?? 0} ถุง</strong> &nbsp;·&nbsp;
  ค้างรับ: <strong>${qtyPending} ถุง</strong>
  ${qtyPending > 0 ? `<br/><span style="color:#e65100">⏳ กรุณาติดต่อร้านเพื่อรับสินค้าส่วนที่เหลือ</span>` : `<br/><span style="color:#1b5e20">✅ รับสินค้าครบแล้ว</span>`}
</div>` : ''}

${isRes && qtyPending > 0 ? `
<div class="pending-box">
  ⏳ ค้างรับสินค้า ${qtyPending} ถุง — กรุณานำใบจองนี้มาแสดงเมื่อมารับสินค้า
</div>` : ''}

${resNote ? `<div style="border:1px solid #e0e0e0;border-radius:6px;padding:6px 10px;margin-top:8px;font-size:12px">📝 ${resNote}</div>` : ''}

<div class="footer">
  ${isReceipt ? 'ขอบคุณที่ใช้บริการ — ใบเสร็จนี้ใช้เป็นหลักฐานการชำระเงิน' : 'กรุณานำใบจองนี้มาแสดงเมื่อมารับสินค้า'}<br/>
  ${SHOP_NAME}${SHOP_TEL ? ` โทร ${SHOP_TEL}` : ''}
</div>

<script>window.onload=function(){window.print();}<\/script>
</body></html>`;
}

export function PosReceipt(props: Props) {
  const { receipt, mode, memberName, memberPhone, items, payMethod, cashReceived,
          discount, resNote, resChannel, reservationNo, reservationStatus,
          qtyReserved, qtySold, pickupDate, onNew } = props;

  const paidCash      = payMethod === 'cash';
  const qtyPending    = (qtyReserved ?? 0) - (qtySold ?? 0);
  const isActuallyPaid = payMethod === 'cash' || payMethod === 'transfer';
  const modeColor     = mode === 'sale' ? '#1b5e20' : '#1565c0';
  const modeBg        = mode === 'sale' ? '#e8f5e9' : '#e3f2fd';
  const hasReservation = items.some((i) => i.isReservedSeed);

  function printBill(printAs: 'sale' | 'reservation') {
    const win = window.open('', '_blank', 'width=620,height=820');
    if (!win) return;
    win.document.write(buildHtml(props, printAs));
    win.document.close();
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 24 }}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 52 }}>{mode === 'sale' ? '🧾' : '📋'}</div>
        <h2 style={{ margin: '6px 0 2px', color: modeColor }}>ทำรายการสำเร็จ</h2>
        <p style={{ margin: 0, fontFamily: 'monospace', fontSize: 15, fontWeight: 700 }}>{receipt.order_no}</p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
          {memberName}{memberPhone ? ` · ${memberPhone}` : ''}
        </p>
      </div>

      {/* สถานะการจอง */}
      {reservationNo && (
        <div style={{ background: reservationStatus === 'ครบ' ? '#e8f5e9' : '#fff8e1', border: `1px solid ${reservationStatus === 'ครบ' ? '#a5d6a7' : '#ffe082'}`, borderRadius: 10, padding: '8px 14px', marginBottom: 10, fontSize: 13 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>ใบจอง: {reservationNo}</p>
          {pickupDate && <p style={{ margin: '3px 0 0', fontSize: 12, color: '#1565c0', fontWeight: 700 }}>📅 นัดรับ: {pickupDate}</p>}
          {qtyReserved != null && (
            <p style={{ margin: '4px 0 0', fontSize: 12 }}>
              โควต้า {qtyReserved} ถุง · รับแล้ว {qtySold ?? 0} ถุง · ค้างรับ {qtyPending} ถุง
              &nbsp;
              {qtyPending <= 0
                ? <span style={{ background: '#1b5e20', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>✅ ครบแล้ว</span>
                : <span style={{ background: '#e65100', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>⏳ ค้างรับ</span>}
            </p>
          )}
        </div>
      )}

      {/* แถบแจ้ง: ค้างรับสินค้า */}
      {mode === 'reservation' && isActuallyPaid && qtyPending > 0 && (
        <div style={{ background: '#fff3e0', border: '1.5px solid #ffb74d', borderRadius: 10, padding: '10px 14px', marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#e65100' }}>
          ⏳ ชำระเงินแล้ว — ค้างรับสินค้าอีก {qtyPending} ถุง
        </div>
      )}

      {/* รายการ */}
      <div style={{ background: modeBg, borderRadius: 12, padding: 14, marginBottom: 12 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
            <span style={{ flex: 1 }}>
              {item.name} {item.isReservedSeed ? '🔒' : ''}
              <br/><span style={{ fontSize: 11, color: '#6b7280' }}>{item.qty} {item.unit ?? 'ถุง'} × {item.unit_price.toLocaleString()}</span>
            </span>
            <span style={{ fontWeight: 700, marginLeft: 8 }}>{(item.qty * item.unit_price).toLocaleString()}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px dashed #aaa', paddingTop: 6, marginTop: 4 }}>
          {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#c62828' }}><span>ส่วนลด</span><span>−{discount.toLocaleString()}</span></div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 900, color: modeColor }}>
            <span>รวม</span><span>{receipt.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span>
          </div>
          {paidCash && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, marginTop: 2 }}><span>เงินทอน</span><span>{receipt.change.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</span></div>}
        </div>
      </div>

      {resNote && <div style={{ background: '#fffde7', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12, borderLeft: '3px solid #f9a825' }}>📝 {resNote}</div>}

      {/* ปุ่มพิมพ์ */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button onClick={() => printBill('sale')}
          style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #1b5e20', background: '#fff', color: '#1b5e20', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          🖨️ {isActuallyPaid ? 'ใบเสร็จรับเงิน' : 'ใบรับเงิน'} (A5)
        </button>
        {hasReservation && (
          <button onClick={() => printBill('reservation')}
            style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #1565c0', background: '#fff', color: '#1565c0', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            🖨️ ใบจองสินค้า (A5)
          </button>
        )}
      </div>

      <button onClick={onNew} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: modeColor, color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
        ✅ ทำรายการใหม่
      </button>
    </div>
  );
}

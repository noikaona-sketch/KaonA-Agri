// src/lib/intake/send-intake-receipt.ts
// ส่ง LINE push แจ้ง farmer หลังรับซื้อสำเร็จ — fail silently เสมอ

import { sendLineMessage } from '@/lib/line/push-message';
import type { IntakeResult } from './calculate-intake';

const fmt = (n: number) =>
  n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export async function sendIntakeReceipt(params: {
  lineUid       : string
  result        : IntakeResult
  bookingId     : string
  scaleTicketNo?: string
  locationName? : string
}): Promise<void> {
  const { lineUid, result, scaleTicketNo, locationName } = params;

  const bonusLines = result.applied_promos
    .filter((p) => p.applied)
    .map((p) => `  🎁 ${p.title}: +${p.promo_bonus_per_kg.toFixed(2)} บาท/กก.`)
    .join('\n');

  const lines = [
    `✅ รับซื้อข้าวโพดสำเร็จ`,
    locationName ? `📍 ${locationName}` : '',
    scaleTicketNo ? `🎫 ใบชั่ง: ${scaleTicketNo}` : '',
    '',
    `⚖️ น้ำหนักรวม:  ${fmt(result.gross_weight_kg)} กก.`,
    `   หัก ${result.deduct_pct}%:   -${fmt(result.deduct_kg)} กก.`,
    `   น้ำหนักสุทธิ: ${fmt(result.net_weight_kg)} กก.`,
    '',
    `💰 ราคา: ${result.final_price.toFixed(4)} บาท/กก.`,
    bonusLines ? bonusLines : '',
    '',
    `💵 ยอดที่จะได้รับ`,
    `   ฿${fmt(result.net_amount)}`,
  ].filter(Boolean).join('\n');

  await sendLineMessage(lineUid, [{ type: 'text', text: lines }]).catch(
    (err: unknown) => console.error('[sendIntakeReceipt] LINE push failed:', err)
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LINE Push Message helper
// ใช้ LINE Messaging API ส่งข้อความหา farmer โดยตรงใน LINE
//
// ต้องการ env: LINE_CHANNEL_ACCESS_TOKEN
// ถ้าไม่มี token → log warning แต่ไม่ throw (fail silently)
// ─────────────────────────────────────────────────────────────────────────────

export type LineTextMessage = {
  type: 'text';
  text: string;
};

export type LineMessage = LineTextMessage;

/**
 * ส่ง LINE push message หา user คนเดียว
 * @param lineUserId  line_user_id จาก members table (เริ่มต้นด้วย U...)
 * @param messages    ข้อความที่จะส่ง (max 5 ข้อความต่อครั้ง)
 */
export async function sendLineMessage(
  lineUserId: string | null | undefined,
  messages: LineMessage[],
): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  if (!token) {
    console.warn('[LINE Push] LINE_CHANNEL_ACCESS_TOKEN not set — skipping push');
    return { ok: false, error: 'LINE_CHANNEL_ACCESS_TOKEN not configured' };
  }

  if (!lineUserId) {
    console.warn('[LINE Push] No line_user_id — skipping push');
    return { ok: false, error: 'No line_user_id' };
  }

  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ to: lineUserId, messages }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error('[LINE Push] Failed:', res.status, detail);
      return { ok: false, error: `LINE API ${res.status}: ${detail}` };
    }

    return { ok: true };
  } catch (err) {
    console.error('[LINE Push] Exception:', err);
    return { ok: false, error: String(err) };
  }
}

// ─── ข้อความสำเร็จรูปสำหรับ seed reservation ────────────────────────────────

export function seedConfirmedMessage(reservationNo: string, productName: string, qty: number, unit: string, pickupDate: string | null): LineMessage {
  const pickup = pickupDate ? `\n📅 วันนัดรับ: ${pickupDate}` : '';
  return {
    type: 'text',
    text: `✅ ยืนยันการจองเมล็ดพันธุ์แล้ว\n\nเลขที่จอง: ${reservationNo}\nสินค้า: ${productName}\nจำนวน: ${qty} ${unit}${pickup}\n\nกรุณาติดต่อเจ้าหน้าที่เพื่อรับสินค้าตามวันนัด 🌽`,
  };
}

export function seedCancelledMessage(reservationNo: string, reason?: string | null): LineMessage {
  const reasonText = reason ? `\nเหตุผล: ${reason}` : '';
  return {
    type: 'text',
    text: `⛔ การจองเมล็ดพันธุ์ถูกยกเลิก\n\nเลขที่จอง: ${reservationNo}${reasonText}\n\nหากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่`,
  };
}

// ── Z7-3: Message Templates ──────────────────────────────────────────────────

export function memberApprovedMessage(memberName: string): LineMessage {
  return { type:'text', text:`✅ ยินดีด้วย! ${memberName}\nบัญชีสมาชิก KaonA ของคุณได้รับการอนุมัติแล้ว\nเปิดแอปเพื่อเริ่มใช้งานได้เลยค่ะ 🌽` };
}

export function memberRejectedMessage(memberName: string, reason?: string): LineMessage {
  return { type:'text', text:[
    `❌ ขออภัย ${memberName}`,
    `บัญชีสมาชิก KaonA ของคุณยังไม่ได้รับการอนุมัติ`,
    reason ? `เหตุผล: ${reason}` : '',
    `\nกรุณาติดต่อเจ้าหน้าที่เพื่อข้อมูลเพิ่มเติม`,
  ].filter(Boolean).join('\n') };
}

export function intakeReceiptMessage(netKg: number, netAmount: number, bonusAmount: number, locationName?: string): LineMessage {
  const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 0 });
  return { type:'text', text:[
    `✅ รับซื้อข้าวโพดสำเร็จ${locationName ? ` · ${locationName}` : ''}`,
    `⚖️ น้ำหนักสุทธิ: ${fmt(netKg)} กก.`,
    bonusAmount > 0 ? `🎁 โบนัส: +฿${fmt(bonusAmount)}` : '',
    `💵 ยอดที่จะได้รับ: ฿${fmt(netAmount)}`,
  ].filter(Boolean).join('\n') };
}

export function quotaAlmostFullMessage(locationName: string, remainingKg: number): LineMessage {
  return { type:'text', text:`⚠️ โควต้ารับซื้อที่ ${locationName} ใกล้เต็มแล้ว\nเหลืออีกประมาณ ${(remainingKg/1000).toFixed(1)} ตัน\nรีบจองคิวก่อนเต็มนะคะ` };
}

export function noBurnApprovedMessage(bonusPerKg?: number): LineMessage {
  return { type:'text', text:[
    `🌿 ยินดีด้วย! คำขอโครงการไม่เผาตอซังได้รับการอนุมัติแล้ว`,
    bonusPerKg ? `โบนัส: +${bonusPerKg.toFixed(2)} บาท/กก. เมื่อขายผลผลิต` : '',
    `ขอบคุณที่ร่วมรักษาสิ่งแวดล้อมค่ะ 💚`,
  ].filter(Boolean).join('\n') };
}

export function noBurnRejectedMessage(reason?: string): LineMessage {
  return { type:'text', text:[
    `❌ ขออภัย คำขอโครงการไม่เผาตอซังยังไม่ผ่านการอนุมัติ`,
    reason ? `เหตุผล: ${reason}` : '',
    `กรุณาติดต่อเจ้าหน้าที่เพื่อข้อมูลเพิ่มเติม`,
  ].filter(Boolean).join('\n') };
}

export function inspectionAssignedMessage(plotName: string, farmerName: string, province?: string | null): LineMessage {
  return { type:'text', text:[
    `📋 คุณมีงานตรวจแปลงใหม่`,
    `🌱 แปลง: ${plotName}${province ? ` (${province})` : ''}`,
    `👤 เกษตรกร: ${farmerName}`,
    `\nแตะที่แอปเพื่อดูรายละเอียดและบันทึกผลการตรวจ`,
  ].join('\n') };
}

export function harvestBookingConfirmedMessage(scheduledDate: string, locationName: string): LineMessage {
  const d = new Date(scheduledDate).toLocaleDateString('th-TH', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  return { type:'text', text:`✅ ยืนยันการจองขายผลผลิต\n📅 วัน: ${d}\n📍 จุดรับ: ${locationName}\nกรุณามาตามวันเวลาที่นัดค่ะ 🌽` };
}

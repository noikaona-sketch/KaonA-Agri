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

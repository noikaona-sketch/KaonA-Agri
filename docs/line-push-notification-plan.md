# LINE Push Notification — แผนงาน

## สิ่งที่ต้องเตรียม (ทำก่อนเขียนโค้ด)

1. ไปที่ https://developers.line.biz
2. Provider: CornFarmer → Channel: Kaona_Corn (Messaging API)
3. แถบ Messaging API → "Channel access token (long-lived)" → กด Issue
4. Copy token → ใส่ใน Vercel env ชื่อ `LINE_CHANNEL_ACCESS_TOKEN`

## โค้ดที่ต้องสร้าง

### 1. Helper function (สร้างครั้งเดียวใช้ทุกที่)
`src/lib/line/push-message.ts`
- ฟังก์ชัน `sendLineMessage(lineUserId, messages[])`
- เรียก LINE Messaging API: `POST https://api.line.me/v2/bot/message/push`

### 2. จุดที่ต้องเพิ่ม notification

| เหตุการณ์ | ไฟล์ | ข้อความที่ส่ง |
|---|---|---|
| อนุมัติสมาชิก | `app/api/admin/members/approvals/route.ts` | "✅ ยินดีด้วย! คุณได้รับการอนุมัติเป็นสมาชิก KaonA แล้ว" |
| ปฏิเสธสมาชิก | เดียวกัน | "❌ คำขอสมัครสมาชิกไม่ผ่านการอนุมัติ เหตุผล: ..." |
| ส่งกลับแก้ไข | เดียวกัน | "📋 กรุณาแก้ไขข้อมูลและส่งใหม่ เหตุผล: ..." |
| ส่งคำขอไม่เผาสำเร็จ | `app/api/member/no-burn/route.ts` | "📸 รับคำขอโครงการไม่เผาตอซังแล้ว รอเจ้าหน้าที่ตรวจสอบ" |
| ลงทะเบียนแปลงสำเร็จ | `app/api/member/plot-registration/route.ts` | "🌱 บันทึกข้อมูลแปลงสำเร็จแล้ว" |

## หมายเหตุ
- Push notification ใช้ `line_user_id` ของเกษตรกร (มีอยู่ใน `members` table แล้ว)
- ถ้าไม่มี `LINE_CHANNEL_ACCESS_TOKEN` ใน env → log warning แต่ไม่ให้ระบบพัง (fail silently)
- Free tier LINE Messaging API: 200 push messages/เดือน (ถ้าต้องการมากกว่านี้ต้องซื้อ plan)

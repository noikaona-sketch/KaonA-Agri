import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.0-flash';

const SYSTEM_PROMPT = `คุณคือระบบ OCR อ่านบัตรประชาชนไทย
อ่านข้อมูลจากรูปภาพและส่งออกเป็น JSON เท่านั้น ไม่มีข้อความอื่น

format:
{
  "fullName": "ชื่อ-นามสกุลภาษาไทย",
  "fullNameEn": "FIRSTNAME LASTNAME ภาษาอังกฤษ",
  "citizenId": "เลขบัตร 13 หลัก ตัวเลขเท่านั้น",
  "dateOfBirth": "วัน เดือน ปี พ.ศ.",
  "address": "ที่อยู่เต็ม",
  "houseNo": "บ้านเลขที่",
  "moo": "หมู่ที่",
  "subdistrict": "ตำบล/แขวง",
  "district": "อำเภอ/เขต",
  "province": "จังหวัด",
  "confidence": 0.95
}
ถ้าอ่านไม่ได้ใส่ "" ตอบ JSON เท่านั้น`;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('idImage');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing ID image' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY ยังไม่ได้ตั้งค่า — กรุณากรอกด้วยตนเอง' }, { status: 503 });
    }

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: SYSTEM_PROMPT },
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
          ]}],
          generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
        }),
      }
    );

    if (!res.ok) {
      console.error('[OCR_GEMINI]', await res.text());
      return NextResponse.json({ error: 'Gemini API error' }, { status: 500 });
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();

    let ext: Record<string, string | number>;
    try { ext = JSON.parse(clean) as Record<string, string | number>; }
    catch {
      console.error('[OCR_GEMINI] parse failed:', raw);
      return NextResponse.json({ error: 'อ่านบัตรไม่สำเร็จ กรุณากรอกด้วยตนเอง' }, { status: 422 });
    }

    if (!ext.citizenId && !ext.fullName) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลบัตร กรุณากรอกด้วยตนเอง' }, { status: 422 });
    }

    return NextResponse.json({
      extracted: {
        fullName:    ext.fullName    ?? '',
        fullNameEn:  ext.fullNameEn  ?? '',
        citizenId:   String(ext.citizenId ?? '').replace(/\D/g, ''),
        dateOfBirth: ext.dateOfBirth ?? '',
        address:     ext.address     ?? '',
        houseNo:     ext.houseNo     ?? '',
        moo:         String(ext.moo  ?? ''),
        subdistrict: ext.subdistrict ?? '',
        district:    ext.district    ?? '',
        province:    ext.province    ?? '',
      },
      confidence: Math.round(Number(ext.confidence ?? 0.8) * 100),
    });
  } catch (e) {
    console.error('[OCR_ID_CARD]', e);
    return NextResponse.json({ error: 'OCR processing failed' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';

import { processDocumentAI } from '../google-documentai';

// OCR สำหรับเอกสารทั่วไป: บัตรเกษตรกร, โฉนด, ทะเบียนรถ
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('document');
    const docType = (form.get('docType') as string) ?? 'other';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing document file' }, { status: 400 });
    }

    const configured =
      process.env.GOOGLE_CLOUD_PROJECT_ID &&
      process.env.GOOGLE_DOCUMENTAI_CLIENT_EMAIL &&
      process.env.GOOGLE_DOCUMENTAI_PRIVATE_KEY &&
      process.env.GOOGLE_DOCUMENTAI_PROCESSOR_ID;

    if (!configured) {
      return NextResponse.json({ error: 'OCR service is not configured' }, { status: 503 });
    }

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const result = await processDocumentAI(imageBase64, mimeType);

    // ดึง text แล้วให้ frontend แสดงให้ user ตรวจสอบ
    return NextResponse.json({
      docType,
      rawText: result.text,
      entities: result.entities,
      confidence: Math.round(result.confidence * 100),
    });
  } catch (error) {
    console.error('[OCR_DOCUMENT]', error);
    return NextResponse.json({ error: 'OCR processing failed — กรุณากรอกด้วยตนเอง' }, { status: 500 });
  }
}

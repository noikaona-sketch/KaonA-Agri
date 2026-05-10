import { NextResponse } from 'next/server';

type OcrExtracted = {
  fullName: string;
  citizenId: string;
  address: string;
};

function parseIdCardText(rawText: string): OcrExtracted | null {
  const compact = rawText.replace(/\s+/g, ' ').trim();
  const idMatch = compact.match(/(?:\d[ -]?){13}/);

  if (!idMatch) {
    return null;
  }

  const citizenId = idMatch[0].replace(/\D/g, '').slice(0, 13);
  const lines = rawText.split('\n').map((line) => line.trim()).filter(Boolean);
  const fullName = lines.find((line) => /นาย|นาง|นางสาว/.test(line)) ?? '';
  const address = lines.find((line) => /หมู่|ตำบล|อำเภอ|จังหวัด/.test(line)) ?? '';

  return { fullName, citizenId, address };
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get('idImage');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing ID image' }, { status: 400 });
    }

    const ocrApiKey = process.env.OCR_API_KEY;

    if (!ocrApiKey) {
      return NextResponse.json({ error: 'OCR service is not configured' }, { status: 503 });
    }

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');

    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        apikey: ocrApiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        base64Image: `data:${file.type};base64,${imageBase64}`,
        language: 'tha',
      }),
    });

    if (!ocrResponse.ok) {
      return NextResponse.json({ error: 'OCR provider request failed' }, { status: 502 });
    }

    const ocrPayload = (await ocrResponse.json()) as {
      IsErroredOnProcessing?: boolean;
      ParsedResults?: Array<{ ParsedText?: string }>;
    };

    if (ocrPayload.IsErroredOnProcessing) {
      return NextResponse.json({ error: 'OCR processing failed' }, { status: 422 });
    }

    const parsedText = ocrPayload.ParsedResults?.[0]?.ParsedText ?? '';
    const extracted = parseIdCardText(parsedText);

    if (!extracted) {
      return NextResponse.json({ error: 'Unable to extract ID fields' }, { status: 422 });
    }

    return NextResponse.json({ extracted });
  } catch {
    return NextResponse.json({ error: 'Unexpected OCR failure' }, { status: 500 });
  }
}

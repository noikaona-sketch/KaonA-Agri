import { NextResponse } from 'next/server';

// ── Document AI OCR (migrate จาก K_farm/api/ocr-documentai.ts) ──────────────

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function createAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_DOCUMENTAI_CLIENT_EMAIL;
  const privateKey  = process.env.GOOGLE_DOCUMENTAI_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey)
    throw new Error('Missing GOOGLE_DOCUMENTAI_CLIENT_EMAIL or GOOGLE_DOCUMENTAI_PRIVATE_KEY');

  const now    = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim  = base64UrlEncode(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600, iat: now,
  }));
  const data      = `${header}.${claim}`;
  const crypto    = await import('crypto');
  const signature = crypto.createSign('RSA-SHA256').update(data).sign(privateKey, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const jwt = `${data}.${signature}`;

  const tokenRes  = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!tokenRes.ok) throw new Error(tokenJson.error_description ?? tokenJson.error ?? 'Failed to get access token');
  return String(tokenJson.access_token);
}

function cleanSpaces(s: string) { return s.replace(/\s+/g, ' ').trim(); }

function cutBeforeMarkers(text: string, markers: string[]) {
  let end = text.length;
  for (const marker of markers) {
    const idx = text.toLowerCase().indexOf(marker.toLowerCase());
    if (idx >= 0 && idx < end) end = idx;
  }
  return text.slice(0, end).trim();
}

function stripDatesFromAddress(address: string) {
  return cleanSpaces(address)
    .replace(/\s*\d{1,2}\s*(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*\d{4}.*$/i, '')
    .replace(/\s*\d{1,2}\s*(?:Jan\.?|Feb\.?|Mar\.?|Apr\.?|May|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Oct\.?|Nov\.?|Dec\.?)\s*\d{4}.*$/i, '')
    .trim();
}

function extractDateAfter(text: string, markers: string[]): string {
  const compact     = cleanSpaces(text);
  const datePattern = '(\\d{1,2}\\s*(?:ม\\.ค\\.|ก\\.พ\\.|มี\\.ค\\.|เม\\.ย\\.|พ\\.ค\\.|มิ\\.ย\\.|ก\\.ค\\.|ส\\.ค\\.|ก\\.ย\\.|ต\\.ค\\.|พ\\.ย\\.|ธ\\.ค\\.|Jan\\.?|Feb\\.?|Mar\\.?|Apr\\.?|May|Jun\\.?|Jul\\.?|Aug\\.?|Sep\\.?|Oct\\.?|Nov\\.?|Dec\\.?)\\s*\\d{4})';
  for (const marker of markers) {
    const re = new RegExp(`${datePattern}\\s*${marker}|${marker}\\s*${datePattern}`, 'i');
    const m  = compact.match(re);
    if (m) return cleanSpaces(m[1] ?? m[2] ?? '');
  }
  return '';
}

function extractAddress(compact: string): string {
  let start = -1;
  for (const marker of ['ที่อยู่', 'Address']) {
    const idx = compact.toLowerCase().indexOf(marker.toLowerCase());
    if (idx >= 0 && (start < 0 || idx < start)) start = idx;
  }
  if (start < 0) return '';
  let address = compact.slice(start).replace(/^ที่อยู่\s*/i, '').replace(/^Address\s*/i, '').trim();
  address = cutBeforeMarkers(address, ['วันออกบัตร','Date of Issue','วันบัตรหมดอายุ','Date of Expiry','เจ้าพนักงานออกบัตร','กระทรวงมหาดไทย']);
  return stripDatesFromAddress(address);
}

function parseText(text: string) {
  const compact      = cleanSpaces(text);
  const idMatch      = compact.match(/\b\d[\d\s-]{11,20}\d\b/);
  const citizenId    = idMatch ? idMatch[0].replace(/\D/g, '').slice(0, 13) : '';
  const lines        = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const nameLine     = lines.find(l =>
    /นาย|นางสาว|นาง|Mr\.?|Mrs\.?|Miss/i.test(l) &&
    !/เลข|บัตร|identification|address|date|เกิด|ออกบัตร|หมดอายุ/i.test(l)
  ) ?? '';
  const address      = extractAddress(compact);
  const province     = (address.match(/(?:จังหวัด|จ\.)\s*([^\s]+)/) ?? compact.match(/(?:จังหวัด|จ\.)\s*([^\s]+)/))?.[1] ?? '';
  const district     = (address.match(/(?:อำเภอ|อ\.|เขต)\s*([^\s]+)/) ?? compact.match(/(?:อำเภอ|อ\.|เขต)\s*([^\s]+)/))?.[1] ?? '';
  const subdistrict  = (address.match(/(?:ตำบล|ต\.|แขวง)\s*([^\s]+)/) ?? compact.match(/(?:ตำบล|ต\.|แขวง)\s*([^\s]+)/))?.[1] ?? '';
  return {
    fullName:    nameLine.replace(/^(ชื่อ|Name|Thai Name)\s*[:：]?\s*/i, '').trim(),
    citizenId,
    address, province, district, subdistrict,
    dateOfBirth: '',
    expiryDate:  extractDateAfter(compact, ['วันบัตรหมดอายุ', 'Date of Expiry']),
    issueDate:   extractDateAfter(compact, ['วันออกบัตร', 'Date of Issue']),
  };
}

export async function POST(request: Request) {
  try {
    const projectId   = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location    = process.env.GOOGLE_DOCUMENTAI_LOCATION ?? 'us';
    const processorId = process.env.GOOGLE_DOCUMENTAI_PROCESSOR_ID;

    if (!projectId || !processorId)
      return NextResponse.json({ error: 'Missing Document AI config' }, { status: 503 });

    const form = await request.formData();
    const file = form.get('idImage');
    if (!(file instanceof File))
      return NextResponse.json({ error: 'Missing ID image' }, { status: 400 });

    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const mimeType    = file.type || 'image/jpeg';

    const token    = await createAccessToken();
    const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;
    const docRes   = await fetch(endpoint, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ rawDocument: { content: imageBase64, mimeType } }),
    });

    const docJson = (await docRes.json()) as { document?: { text?: string }; error?: { message?: string } };
    if (!docRes.ok) {
      console.error('[OCR_DOCUMENTAI]', docRes.status, docJson);
      return NextResponse.json({ error: docJson.error?.message ?? 'Document AI OCR failed' }, { status: 500 });
    }

    const rawText = String(docJson.document?.text ?? '');
    if (!rawText) return NextResponse.json({ error: 'อ่านบัตรไม่สำเร็จ กรุณากรอกด้วยตนเอง' }, { status: 422 });

    const extracted = parseText(rawText);
    if (!extracted.citizenId && !extracted.fullName)
      return NextResponse.json({ error: 'ไม่พบข้อมูลบัตร กรุณากรอกด้วยตนเอง' }, { status: 422 });

    return NextResponse.json({ extracted, confidence: 85 });
  } catch (e) {
    console.error('[OCR_ID_CARD]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

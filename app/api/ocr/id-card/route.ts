import { NextResponse } from 'next/server';

// ── Document AI OCR (migrate จาก K_farm/api/ocr-documentai.ts) ──────────────

function base64UrlEncode(input: string): string {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function createAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_DOCUMENTAI_CLIENT_EMAIL;
  const privateKey  = process.env.GOOGLE_DOCUMENTAI_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')      // literal \n → newline
    .replace(/\\\\n/g, '\n')     // double-escaped \\n → newline
    .replace(/\r\n/g, '\n')      // Windows CRLF
    .replace(/\r/g, '\n');       // old Mac CR
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
  const signature = crypto.createSign('SHA256').update(data).sign({ key: privateKey, format: 'pem', type: 'pkcs8' }, 'base64')
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
function isThaiFullName(name: string) {
  return /^(?:นาย|นางสาว|นาง|ด\.ช\.|ด\.ญ\.|น\.ส\.)?\s*[ก-๙]+(?:\s+[ก-๙]+)+$/.test(cleanSpaces(name));
}

function confidenceOrBlank(value: string, confidence: number, threshold = 0.7): string {
  if (!value) return '';
  return confidence >= threshold ? value : '';
}

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

function extractThaiDate(text: string): string {
  const compact = cleanSpaces(text);
  const m = compact.match(/\b(\d{1,2}\s*(?:ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*\d{4})\b/u);
  return cleanSpaces(m?.[1] ?? '');
}

function extractIssueDate(text: string, lines: string[]): string {
  const issueMarkers = ['วันออกบัตร', 'วันออกบร', 'วันออกบต', 'Date of Issue'];
  const direct = extractDateAfter(text, issueMarkers);
  if (direct && /[ก-๙]/u.test(direct)) return direct;

  const thaiIssueLabel = /วันออก(?:บัตร|บร|บต)/u;
  for (let i = 0; i < lines.length; i += 1) {
    if (!thaiIssueLabel.test(lines[i] ?? '')) continue;
    const prevThaiDate = extractThaiDate(lines[i - 1] ?? '');
    if (prevThaiDate) return prevThaiDate;
    const sameLineThaiDate = extractThaiDate(lines[i] ?? '');
    if (sameLineThaiDate) return sameLineThaiDate;
    const nextThaiDate = extractThaiDate(lines[i + 1] ?? '');
    if (nextThaiDate) return nextThaiDate;
  }

  return '';
}

function normalizeDistrictInAddress(address: string): string {
  if (!address) return '';
  if (/(?:อำเภอ|อ\.)\s*[ก-๙]+/u.test(address)) return address;
  return address.replace(/(^|\s)\.\s*([ก-๙]+)\s*(?=จ\.)/gu, '$1อ.$2 ');
}

function extractAddress(compact: string): string {
  let start = -1;
  for (const marker of ['ที่อยู่', 'Address']) {
    const idx = compact.toLowerCase().indexOf(marker.toLowerCase());
    if (idx >= 0 && (start < 0 || idx < start)) start = idx;
  }
  if (start < 0) return '';
  let address = compact.slice(start).replace(/^ที่อยู่\s*/i, '').replace(/^Address\s*/i, '').trim();
  address = cutBeforeMarkers(address, [
    'ศาสนา',
    'วันออกบัตร',
    'Date of Issue',
    'วันบัตรหมดอายุ',
    'วันหมดอายุ',
    'Date of Expiry',
    'เจ้าพนักงานออกบัตร',
    'กระทรวงมหาดไทย',
  ]);
  return normalizeDistrictInAddress(stripDatesFromAddress(address));
}

function normalizeThaiNameCandidate(line: string): string {
  return cleanSpaces(line)
    .replace(/^(?:ชื่อตัวและชื่อสกุล|ตัวและชื่อสกุล|ชื่อและชื่อสกุล|ชื่อสกุล|ชื่อตัว|ชื่อ)\s*[:：]?\s*/i, '')
    .replace(/^(?:name|full\s*name|name-surname)\s*[:：]?\s*/i, '')
    .replace(/^(?:คำนำหน้า|prefix|title)\s*[:：]?\s*/i, '')
    .trim();
}

function sliceThaiNameFromFirstPrefix(name: string, prefixes: string[]): string {
  const cleaned = cleanSpaces(name);
  const startIdx = prefixes
    .map((prefix) => cleaned.indexOf(prefix))
    .filter((idx) => idx >= 0)
    .sort((a, b) => a - b)[0];

  if (startIdx == null) return cleaned;
  return cleaned.slice(startIdx).trim();
}

function extractThaiName(lines: string[]): string {
  const prefixes = ['นางสาว', 'น.ส.', 'ด.ช.', 'ด.ญ.', 'นาย', 'นาง'];

  for (let i = 0; i < lines.length; i += 1) {
    const current = cleanSpaces(lines[i] ?? '');
    if (!/^ชื่อและชื่อสกุล\b/i.test(current) && !/^ชื่อ\b/i.test(current)) continue;

    const normalizedCurrent = sliceThaiNameFromFirstPrefix(normalizeThaiNameCandidate(current), prefixes);
    if (prefixes.some((p) => normalizedCurrent.startsWith(p)) && isThaiFullName(normalizedCurrent)) return normalizedCurrent;

    const next = sliceThaiNameFromFirstPrefix(normalizeThaiNameCandidate(lines[i + 1] ?? ''), prefixes);
    if (prefixes.some((p) => next.startsWith(p)) && isThaiFullName(next)) return next;
  }

  for (const line of lines) {
    const normalized = sliceThaiNameFromFirstPrefix(normalizeThaiNameCandidate(line), prefixes);
    if (!prefixes.some((p) => normalized.includes(p))) continue;
    if (/เลข|บัตร|identification|address|date|เกิด|ออกบัตร|หมดอายุ|ศาสนา/i.test(normalized)) continue;
    if (isThaiFullName(normalized)) return normalized;
  }
  return '';
}

function parseText(text: string, confidence = 0.85) {
  const compact      = cleanSpaces(text);
  const idMatch      = compact.match(/\b\d[\d\s-]{11,20}\d\b/);
  const citizenId    = idMatch ? idMatch[0].replace(/\D/g, '').slice(0, 13) : '';
  const lines        = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const thaiNameLine = extractThaiName(lines);
  const englishNameLine = lines.find((l) =>
    /Mr\.?|Mrs\.?|Miss/i.test(l) &&
    !/เลข|บัตร|identification|address|date|เกิด|ออกบัตร|หมดอายุ/i.test(l)
  ) ?? '';
  const address      = extractAddress(compact);
  const province     = (address.match(/(?:จังหวัด|จ\.)\s*([^\s]+)/))?.[1] ?? '';
  let district       = (address.match(/(?:อำเภอ|อ\.|เขต)\s*([^\s]+)/))?.[1] ?? '';
  if (!district) {
    const fallbackDistrict = address.match(/(^|\s)\.\s*([ก-๙]+)\s*(?=จ\.)/u)?.[2] ?? '';
    district = fallbackDistrict;
  }
  const subdistrict  = (address.match(/(?:ตำบล|ต\.|แขวง)\s*([^\s]+)/))?.[1] ?? '';
  const thaiFullName = normalizeThaiNameCandidate(thaiNameLine);
  const houseNoMatch = address.match(/\b\d{1,4}(?:\s*[-–]\s*\d{1,4})?(?:\/\d{1,4})?\b/);
  const houseNo      = (houseNoMatch?.[0] ?? '').replace(/\s+/g, '');
  const moo          = (address.match(/(?:หมู่ที่|หมู่|ม\.)\s*(\d{1,3})/)?.[1] ?? '').trim();
  const englishFullName = cleanSpaces(englishNameLine.replace(/^(Name|English Name)\s*[:：]?\s*/i, '').trim());
  return {
    fullName:    confidenceOrBlank(isThaiFullName(thaiFullName) ? thaiFullName : '', confidence),
    fullNameEn:  englishFullName,
    bankAccountName: confidenceOrBlank(isThaiFullName(thaiFullName) ? thaiFullName : '', confidence),
    citizenId: confidenceOrBlank(citizenId, confidence),
    address: confidenceOrBlank(address, confidence),
    houseNo: confidenceOrBlank(houseNo, confidence),
    moo: confidenceOrBlank(moo, confidence),
    province: confidenceOrBlank(province, confidence),
    district: confidenceOrBlank(district, confidence),
    subdistrict: confidenceOrBlank(subdistrict, confidence),
    dateOfBirth: '',
    expiryDate:  extractDateAfter(compact, ['วันบัตรหมดอายุ', 'Date of Expiry']),
    issueDate:   extractIssueDate(compact, lines),
  };
}

export async function POST(request: Request) {
  try {
    const projectId   = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location    = process.env.GOOGLE_DOCUMENTAI_LOCATION ?? 'us';
    const processorId = process.env.GOOGLE_DOCUMENTAI_PROCESSOR_ID;

    if (!projectId || !processorId)
      return NextResponse.json({ error: 'ระบบอ่านบัตรอัตโนมัติยังไม่พร้อมใช้งาน กรุณากรอกข้อมูลด้วยตนเอง' }, { status: 503 });

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
      return NextResponse.json({ error: 'ระบบอ่านบัตรอัตโนมัติยังไม่พร้อมใช้งาน กรุณากรอกข้อมูลด้วยตนเอง' }, { status: 500 });
    }

    const rawText = String(docJson.document?.text ?? '');
    if (!rawText) return NextResponse.json({ error: 'อ่านบัตรไม่สำเร็จ กรุณากรอกด้วยตนเอง' }, { status: 422 });

    const confidence = 0.85;
    const extracted = parseText(rawText, confidence);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[OCR_ID_CARD_DEBUG] rawText:', rawText);
      console.info('[OCR_ID_CARD_DEBUG] parsed:', extracted);
    }
    if (!extracted.citizenId && !extracted.fullName)
      return NextResponse.json({ error: 'ไม่พบข้อมูลบัตร กรุณากรอกด้วยตนเอง' }, { status: 422 });

    return NextResponse.json({ extracted, confidence: Math.round(confidence * 100) });
  } catch (e) {
    console.error('[OCR_ID_CARD]', e);
    return NextResponse.json({ error: 'ระบบอ่านบัตรอัตโนมัติยังไม่พร้อมใช้งาน กรุณากรอกข้อมูลด้วยตนเอง' }, { status: 500 });
  }
}

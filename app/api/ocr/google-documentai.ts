import { createSign } from 'crypto';

// ── Google Service Account JWT ────────────────────────────────────────

function base64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function getGoogleAccessToken(): Promise<string> {
  const clientEmail = process.env.GOOGLE_DOCUMENTAI_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DOCUMENTAI_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google Document AI credentials not configured');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: clientEmail,
    sub: clientEmail,
    aud: 'https://www.googleapis.com/oauth2/v4/token',
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    iat: now,
    exp: now + 3600,
  }));

  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(privateKey, 'base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${header}.${payload}.${signature}`;

  const tokenRes = await fetch('https://www.googleapis.com/oauth2/v4/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Failed to get Google access token: ${err}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };
  return tokenData.access_token;
}

// ── Document AI Process ───────────────────────────────────────────────

export type DocumentAIResult = {
  text: string;
  confidence: number;
  entities: Array<{ type: string; mentionText: string; confidence: number }>;
};

export async function processDocumentAI(
  imageBase64: string,
  mimeType: string
): Promise<DocumentAIResult> {
  const projectId  = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location   = process.env.GOOGLE_DOCUMENTAI_LOCATION ?? 'us';
  const processorId = process.env.GOOGLE_DOCUMENTAI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error('Google Document AI processor not configured');
  }

  const accessToken = await getGoogleAccessToken();

  const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: { content: imageBase64, mimeType },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Document AI request failed: ${err}`);
  }

  const data = (await response.json()) as {
    document?: {
      text?: string;
      pages?: Array<{ blocks?: Array<{ layout?: { confidence?: number } }> }>;
      entities?: Array<{ type?: string; mentionText?: string; confidence?: number }>;
    };
  };

  const text = data.document?.text ?? '';
  const pages = data.document?.pages ?? [];
  const blocks = pages.flatMap((p) => p.blocks ?? []);
  const avgConf = blocks.length > 0
    ? blocks.reduce((s, b) => s + (b.layout?.confidence ?? 0), 0) / blocks.length
    : 0;

  const entities = (data.document?.entities ?? []).map((e) => ({
    type: e.type ?? '',
    mentionText: e.mentionText ?? '',
    confidence: e.confidence ?? 0,
  }));

  return { text, confidence: avgConf, entities };
}

// ── Thai ID Card Parser ───────────────────────────────────────────────

export type ThaiIdExtracted = {
  fullName: string;
  citizenId: string;
  address: string;
  dateOfBirth: string;
  confidence: number;
};

export function parseThaiIdCard(result: DocumentAIResult): ThaiIdExtracted {
  const { text, entities, confidence } = result;

  // ลอง entities ก่อน (Document AI Form Parser จะให้ entities)
  function entityVal(type: string): string {
    return entities.find((e) => e.type === type)?.mentionText?.trim() ?? '';
  }

  let citizenId = entityVal('id_number') || entityVal('citizen_id');
  let fullName  = entityVal('name') || entityVal('full_name');
  let address   = entityVal('address');
  let dateOfBirth = entityVal('date_of_birth') || entityVal('dob');

  // fallback: parse raw text
  if (!citizenId) {
    const idMatch = text.replace(/\s/g, '').match(/\d{13}/);
    citizenId = idMatch ? idMatch[0] : '';
  }

  if (!fullName) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    fullName = lines.find((l) => /นาย|นาง|นางสาว/.test(l)) ?? '';
  }

  if (!address) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    address = lines.find((l) => /หมู่|ตำบล|อำเภอ|จังหวัด/.test(l)) ?? '';
  }

  return { fullName, citizenId, address, dateOfBirth, confidence };
}

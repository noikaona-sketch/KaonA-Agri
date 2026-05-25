import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function GET() {
  const raw = process.env.GOOGLE_DOCUMENTAI_PRIVATE_KEY ?? '';
  const info = {
    length:           raw.length,
    has_begin_pkcs8:  raw.includes('-----BEGIN PRIVATE KEY-----'),
    has_begin_rsa:    raw.includes('-----BEGIN RSA PRIVATE KEY-----'),
    has_literal_n:    raw.includes('\\n'),
    has_real_newline: raw.includes('\n'),
    first_80:         raw.slice(0, 80).replace(/\n/g,'[NL]').replace(/\\n/g,'[SN]'),
  };

  const results: Record<string,string> = {};
  const variants = [
    { name:'raw',        key: raw },
    { name:'sn→nl',      key: raw.replace(/\\n/g, '\n') },
    { name:'ssn→nl',     key: raw.replace(/\\\\n/g, '\n') },
    { name:'all',        key: raw.replace(/\\n/g, '\n').replace(/\r/g,'\n') },
  ];

  for (const { name, key } of variants) {
    for (const type of ['SHA256','RSA-SHA256'] as const) {
      for (const opt of [null, { key, format:'pem' as const, type:'pkcs8' as const }]) {
        const k = `${name}__${type}${opt?'__pkcs8':''}`;
        try {
          const c = await import('crypto');
          const s = c.createSign(type); s.update('test');
          s.sign(opt ?? key, 'base64');
          results[k] = '✅';
        } catch(e){ results[k] = `❌ ${String(e).slice(0,60)}`; }
      }
    }
  }
  return NextResponse.json({ info, results });
}

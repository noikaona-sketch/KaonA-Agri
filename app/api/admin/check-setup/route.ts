import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {};

  // ── ENV vars ───────────────────────────────────────────────────────────────
  checks.NEXT_PUBLIC_SUPABASE_URL        = process.env.NEXT_PUBLIC_SUPABASE_URL        ? '✅' : '❌ missing';
  checks.SUPABASE_SERVICE_ROLE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY       ? '✅' : '❌ missing';
  checks.LINE_CHANNEL_ACCESS_TOKEN       = process.env.LINE_CHANNEL_ACCESS_TOKEN       ? '✅' : '❌ missing';
  checks.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? '✅' : '❌ missing';
  checks.ADMIN_WEB_EMAIL                 = process.env.ADMIN_WEB_EMAIL                 ? '✅' : '❌ missing';
  checks.ADMIN_WEB_PASSWORD              = process.env.ADMIN_WEB_PASSWORD              ? '✅' : '❌ missing';
  checks.GOOGLE_CLOUD_PROJECT_ID         = process.env.GOOGLE_CLOUD_PROJECT_ID         ? '✅' : '❌ missing';
  checks.GOOGLE_DOCUMENTAI_LOCATION      = process.env.GOOGLE_DOCUMENTAI_LOCATION      ? '✅' : '❌ missing';
  checks.GOOGLE_DOCUMENTAI_PROCESSOR_ID  = process.env.GOOGLE_DOCUMENTAI_PROCESSOR_ID  ? '✅' : '❌ missing';
  checks.GOOGLE_DOCUMENTAI_CLIENT_EMAIL  = process.env.GOOGLE_DOCUMENTAI_CLIENT_EMAIL  ? '✅' : '❌ missing';
  checks.GOOGLE_DOCUMENTAI_PRIVATE_KEY   = process.env.GOOGLE_DOCUMENTAI_PRIVATE_KEY   ? '✅' : '❌ missing';

  // ── Supabase service_role ─────────────────────────────────────────────────
  try {
    const s = createServerSupabaseClient();
    const { error } = await s.auth.admin.listUsers({ page: 1, perPage: 1 });
    checks.supabase_service_role = error ? `❌ ${error.message}` : '✅ confirmed';
  } catch (e) { checks.supabase_service_role = `❌ ${String(e)}`; }

  // ── Document AI JWT test ──────────────────────────────────────────────────
  try {
    const clientEmail = process.env.GOOGLE_DOCUMENTAI_CLIENT_EMAIL;
    const privateKey  = process.env.GOOGLE_DOCUMENTAI_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const projectId   = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const processorId = process.env.GOOGLE_DOCUMENTAI_PROCESSOR_ID;
    const location    = process.env.GOOGLE_DOCUMENTAI_LOCATION ?? 'us';

    if (!clientEmail || !privateKey || !projectId || !processorId) {
      checks.documentai_test = '❌ ENV ไม่ครบ';
    } else {
      const b64url = (s: string) => Buffer.from(s).toString('base64')
        .replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      const now    = Math.floor(Date.now()/1000);
      const header = b64url(JSON.stringify({ alg:'RS256', typ:'JWT' }));
      const claim  = b64url(JSON.stringify({
        iss:clientEmail, scope:'https://www.googleapis.com/auth/cloud-platform',
        aud:'https://oauth2.googleapis.com/token', exp:now+3600, iat:now,
      }));
      const crypto = await import('crypto');
      const sig    = crypto.createSign('RSA-SHA256').update(`${header}.${claim}`)
        .sign(privateKey,'base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      const jwt    = `${header}.${claim}.${sig}`;
      const tokenRes  = await fetch('https://oauth2.googleapis.com/token', {
        method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({ grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion:jwt }),
      });
      const tokenJson = (await tokenRes.json()) as { access_token?:string; error?:string };
      if (!tokenRes.ok) {
        checks.documentai_test = `❌ JWT error: ${tokenJson.error ?? tokenRes.status}`;
      } else {
        const procRes = await fetch(
          `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}`,
          { headers:{ Authorization:`Bearer ${tokenJson.access_token}` } }
        );
        checks.documentai_test = procRes.ok
          ? `✅ Document AI connected (${processorId.slice(0,8)}...)`
          : `❌ HTTP ${procRes.status}`;
      }
    }
  } catch (e) { checks.documentai_test = `❌ ${String(e)}`; }

  // ── LINE bot token test ───────────────────────────────────────────────────
  try {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!token) {
      checks.line_token_test = '❌ missing';
    } else {
      const res = await fetch('https://api.line.me/v2/bot/info', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = (await res.json()) as { displayName?: string; basicId?: string };
      checks.line_token_test = res.ok
        ? `✅ Bot: ${d.displayName ?? ''} (${d.basicId ?? ''})`
        : `❌ HTTP ${res.status}`;
    }
  } catch (e) { checks.line_token_test = `❌ ${String(e)}`; }

  return NextResponse.json(checks);
}

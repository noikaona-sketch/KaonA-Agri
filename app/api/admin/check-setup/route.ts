import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const checks: Record<string, string> = {};

  // ตรวจ ENV
  checks.NEXT_PUBLIC_SUPABASE_URL   = process.env.NEXT_PUBLIC_SUPABASE_URL   ? '✅' : '❌ missing';
  checks.SUPABASE_SECRET_KEY        = process.env.SUPABASE_SECRET_KEY        ? '✅' : '❌ missing';
  checks.SUPABASE_SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY  ? '✅' : '❌ missing';
  checks.GEMINI_API_KEY             = process.env.GEMINI_API_KEY             ? '✅' : '❌ missing';
  checks.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? '✅' : '❌ missing';

  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  checks.key_looks_like_service_role = key.length > 100 ? '✅ (long key)' : '⚠️ might be anon key (too short)';

  // ทดสอบ auth.admin.listUsers (ต้องการ service_role)
  try {
    const s = createServerSupabaseClient();
    const { error } = await s.auth.admin.listUsers({ page: 1, perPage: 1 });
    checks.auth_admin_access = error ? `❌ ${error.message}` : '✅ service_role confirmed';
  } catch (e) {
    checks.auth_admin_access = `❌ ${String(e)}`;
  }

  // ทดสอบ Gemini API
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'say ok' }] }] }),
        }
      );
      checks.gemini_api_test = res.ok ? '✅ Gemini API connected' : `❌ HTTP ${res.status}`;
    } else {
      checks.gemini_api_test = '❌ no key';
    }
  } catch (e) {
    checks.gemini_api_test = `❌ ${String(e)}`;
  }

  return NextResponse.json(checks);
}

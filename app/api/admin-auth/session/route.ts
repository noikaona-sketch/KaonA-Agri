import { NextResponse } from 'next/server';

import { requireAdmin } from '../../admin/members/_admin-auth';

const ADMIN_COOKIE = 'kaona_admin_web';

function cookieOpts(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, reason: 'session_expired', message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' },
      { status: 401 },
    );
  }

  const isProd = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ ok: true, adminRole: admin.adminRole });
  response.cookies.set(ADMIN_COOKIE, admin.adminUserId, cookieOpts(isProd));
  return response;
}

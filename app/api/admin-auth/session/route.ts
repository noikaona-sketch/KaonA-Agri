import { NextResponse } from 'next/server';

import { requireAdmin } from '../../admin/members/_admin-auth';
import { setAdminCookie } from '../admin-auth-cookie';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { ok: false, reason: 'session_expired', message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' },
      { status: 401 },
    );
  }

  const isProd = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ ok: true });
  setAdminCookie(response, admin.adminUserId, isProd);
  return response;
}

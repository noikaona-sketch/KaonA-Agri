import type { NextResponse } from 'next/server';

export const ADMIN_COOKIE = 'kaona_admin_web';

export function getAdminCookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  };
}

export function setAdminCookie(response: NextResponse, adminValue: string, secure: boolean) {
  response.cookies.set(ADMIN_COOKIE, adminValue, getAdminCookieOptions(secure));
}

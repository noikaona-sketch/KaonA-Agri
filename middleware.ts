import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAdminWebPath } from '@/shared/auth/admin-web-path';

const ADMIN_COOKIE_NAME = 'kaona_admin_web';
const VALID_ADMIN_COOKIE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^env-super-admin$/i;

function isAdminProtectedPath(pathname: string) {
  if (pathname === '/admin-login' || pathname === '/admin/register') return false;
  return isAdminWebPath(pathname);
}

const REFRESH_OPTS = (secure: boolean) => ({
  httpOnly: true,
  secure,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24, // 24 ชั่วโมง
});

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieVal    = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? '';
  const isLoggedIn   = VALID_ADMIN_COOKIE.test(cookieVal);
  const isProd       = process.env.NODE_ENV === 'production';

  // ── ป้องกัน admin pages ────────────────────────────────────────────
  if (isAdminProtectedPath(pathname)) {
    if (!isLoggedIn) {
      const loginUrl = new URL('/admin-login', request.url);
      loginUrl.searchParams.set('next', pathname);
      return NextResponse.redirect(loginUrl);
    }
    // ต่ออายุ cookie ทุกครั้ง navigate
    const res = NextResponse.next();
    res.cookies.set(ADMIN_COOKIE_NAME, cookieVal, REFRESH_OPTS(isProd));
    return res;
  }

  // ── ต่ออายุใน API admin routes ด้วย ─────────────────────────────────
  // ป้องกัน cookie หายตอน fetch API หลัง refresh
  if (pathname.startsWith('/api/admin/') && isLoggedIn) {
    const res = NextResponse.next();
    res.cookies.set(ADMIN_COOKIE_NAME, cookieVal, REFRESH_OPTS(isProd));
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

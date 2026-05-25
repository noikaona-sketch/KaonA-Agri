import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAdminWebPath } from '@/shared/auth/admin-web-path';

const ADMIN_COOKIE_NAME = 'kaona_admin_web';

function isAdminProtectedPath(pathname: string) {
  if (pathname === '/admin-login' || pathname === '/admin/register') return false;
  return isAdminWebPath(pathname);
}

// Accept only proper UUID or env-super-admin.
// '1' bypass removed — was a critical security gap that allowed any cookie
// value of '1' to access all admin routes without authentication.
const VALID_ADMIN_COOKIE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^env-super-admin$/i;

export function middleware(request: NextRequest) {
  if (isAdminProtectedPath(request.nextUrl.pathname)) {
    const cookieVal  = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? '';
    const isLoggedIn = VALID_ADMIN_COOKIE.test(cookieVal);

    if (!isLoggedIn) {
      const loginUrl = new URL('/admin-login', request.url);
      loginUrl.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }

    // ต่ออายุ cookie ทุกครั้งที่ navigate — ป้องกัน session หาย
    const response = NextResponse.next();
    response.cookies.set(ADMIN_COOKIE_NAME, cookieVal, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path:     '/',
      maxAge:   60 * 60 * 24,  // 24 ชั่วโมง
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

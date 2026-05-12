import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'kaona_admin_web';

function isAdminProtectedPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin-prototype');
}

export function middleware(request: NextRequest) {
  if (isAdminProtectedPath(request.nextUrl.pathname)) {
    const isLoggedIn = request.cookies.get(ADMIN_COOKIE_NAME)?.value === '1';

    if (!isLoggedIn) {
      const loginUrl = new URL('/admin-login', request.url);
      loginUrl.searchParams.set('next', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

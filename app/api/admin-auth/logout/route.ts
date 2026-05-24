import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'kaona_admin_web';

function clearCookieResponse(redirectTo: string) {
  const response = NextResponse.redirect(new URL(redirectTo, process.env.NEXT_PUBLIC_APP_URL ?? 'https://kaon-a-agri.vercel.app'));
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

// GET — เมื่อคลิก link ออกจากระบบ
export async function GET() {
  return clearCookieResponse('/admin/login');
}

// POST — เมื่อเรียกผ่าน fetch (backward compat)
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

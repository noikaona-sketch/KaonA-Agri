import { NextResponse } from 'next/server';

const ADMIN_COOKIE_NAME = 'kaona_admin_web';

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };

  const adminEmail = process.env.ADMIN_WEB_EMAIL;
  const adminPassword = process.env.ADMIN_WEB_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return NextResponse.json({ error: 'Admin web login is not configured' }, { status: 500 });
  }

  if (body.email !== adminEmail || body.password !== adminPassword) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: '1',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8,
  });

  return response;
}

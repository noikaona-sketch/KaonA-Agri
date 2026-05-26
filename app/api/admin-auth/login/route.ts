import { NextResponse } from 'next/server';

import { createServerSupabaseClient, createAnonSupabaseClient } from '../../auth/line/line-auth-helpers';
import { getAdminCookieOptions, setAdminCookie } from '../admin-auth-cookie';

const DEPT_COOKIE    = 'kaona_admin_dept';
const ENV_ADMIN_ID   = 'env-super-admin';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return NextResponse.json({ error: 'กรุณากรอก email และ password' }, { status: 400 });
    }

    const isProd  = process.env.NODE_ENV === 'production';
    const secure  = getAdminCookieOptions(isProd);
    const insecure = { ...secure, httpOnly: false };

    // ── ENV fallback (bootstrap / ก่อน run migrations) ────────────────
    // ใช้เมื่อ admin_users table ยังว่างหรือยังไม่มี
    const envEmail = process.env.ADMIN_WEB_EMAIL;
    const envPass  = process.env.ADMIN_WEB_PASSWORD;

    if (envEmail && envPass && body.email === envEmail && body.password === envPass) {
      const response = NextResponse.json({ ok: true, department: 'super_admin', fullName: 'Super Admin (ENV)' });
      setAdminCookie(response, ENV_ADMIN_ID, isProd);
      response.cookies.set(DEPT_COOKIE,  'super_admin', insecure);
      return response;
    }

    // ── Supabase Auth + admin_users ────────────────────────────────────
    // signInWithPassword ต้องใช้ anon client (service_role ไม่รองรับ)
    const anonClient    = createAnonSupabaseClient();
    const serviceClient = createServerSupabaseClient();

    const { data: authData, error: authError } = await anonClient.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (authError || !authData.user) {
      console.error('[ADMIN_LOGIN] signIn error:', authError?.message);
      return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    const { data: adminUser, error: adminError } = await serviceClient
      .from('admin_users')
      .select('id, department, status, full_name')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (adminError || !adminUser) {
      return NextResponse.json({ error: 'ไม่พบบัญชีเจ้าหน้าที่ในระบบ' }, { status: 403 });
    }

    if (adminUser.status === 'pending') {
      return NextResponse.json({ error: 'บัญชีรอการอนุมัติจาก super admin' }, { status: 403 });
    }

    if (adminUser.status === 'suspended') {
      return NextResponse.json({ error: 'บัญชีถูกระงับ' }, { status: 403 });
    }

    const response = NextResponse.json({
      ok: true,
      department: adminUser.department,
      fullName: adminUser.full_name,
    });

    setAdminCookie(response, adminUser.id, isProd);
    response.cookies.set(DEPT_COOKIE,  adminUser.department, insecure);

    return response;
  } catch (error) {
    console.error('[ADMIN_LOGIN]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}

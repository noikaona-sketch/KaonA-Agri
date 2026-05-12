import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

const ADMIN_COOKIE_NAME = 'kaona_admin_web';
const ADMIN_DEPT_COOKIE  = 'kaona_admin_dept';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      return NextResponse.json({ error: 'กรุณากรอก email และ password' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // sign in ด้วย Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
    }

    // ตรวจสอบว่ามีใน admin_users และ approved
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id, department, status, full_name')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();

    if (adminError || !adminUser) {
      return NextResponse.json({ error: 'ไม่พบบัญชีเจ้าหน้าที่' }, { status: 403 });
    }

    if (adminUser.status === 'pending') {
      return NextResponse.json({ error: 'บัญชีของคุณรอการอนุมัติจาก super admin' }, { status: 403 });
    }

    if (adminUser.status === 'suspended') {
      return NextResponse.json({ error: 'บัญชีของคุณถูกระงับ' }, { status: 403 });
    }

    const response = NextResponse.json({
      ok: true,
      department: adminUser.department,
      fullName: adminUser.full_name,
    });

    // เก็บ session cookie
    const cookieOpts = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 60 * 60 * 8,
    };

    response.cookies.set(ADMIN_COOKIE_NAME, adminUser.id, cookieOpts);
    response.cookies.set(ADMIN_DEPT_COOKIE, adminUser.department, { ...cookieOpts, httpOnly: false });

    return response;
  } catch (error) {
    console.error('[ADMIN_LOGIN]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}

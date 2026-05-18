import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

type AdminRegisterPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  department?: string;
};

const VALID_DEPARTMENTS = ['admin', 'sales', 'accounting', 'finance', 'field', 'stock'];

export async function POST(request: Request) {
  try {
    const _ar_post = await requireAdminPermission('admin_users.manage');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as AdminRegisterPayload;

    if (!body.email || !body.password || !body.fullName || !body.department) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบ' }, { status: 400 });
    }

    if (!VALID_DEPARTMENTS.includes(body.department)) {
      return NextResponse.json({ error: 'แผนกไม่ถูกต้อง' }, { status: 400 });
    }

    if (body.password.length < 8) {
      return NextResponse.json({ error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    // สร้าง Supabase Auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });

    if (authError || !authUser.user) {
      console.error('[ADMIN_REGISTER] authError:', authError?.message, authError?.status);
      if (authError?.message?.includes('already registered') || authError?.message?.includes('already been registered')) {
        return NextResponse.json({ error: 'อีเมลนี้มีบัญชีอยู่แล้ว' }, { status: 409 });
      }
      if (authError?.message?.includes('service_role') || authError?.status === 401) {
        return NextResponse.json({ error: 'SUPABASE_SECRET_KEY ไม่ถูกต้อง กรุณาตรวจสอบใน Vercel' }, { status: 500 });
      }
      return NextResponse.json({
        error: `สร้างบัญชีไม่สำเร็จ: ${authError?.message ?? 'unknown error'}`,
      }, { status: 500 });
    }

    // สร้าง admin_users record (status = pending รอ super_admin อนุมัติ)
    const { error: insertError } = await supabase.from('admin_users').insert({
      email: body.email,
      full_name: body.fullName,
      department: body.department,
      auth_user_id: authUser.user.id,
      status: 'pending',
    });

    if (insertError) {
      // rollback: ลบ auth user ที่สร้างไป
      await supabase.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: 'ไม่สามารถบันทึกข้อมูลได้' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[ADMIN_REGISTER]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}

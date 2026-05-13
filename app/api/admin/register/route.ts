import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

const ALLOWED_DEPARTMENTS = new Set([
  'admin',
  'sales',
  'accounting',
  'finance',
  'field',
  'stock',
]);

type AdminRegisterPayload = {
  email?: string;
  password?: string;
  fullName?: string;
  department?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AdminRegisterPayload;

    const email = body.email ? normalizeEmail(body.email) : '';
    const password = body.password ?? '';
    const fullName = body.fullName?.trim() ?? '';
    const department = body.department ?? '';

    if (!email || !password || !fullName || !department) {
      return NextResponse.json(
        { error: 'กรุณากรอกข้อมูลให้ครบ' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัว' },
        { status: 400 }
      );
    }

    if (!ALLOWED_DEPARTMENTS.has(department)) {
      return NextResponse.json(
        { error: 'แผนกไม่ถูกต้อง' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    const { data: existingAdmin } = await supabase
      .from('admin_users')
      .select('id,status')
      .eq('email', email)
      .maybeSingle();

    if (existingAdmin) {
      return NextResponse.json(
        { error: 'อีเมลนี้มีคำขอหรือบัญชีอยู่แล้ว' },
        { status: 409 }
      );
    }

    const {
      data: createdUser,
      error: createUserError,
    } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        admin_department: department,
      },
    });

    if (createUserError || !createdUser.user) {
      return NextResponse.json(
        {
          error:
            createUserError?.message ??
            'ไม่สามารถสร้างบัญชีได้',
        },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase
      .from('admin_users')
      .insert({
        email,
        full_name: fullName,
        department,
        status: 'pending',
        auth_user_id: createdUser.user.id,
      });

    if (insertError) {
      await supabase.auth.admin.deleteUser(
        createdUser.user.id
      );

      return NextResponse.json(
        { error: insertError.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: 'pending',
    });
  } catch (error) {
    console.error('[ADMIN_REGISTER]', error);

    return NextResponse.json(
      { error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' },
      { status: 500 }
    );
  }
}

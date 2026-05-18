import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

type CreatePinPayload = {
  memberId?: string;
  role?: string;
  hours?: number;
  fullName?: string;
  phone?: string;
};

const VALID_ROLES = ['farmer', 'truck_owner', 'inspector', 'staff', 'leader', 'admin'];

export async function POST(request: Request) {
  try {
    const _ar_post = await requireAdminPermission('members.write');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as CreatePinPayload;
    const supabase = createServerSupabaseClient();

    if (!body.role || !VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: 'role ไม่ถูกต้อง' }, { status: 400 });
    }

    const hours = body.hours ?? 72;

    // กรณีที่ 1: มี memberId แล้ว — สร้าง PIN ให้ member เดิม
    if (body.memberId) {
      const { data, error } = await supabase.rpc('create_member_invite_pin', {
        p_member_id: body.memberId,
        p_role: body.role,
        p_hours: hours,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, pin: data, type: 'existing_member' });
    }

    // กรณีที่ 2: admin สร้าง member ใหม่พร้อม PIN (เส้น 3)
    if (!body.fullName) {
      return NextResponse.json({ error: 'กรุณาระบุชื่อสมาชิกหรือ memberId' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('admin_create_member_with_pin', {
      p_full_name: body.fullName,
      p_phone: body.phone ?? null,
      p_citizen_id_masked: 'PENDING',
      p_role: body.role,
      p_hours: hours,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const result = data as { member_id: string; pin: string; role: string };
    return NextResponse.json({ ok: true, pin: result.pin, memberId: result.member_id, type: 'new_member' });
  } catch (error) {
    console.error('[CREATE_PIN]', error);
    return NextResponse.json({ error: 'เกิดข้อผิดพลาด กรุณาลองใหม่' }, { status: 500 });
  }
}

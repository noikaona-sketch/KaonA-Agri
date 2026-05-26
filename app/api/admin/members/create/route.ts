import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdmin } from '../_admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = (await request.json()) as {
      full_name:string; phone?:string; citizen_id?:string;
      date_of_birth?:string; gender?:string; address?:string;
      province?:string; district?:string; subdistrict?:string;
      role?:string;
    };

    if (!body.full_name?.trim())
      return NextResponse.json({ error: 'ชื่อ-นามสกุลจำเป็น' }, { status: 400 });
    if (!body.citizen_id?.replace(/\D/g,''))
      return NextResponse.json({ error: 'เลขบัตรประชาชนจำเป็น' }, { status: 400 });

    const citizenId = body.citizen_id.replace(/\D/g,'');
    if (citizenId.length !== 13)
      return NextResponse.json({ error: 'เลขบัตรประชาชนต้องมี 13 หลัก' }, { status: 400 });

    const s = createServerSupabaseClient();

    // ตรวจซ้ำ
    const { data: existing } = await s.from('members')
      .select('id').eq('citizen_id_masked', `***${citizenId.slice(-4)}`).maybeSingle();
    if (existing) return NextResponse.json({ error: 'เลขบัตรประชาชนนี้มีในระบบแล้ว' }, { status: 409 });

    // สร้าง member
    const { data: member, error: mErr } = await s.from('members').insert({
      full_name:         body.full_name.trim(),
      phone:             body.phone?.trim() || null,
      citizen_id_masked: `***${citizenId.slice(-4)}`,
      date_of_birth:     body.date_of_birth || null,
      gender:            body.gender || null,
      address:           body.address?.trim() || null,
      province:          body.province || null,
      district:          body.district || null,
      subdistrict:       body.subdistrict || null,
      status:            'approved',  // admin สร้าง → อนุมัติทันที
      line_user_id:      `admin-created-${Date.now()}`,
    }).select('id').single();

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    // เพิ่ม role
    const role = body.role ?? 'farmer';
    await s.from('member_roles').insert({ member_id:member.id, role, is_primary:true });

    return NextResponse.json({ ok:true, member_id:member.id });
  } catch (e) {
    return NextResponse.json({ error:String(e) }, { status:500 });
  }
}

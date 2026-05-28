import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../_admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const auth = await requireAdminPermission('members.write');
    if (isForbidden(auth)) return auth.forbidden;

    const body = (await request.json()) as {
      full_name:string; phone?:string; citizen_id?:string;
      date_of_birth?:string; gender?:string; address?:string;
      province?:string; district?:string; subdistrict?:string;
      house_no?:string; moo?:string;
      bank_name?:string; bank_account_number?:string; bank_account_name?:string;
      plots?: Array<{ name:string; area_rai:number; province?:string; district?:string; sub_district?:string; lat?:number|null; lng?:number|null; description?:string; land_doc_type?:string|null; land_doc_number?:string|null }>;
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
      house_no:          body.house_no?.trim() || null,
      moo:               body.moo?.trim() || null,
      province:          body.province || null,
      district:          body.district || null,
      subdistrict:       body.subdistrict || null,
      bank_name:         body.bank_name?.trim() || null,
      bank_account_number: body.bank_account_number?.trim() || null,
      bank_account_name: body.bank_account_name?.trim() || null,
      status:            'approved',  // admin สร้าง → อนุมัติทันที
      line_user_id:      `admin-created-${Date.now()}`,
    }).select('id').single();

    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

    // เพิ่ม role
    const role = body.role ?? 'farmer';
    await s.from('member_roles').insert({ member_id:member.id, role, is_primary:true });

    const plots = (body.plots ?? []).filter((p) => p.name?.trim() && Number(p.area_rai) > 0);
    if (plots.length > 0) {
      const now = new Date().toISOString();
      const { error: pErr } = await s.from('plots').insert(
        plots.map((p) => ({
          member_id: member.id,
          name: p.name.trim(),
          area_rai: Number(p.area_rai),
          province: p.province?.trim() || null,
          district: p.district?.trim() || null,
          sub_district: p.sub_district?.trim() || null,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
          description: p.description?.trim() || null,
          land_doc_type: p.land_doc_type?.trim() || null,
          land_doc_number: p.land_doc_number?.trim() || null,
          status: 'approved',
          created_by: null,
          role_used: 'staff',
          timestamp: now,
        }))
      );
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok:true, member_id:member.id });
  } catch (e) {
    return NextResponse.json({ error:String(e) }, { status:500 });
  }
}

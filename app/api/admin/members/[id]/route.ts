import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const s = createServerSupabaseClient();
    const { id } = params;

    const [mRes, pRes, vRes, rRes] = await Promise.all([
      s.from('members')
        .select('id,full_name,phone,citizen_id_masked,address,status,registration_type,line_user_id,line_display_name,line_picture_url,created_at,updated_at')
        .eq('id', id)
        .maybeSingle(),
      s.from('plots')
        .select('id,name,area_rai,lat,lng,status,province,land_doc_type,land_doc_number')
        .eq('member_id', id)
        .is('deleted_at', null),
      s.from('member_vehicles')
        .select('id,vehicle_type,plate_number,brand,model,year_be,province,capacity_ton')
        .eq('member_id', id)
        .is('deleted_at', null),
      s.from('member_roles')
        .select('role,is_primary')
        .eq('member_id', id),
    ]);

    if (mRes.error) return NextResponse.json({ error: mRes.error.message }, { status: 500 });
    if (!mRes.data) return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 });

    return NextResponse.json({
      member:   mRes.data,
      plots:    pRes.data  ?? [],
      vehicles: vRes.data  ?? [],
      roles:    rRes.data  ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const body = (await req.json()) as { status?: string; role?: string };
    const s = createServerSupabaseClient();
    const { id } = params;

    if (body.status) {
      const { error } = await s.from('members')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      // อัปเดต approval ด้วย
      await s.from('approvals')
        .update({ status: body.status, updated_at: new Date().toISOString() })
        .eq('member_id', id)
        .eq('status', 'pending');
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

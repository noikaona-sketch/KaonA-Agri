import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      member_id:string; crop_name:string; plot_id:string;
      product_id?:string|null; planted_at:string;
      expected_harvest_at?:string|null; area_planted_rai?:number|null;
      season_year?:number; quota_kg?:number|null;
      status?:string; source?:string; member_note?:string|null;
      confirmed_at?:string;
    };

    const s      = createServerSupabaseClient();
    const caller = await resolveApprovedMember(request, s, body.member_id);
    if (!caller.ok) return caller.response;

    if (!body.plot_id) {
      return NextResponse.json({ error: 'กรุณาเลือกแปลงก่อนสร้างรอบปลูก' }, { status: 400 });
    }

    const { data, error } = await s
      .from('planting_cycles')
      .insert({
        member_id:           caller.memberId,
        crop_name:           body.crop_name,
        plot_id:             body.plot_id,
        product_id:          body.product_id || null,
        planted_at:          body.planted_at,
        expected_harvest_at: body.expected_harvest_at || null,
        area_planted_rai:    body.area_planted_rai ?? null,
        season_year:         body.season_year ?? (new Date().getFullYear() + 543),
        quota_kg:            body.quota_kg ?? null,
        status:              body.status ?? 'growing',
        source:              body.source ?? 'manual',
        created_by:          caller.memberId,
        role_used:           'farmer',
        member_note:         body.member_note ?? null,
        confirmed_at:        body.confirmed_at ?? new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok:true, id: (data as { id:string }).id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

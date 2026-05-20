import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdmin } from '../_admin-auth';
import { evaluateMemberReadiness } from '../readiness-policy';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

    const s = createServerSupabaseClient();
    const { id } = params;

    const [mRes, pRes, vRes, rRes, dRes, lRes] = await Promise.all([
      s.from('members')
        .select('id,full_name,phone,citizen_id_masked,address,subdistrict,district,province,status,registration_type,line_user_id,line_display_name,line_picture_url,created_at,updated_at,bank_name,bank_account_number,bank_account_name,bank_verified_status,return_reason,returned_at,rejection_reason')
        .eq('id', id).maybeSingle(),
      s.from('plots')
        .select('id,name,area_rai,lat,lng,status,province,land_doc_type,land_doc_number')
        .eq('member_id', id).is('deleted_at', null),
      s.from('member_vehicles')
        .select('id,vehicle_type,plate_number,brand,model,year_be,province,capacity_ton')
        .eq('member_id', id).is('deleted_at', null),
      s.from('member_roles')
        .select('role,is_primary').eq('member_id', id),
      s.from('member_documents')
        .select('doc_type,verified,file_url').eq('member_id', id),
      s.from('member_approval_logs')
        .select('id,action,reason,acted_by,created_at').eq('member_id', id)
        .order('created_at', { ascending: false }).limit(20),
    ]);

    if (mRes.error) return NextResponse.json({ error: mRes.error.message }, { status: 500 });
    if (!mRes.data) return NextResponse.json({ error: 'ไม่พบข้อมูลสมาชิก' }, { status: 404 });

    const roleList = (rRes.data ?? []).map((r) => r.role);
    const readiness = evaluateMemberReadiness({
      phone: mRes.data.phone,
      address: mRes.data.address,
      subdistrict: mRes.data.subdistrict,
      district: mRes.data.district,
      province: mRes.data.province,
      citizen_id_masked: mRes.data.citizen_id_masked,
      line_user_id: mRes.data.line_user_id,
      bank_name: mRes.data.bank_name,
      bank_account_number: mRes.data.bank_account_number,
      bank_verified_status: mRes.data.bank_verified_status,
      has_plots: (pRes.data ?? []).length > 0,
      has_vehicles: (vRes.data ?? []).length > 0,
      roles: roleList,
    });

    return NextResponse.json({
      member:   mRes.data,
      plots:    pRes.data  ?? [],
      vehicles: vRes.data  ?? [],
      roles:    rRes.data  ?? [],
      docs:     dRes.data  ?? [],
      logs:     lRes.data  ?? [],
      readyToApprove: readiness.readyToApprove,
      missingFields: readiness.missingFields,
      readinessReason: readiness.readinessReason,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });

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

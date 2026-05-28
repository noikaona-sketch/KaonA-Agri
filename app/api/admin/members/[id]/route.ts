import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../_admin-auth';
import { evaluateMemberReadiness } from '../readiness-policy';

type Params = { params: { id: string } };

export async function GET(_req: Request, { params }: Params) {
  try {
    const auth = await requireAdminPermission('members.read');
    if (isForbidden(auth)) return auth.forbidden;

    const s = createServerSupabaseClient();
    const { id } = params;

    const [mRes, pRes, vRes, rRes, dRes, lRes] = await Promise.all([
      s.from('members')
        .select('id,full_name,phone,citizen_id_masked,address,house_no,moo,subdistrict,district,province,status,registration_type,line_user_id,line_display_name,line_picture_url,created_at,updated_at,bank_name,bank_account_number,bank_account_name,bank_verified_status,return_reason,returned_at,rejection_reason')
        .eq('id', id).maybeSingle(),
      s.from('plots')
        .select('id,name,area_rai,lat,lng,status,province,district,sub_district,description,land_doc_type,land_doc_number')
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
    const auth = await requireAdminPermission('members.write');
    if (isForbidden(auth)) return auth.forbidden;

    const body = (await req.json()) as {
      status?: string; role?: string;
      plot?: { id: string; name?: string; area_rai?: number; province?: string | null; district?: string | null; sub_district?: string | null; description?: string | null; lat?: number | null; lng?: number | null; land_doc_type?: string | null; land_doc_number?: string | null };
    };
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
    if (body.plot !== undefined && !body.plot?.id) {
      return NextResponse.json({ error: 'plot id required' }, { status: 400 });
    }
    if (body.plot?.id) {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.plot.name !== undefined) patch.name = body.plot.name?.trim() || null;
      if (body.plot.area_rai !== undefined) {
        const area = Number(body.plot.area_rai);
        if (!Number.isFinite(area) || area <= 0) return NextResponse.json({ error: 'area_rai must be > 0' }, { status: 400 });
        patch.area_rai = area;
      }
      if (body.plot.province !== undefined) patch.province = body.plot.province?.trim() || null;
      if (body.plot.district !== undefined) patch.district = body.plot.district?.trim() || null;
      if (body.plot.sub_district !== undefined) patch.sub_district = body.plot.sub_district?.trim() || null;
      if (body.plot.description !== undefined) patch.description = body.plot.description?.trim() || null;
      if (body.plot.lat !== undefined) patch.lat = body.plot.lat;
      if (body.plot.lng !== undefined) patch.lng = body.plot.lng;
      if (body.plot.land_doc_type !== undefined) patch.land_doc_type = body.plot.land_doc_type?.trim() || null;
      if (body.plot.land_doc_number !== undefined) patch.land_doc_number = body.plot.land_doc_number?.trim() || null;
      const { error } = await s.from('plots').update(patch).eq('id', body.plot.id).eq('member_id', id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const auth = await requireAdminPermission('members.write');
    if (isForbidden(auth)) return auth.forbidden;
    const { id } = await params;
    const s = createServerSupabaseClient();
    // Soft cancel only (not hard delete):
    // set status = rejected + reason พิเศษ เพื่อให้สมาชิกเห็น flow สมัครใหม่
    const { error } = await s.from('members')
      .update({
        status:           'rejected',
        rejection_reason: 'cancelled_by_admin',
        updated_at:       new Date().toISOString(),
      })
      .eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // เคลียร์ approval ที่ pending อยู่ เพื่อไม่ให้คิวอนุมัติค้าง/ปนสถานะ rejected
    await s.from('approvals')
      .delete()
      .eq('member_id', id)
      .eq('resource_type', 'member')
      .eq('status', 'pending');

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

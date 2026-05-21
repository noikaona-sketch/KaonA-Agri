import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../../_admin-auth';

type Params = { params: { id: string } };

export async function PATCH(req: Request, { params }: Params) {
  const permission = await requireAdminPermission('members.import');
  if (isForbidden(permission)) return permission.forbidden;

  const body = (await req.json()) as {
    full_name?: string;
    phone?: string | null;
    district?: string | null;
    subdistrict?: string | null;
    province?: string | null;
    bank_name?: string | null;
    bank_account_name?: string | null;
    bank_account_number?: string | null;
    citizen_id_masked?: string | null;
    line_user_id?: string | null;
  };

  const payload = {
    full_name: body.full_name,
    phone: body.phone,
    district: body.district,
    subdistrict: body.subdistrict,
    province: body.province,
    bank_name: body.bank_name,
    bank_account_name: body.bank_account_name,
    bank_account_number: body.bank_account_number,
    citizen_id_masked: body.citizen_id_masked,
    line_user_id: body.line_user_id,
    updated_at: new Date().toISOString(),
  };

  const s = createServerSupabaseClient();
  const { error } = await s.from('members').update(payload).eq('id', params.id).eq('registration_type', 'admin_import');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

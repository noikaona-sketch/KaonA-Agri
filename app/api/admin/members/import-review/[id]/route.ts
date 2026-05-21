import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../../_admin-auth';

type Params = { params: { id: string } };

function maskBankAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length <= 4) return `****${digits}`;
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function isSafeMaskedCitizenId(value: string | null | undefined): boolean {
  if (value == null || value === '') return true;
  const normalized = value.trim();
  if (!normalized) return true;
  if (/^\d{13}$/.test(normalized)) return false;
  if (normalized.toUpperCase() === 'PENDING') return true;
  const allowed = /^[0-9Xx*\-\s]{6,32}$/;
  const hasMask = /[Xx*]/.test(normalized);
  return allowed.test(normalized) && hasMask;
}

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

  if (!isSafeMaskedCitizenId(body.citizen_id_masked)) {
    return NextResponse.json({ error: 'citizen_id_masked ต้องเป็นค่าที่ masked/safe เท่านั้น' }, { status: 400 });
  }

  const payload = {
    full_name: body.full_name,
    phone: body.phone,
    district: body.district,
    subdistrict: body.subdistrict,
    province: body.province,
    bank_name: body.bank_name,
    bank_account_name: body.bank_account_name,
    bank_account_number: maskBankAccountNumber(body.bank_account_number),
    citizen_id_masked: body.citizen_id_masked,
    line_user_id: body.line_user_id,
    updated_at: new Date().toISOString(),
  };

  const s = createServerSupabaseClient();
  const { error } = await s.from('members').update(payload).eq('id', params.id).eq('registration_type', 'admin_import');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

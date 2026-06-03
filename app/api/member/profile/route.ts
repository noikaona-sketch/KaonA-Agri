import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { resolveApprovedMember }      from '../_auth';

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request) {
  try {
    const s      = createServerSupabaseClient();
    const caller = await resolveApprovedMember(request, s, undefined, { allowExplicitIdentity: false });
    if (!caller.ok) return caller.response;

    const body = (await request.json()) as {
      full_name?: string; phone?: string | null;
      address?: string | null; subdistrict?: string | null;
      district?: string | null; province?: string | null;
      bank_name?: string | null; bank_account_number?: string | null; bank_account_name?: string | null;
    };
    const update: Record<string, string | null> = {};
    if (body.full_name?.trim())        update.full_name           = body.full_name.trim();
    if ('phone'               in body) update.phone               = body.phone?.trim()               || null;
    if ('address'             in body) update.address             = body.address?.trim()             || null;
    if ('subdistrict'         in body) update.subdistrict         = body.subdistrict?.trim()         || null;
    if ('district'            in body) update.district            = body.district?.trim()            || null;
    if ('province'            in body) update.province            = body.province?.trim()            || null;
    if ('bank_name'           in body) update.bank_name           = body.bank_name                   || null;
    if ('bank_account_number' in body) update.bank_account_number = body.bank_account_number?.trim() || null;
    if ('bank_account_name'   in body) update.bank_account_name   = body.bank_account_name?.trim()  || null;

    if (!Object.keys(update).length)
      return NextResponse.json({ error: 'ไม่มีข้อมูลที่จะอัปเดต' }, { status: 400 });

    const { error } = await s.from('members').update(update).eq('id', caller.memberId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

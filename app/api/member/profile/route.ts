import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      memberId?: string;
      fullName?: string;
      phone?: string | null;
      address?: string | null;
      citizenIdMasked?: string | null;
    };

    if (!body.memberId || !body.fullName?.trim()) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const { error } = await s.from('members').update({
      full_name:          body.fullName.trim(),
      phone:              body.phone ?? null,
      address:            body.address ?? null,
      citizen_id_masked:  body.citizenIdMasked ?? null,
      updated_at:         new Date().toISOString(),
    }).eq('id', body.memberId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

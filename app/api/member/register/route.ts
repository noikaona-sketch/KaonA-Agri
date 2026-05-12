import { NextResponse } from 'next/server';

import { createServerSupabaseClient, getLineChannelId } from '../../auth/line/line-auth-helpers';

type RegisterPayload = {
  idToken?: string;
  fullName?: string;
  phone?: string;
  citizenIdMasked?: string;
  address?: string;
};

async function verifyLineUserId(idToken: string): Promise<string> {
  const channelId = getLineChannelId();
  if (!channelId) throw new Error('LINE channel id is not configured');

  const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });

  if (!res.ok) throw new Error('LINE token verification failed');
  const data = (await res.json()) as { sub?: string };
  if (!data.sub) throw new Error('LINE user id missing');
  return data.sub;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterPayload;

    if (!body.idToken || !body.fullName || !body.citizenIdMasked) {
      return NextResponse.json({ error: 'idToken, fullName, citizenIdMasked are required' }, { status: 400 });
    }

    const lineUserId = await verifyLineUserId(body.idToken);
    // service role — bypass RLS ได้ทั้งหมด
    const supabase = createServerSupabaseClient();

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id')
      .eq('line_user_id', lineUserId)
      .maybeSingle();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Member profile not found for LINE account' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('members')
      .update({
        full_name: body.fullName,
        phone: body.phone ?? null,
        citizen_id_masked: body.citizenIdMasked,
        address: body.address ?? null,
        status: 'pending',
      })
      .eq('id', member.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to save registration details' }, { status: 500 });
    }

    // ใช้ insert + on conflict do nothing แทน upsert (partial index ไม่รองรับ onConflict)
    const { error: approvalError } = await supabase.from('approvals').insert({
      member_id: member.id,
      requested_by: member.id,
      resource_type: 'member',
      resource_id: member.id,
      status: 'pending',
      note: 'Member onboarding request',
    });

    if (approvalError && !approvalError.message.includes('duplicate')) {
      return NextResponse.json({ error: 'Failed to create onboarding approval request' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[REGISTER_MEMBER_ROUTE]', error);
    return NextResponse.json({ error: 'Registration request failed' }, { status: 500 });
  }
}

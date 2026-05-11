import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type RegisterPayload = {
  idToken?: string;
  fullName?: string;
  phone?: string;
  citizenIdMasked?: string;
  address?: string;
};

type LineVerifyResponse = {
  sub?: string;
};

function createServerSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getLineChannelId() {
  const explicitChannelId = process.env.LINE_CHANNEL_ID ?? process.env.NEXT_PUBLIC_LINE_CHANNEL_ID;

  if (explicitChannelId) {
    return explicitChannelId;
  }

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID ?? '';
  const [channelId] = liffId.split('-');

  return channelId || '';
}

async function verifyLineUserId(idToken: string): Promise<string> {
  const lineChannelId = getLineChannelId();

  if (!lineChannelId) {
    throw new Error('LINE channel id is not configured');
  }

  const verifyResponse = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      id_token: idToken,
      client_id: lineChannelId,
    }),
  });

  if (!verifyResponse.ok) {
    throw new Error('LINE token verification failed');
  }

  const verifyData = (await verifyResponse.json()) as LineVerifyResponse;

  if (!verifyData.sub) {
    throw new Error('LINE user id missing');
  }

  return verifyData.sub;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterPayload;

    if (!body.idToken || !body.fullName || !body.citizenIdMasked) {
      return NextResponse.json({ error: 'idToken, fullName, citizenIdMasked are required' }, { status: 400 });
    }

    const lineUserId = await verifyLineUserId(body.idToken);
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

    const { error: approvalError } = await supabase.from('approvals').upsert(
      {
        member_id: member.id,
        requested_by: member.id,
        resource_type: 'member',
        resource_id: member.id,
        status: 'pending',
        note: 'Member onboarding request',
      },
      { onConflict: 'member_id,resource_type,resource_id' }
    );

    if (approvalError) {
      return NextResponse.json({ error: 'Failed to create onboarding approval request' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[REGISTER_MEMBER_ROUTE]', error);
    return NextResponse.json({ error: 'Registration request failed' }, { status: 500 });
  }
}

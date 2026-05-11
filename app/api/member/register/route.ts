import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

type RegisterPayload = {
  lineUserId?: string;
  fullName?: string;
  phone?: string;
  citizenIdMasked?: string;
  address?: string;
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterPayload;

    if (!body.lineUserId || !body.fullName || !body.citizenIdMasked) {
      return NextResponse.json({ error: 'lineUserId, fullName, citizenIdMasked are required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id')
      .eq('line_user_id', body.lineUserId)
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

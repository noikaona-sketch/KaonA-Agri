import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

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

function maskCitizenId(citizenId: string) {
  const digits = citizenId.replace(/\D/g, '');
  if (!digits) return '';
  return `${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-4)}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lineUserId?: string;
      fullName?: string;
      phone?: string;
      citizenId?: string;
      address?: string;
    };

    if (!body.lineUserId || !body.fullName || !body.citizenId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const result = await supabase
      .from('members')
      .update({
        full_name: body.fullName,
        phone: body.phone ?? null,
        citizen_id_masked: maskCitizenId(body.citizenId),
        status: 'pending',
      })
      .eq('line_user_id', body.lineUserId)
      .select('id')
      .single();

    if (result.error) {
      return NextResponse.json({ error: 'Failed to submit onboarding' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, memberId: result.data.id });
  } catch {
    return NextResponse.json({ error: 'Unexpected submit failure' }, { status: 500 });
  }
}

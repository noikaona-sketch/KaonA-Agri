import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET() {
  const s = createServerSupabaseClient();
  const { data } = await s.from('pickup_locations').select('*').eq('active', true).order('name');
  return NextResponse.json({ locations: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; name: string; address?: string; map_url?: string; active?: boolean };
    const s = createServerSupabaseClient();
    const { id, ...payload } = body;
    const { error } = id
      ? await s.from('pickup_locations').update(payload).eq('id', id)
      : await s.from('pickup_locations').insert(payload);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

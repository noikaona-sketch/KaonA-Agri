import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('member_id');
    if (!memberId) return NextResponse.json({ plots: [] });

    const s = createServerSupabaseClient();
    const { data, error } = await s
      .from('plots')
      .select('id,name,area_rai,lat,lng,status,province,land_doc_type')
      .eq('member_id', memberId)
      .order('created_at');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ plots: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

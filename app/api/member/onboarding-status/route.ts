import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/member/onboarding-status?member_id=xxx
// นับ plots, cycles, no_burn, seed_reservations ผ่าน service role (ข้าม RLS)
export async function GET(request: Request) {
  const memberId = new URL(request.url).searchParams.get('member_id');
  if (!memberId) return NextResponse.json({ error: 'member_id required' }, { status: 400 });

  const s = createServerSupabaseClient();
  const [plotRes, cycleRes, burnRes, seedRes] = await Promise.all([
    s.from('plots').select('id', { count:'exact', head:true }).eq('member_id', memberId).is('deleted_at', null),
    s.from('planting_cycles').select('id', { count:'exact', head:true }).eq('member_id', memberId).neq('status','cancelled'),
    s.from('no_burn_requests').select('id', { count:'exact', head:true }).eq('member_id', memberId),
    s.from('seed_reservations').select('id', { count:'exact', head:true }).eq('member_id', memberId),
  ]);

  return NextResponse.json({
    plot:    plotRes.count  ?? 0,
    cycle:   cycleRes.count ?? 0,
    no_burn: burnRes.count  ?? 0,
    seed:    seedRes.count  ?? 0,
  });
}

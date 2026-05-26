import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

// GET /api/leader/team?member_id=xxx  (leader ดูทีมตัวเอง)
// GET /api/leader/team?group_id=xxx   (admin ดูกลุ่มเฉพาะ)
// GET /api/leader/team                (admin ดูทุกกลุ่ม)
export async function GET(request: Request) {
  try {
    const s          = createServerSupabaseClient();
    const url        = new URL(request.url);
    const memberId   = url.searchParams.get('member_id');
    const groupId    = url.searchParams.get('group_id');

    // ดึง groups ที่ต้องการ
    let groupQuery = s.from('member_groups')
      .select(`
        id, name, description,
        member_group_members(
          id, is_leader,
          member:member_id(id, full_name, phone, status)
        )
      `);

    if (groupId) {
      groupQuery = groupQuery.eq('id', groupId);
    } else if (memberId) {
      // หา group ที่ member นี้เป็น leader
      const { data: leaderRows } = await s
        .from('member_group_members')
        .select('group_id')
        .eq('member_id', memberId)
        .eq('is_leader', true);
      const gids = (leaderRows ?? []).map(r => r.group_id as string);
      if (!gids.length) return NextResponse.json({ groups: [] });
      groupQuery = groupQuery.in('id', gids);
    }

    const { data: groups, error } = await groupQuery;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!groups?.length) return NextResponse.json({ groups: [] });

    // รวบรวม member_ids ทั้งหมด
    const memberIds = [...new Set(
      (groups ?? []).flatMap(g =>
        g.member_group_members.map((m: { member: { id: string } | { id: string }[] | null }) => {
          if (!m.member) return undefined;
          return Array.isArray(m.member) ? m.member[0]?.id : m.member.id;
        }).filter((id): id is string => !!id)
      )
    )];

    if (!memberIds.length) return NextResponse.json({
      groups: (groups ?? []).map(g => ({ ...g, member_group_members: g.member_group_members, memberData: {} }))
    });

    // ดึงข้อมูลทุกอย่างพร้อมกัน
    const [cyclesRes, bookingsRes, noBurnRes, seedRes] = await Promise.all([
      // รอบปลูกล่าสุดของแต่ละ member
      s.from('planting_cycles')
        .select('id, member_id, season, status, planted_area_rai, created_at')
        .in('member_id', memberIds)
        .order('created_at', { ascending: false }),

      // การจองรับซื้อล่าสุด
      s.from('harvest_bookings')
        .select('id, member_id, status, preferred_date, created_at')
        .in('member_id', memberIds)
        .order('created_at', { ascending: false }),

      // คำขอไม่เผา
      s.from('no_burn_requests')
        .select('id, member_id, status, created_at')
        .in('member_id', memberIds)
        .order('created_at', { ascending: false }),

      // จองเมล็ด
      s.from('seed_reservations')
        .select('id, member_id, status, quantity_kg, created_at')
        .in('member_id', memberIds)
        .order('created_at', { ascending: false }),
    ]);

    // จัดข้อมูลตาม member_id (เอาแค่ล่าสุด)
    type MemberData = {
      cycle:   { status: string; area: number; season: string } | null;
      booking: { status: string; date: string | null }         | null;
      noburn:  { status: string }                               | null;
      seed:    { status: string; qty: number }                  | null;
    };
    const memberData: Record<string, MemberData> = {};

    for (const id of memberIds) {
      const cycle   = (cyclesRes.data   ?? []).find(r => r.member_id === id);
      const booking = (bookingsRes.data ?? []).find(r => r.member_id === id);
      const noburn  = (noBurnRes.data   ?? []).find(r => r.member_id === id);
      const seed    = (seedRes.data     ?? []).find(r => r.member_id === id);

      memberData[id] = {
        cycle:   cycle   ? { status: cycle.status,   area: cycle.planted_area_rai ?? 0, season: cycle.season ?? '' } : null,
        booking: booking ? { status: booking.status, date: booking.preferred_date ?? null } : null,
        noburn:  noburn  ? { status: noburn.status } : null,
        seed:    seed    ? { status: seed.status, qty: seed.quantity_kg ?? 0 } : null,
      };
    }

    return NextResponse.json({ groups, memberData });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

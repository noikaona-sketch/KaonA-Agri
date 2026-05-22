import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET /api/admin/reports/by-area?level=district|subdistrict|group&from=&to=
export async function GET(request: Request) {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const url   = new URL(request.url);
  const level = (url.searchParams.get('level') ?? 'district') as 'district' | 'subdistrict' | 'group';
  const to    = url.searchParams.get('to')   ?? new Date().toISOString().slice(0, 10);
  const from  = url.searchParams.get('from') ?? new Date(Date.now() - 29 * 86400_000).toISOString().slice(0, 10);
  const s     = createServerSupabaseClient();

  if (level === 'group') {
    // ── รายงานตามกลุ่มเกษตรกร ─────────────────────────────────────────
    const [groupRes, cycleRes] = await Promise.all([
      s.from('member_groups')
        .select('id,name,member_group_members(member_id)')
        .is('deleted_at', null),
      s.from('planting_cycles')
        .select('member_id,area_planted_rai,actual_yield_kg,burn_practice')
        .gte('started_at', `${from}T00:00:00`),
    ]);

    if (groupRes.error) return NextResponse.json({ error: groupRes.error.message }, { status: 500 });

    type CycleRow = { member_id: string; area_planted_rai: number | null; actual_yield_kg: number | null; burn_practice: string | null };
    const cycles  = (cycleRes.data ?? []) as CycleRow[];

    const rows = (groupRes.data ?? []).map((g) => {
      const memberIds = new Set((g.member_group_members as { member_id: string }[]).map((m) => m.member_id));
      const groupCycles = cycles.filter((c) => memberIds.has(c.member_id));
      const totalRai    = groupCycles.reduce((s: number, c) => s + (c.area_planted_rai ?? 0), 0);
      const totalYield  = groupCycles.reduce((s: number, c) => s + (c.actual_yield_kg  ?? 0), 0);
      const noBurnCount = groupCycles.filter((c) => c.burn_practice === 'no_burn').length;
      return {
        key:           g.id,
        label:         g.name,
        member_count:  memberIds.size,
        cycle_count:   groupCycles.length,
        total_rai:     totalRai,
        total_yield_kg:totalYield,
        yield_per_rai: totalRai > 0 ? totalYield / totalRai : null,
        no_burn_count: noBurnCount,
        no_burn_pct:   groupCycles.length > 0 ? Math.round((noBurnCount / groupCycles.length) * 100) : null,
      };
    }).sort((a, b) => b.total_yield_kg - a.total_yield_kg);

    return NextResponse.json({ level, from, to, rows });
  }

  // ── รายงานตามอำเภอ หรือ ตำบล ─────────────────────────────────────────
  const { data: members, error: memErr } = await s
    .from('members')
    .select('id,district,subdistrict,province');
  if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

  const { data: cycles, error: cycErr } = await s
    .from('planting_cycles')
    .select('member_id,area_planted_rai,actual_yield_kg,burn_practice,started_at')
    .gte('started_at', `${from}T00:00:00`);
  if (cycErr) return NextResponse.json({ error: cycErr.message }, { status: 500 });

  const { data: noBurnReqs } = await s
    .from('no_burn_requests')
    .select('member_id,status')
    .eq('status', 'approved');

  type Member   = typeof members extends (infer T)[] | null ? T : never;
  type CycleRow = { member_id: string; area_planted_rai: number | null; actual_yield_kg: number | null; burn_practice: string | null; started_at: string };

  const memberMap  = new Map((members ?? []).map((m) => [m.id as string, m as Member]));
  const approvedNB = new Set((noBurnReqs ?? []).map((r) => r.member_id as string));

  // รวมตาม district หรือ subdistrict
  const areaMap: Record<string, {
    label: string; province: string | null; subdistrict?: string | null;
    member_ids: Set<string>; total_rai: number; total_yield_kg: number;
    cycle_count: number; no_burn_count: number; no_burn_approved_count: number;
  }> = {};

  (cycles ?? [] as CycleRow[]).forEach((c) => {
    const m   = memberMap.get(c.member_id);
    if (!m) return;
    const key = level === 'subdistrict'
      ? `${m.subdistrict ?? ''}__${m.district ?? ''}`
      : (m.district ?? 'ไม่ระบุ');
    const label = level === 'subdistrict'
      ? (m.subdistrict ? `ต.${m.subdistrict}` : 'ไม่ระบุ')
      : (m.district    ? `อ.${m.district}`    : 'ไม่ระบุ');

    if (!areaMap[key]) areaMap[key] = { label, province: m.province as string | null, subdistrict: level === 'subdistrict' ? (m.subdistrict as string | null) : undefined, member_ids: new Set(), total_rai: 0, total_yield_kg: 0, cycle_count: 0, no_burn_count: 0, no_burn_approved_count: 0 };
    areaMap[key].member_ids.add(c.member_id);
    areaMap[key].total_rai          += c.area_planted_rai ?? 0;
    areaMap[key].total_yield_kg     += c.actual_yield_kg  ?? 0;
    areaMap[key].cycle_count        += 1;
    if (c.burn_practice === 'no_burn') areaMap[key].no_burn_count++;
    if (approvedNB.has(c.member_id))   areaMap[key].no_burn_approved_count++;
  });

  const rows = Object.entries(areaMap).map(([, v]) => ({
    label:          v.label,
    province:       v.province,
    member_count:   v.member_ids.size,
    cycle_count:    v.cycle_count,
    total_rai:      v.total_rai,
    total_yield_kg: v.total_yield_kg,
    yield_per_rai:  v.total_rai > 0 ? v.total_yield_kg / v.total_rai : null,
    no_burn_count:  v.no_burn_count,
    no_burn_approved_count: v.no_burn_approved_count,
    no_burn_pct:    v.cycle_count > 0 ? Math.round((v.no_burn_count / v.cycle_count) * 100) : null,
  })).sort((a, b) => b.total_rai - a.total_rai);

  return NextResponse.json({ level, from, to, rows });
}

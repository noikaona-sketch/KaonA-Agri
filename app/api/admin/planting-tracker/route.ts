import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdmin }               from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = createServerSupabaseClient();

  // ดึง stock movements ประเภท sale/out เท่านั้น (ขายจริง ไม่ใช่จอง)
  const { data: movements } = await s
    .from('stock_movements')
    .select(`
      id, movement_no, qty, unit, ref_type, ref_id, created_at,
      product:product_id(id, name, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type)
    `)
    .in('movement_type', ['out','sale'])
    .in('ref_type', ['sale','sale_order','reservation','seed_reservation'])
    .order('created_at', { ascending: false });

  if (!movements?.length) return NextResponse.json({ items: [] });

  // ดึง member จาก ref_id
  const saleIds = movements.filter(m => ['sale','sale_order'].includes(m.ref_type??'')).map(m => m.ref_id).filter(Boolean) as string[];
  const rsvIds  = movements.filter(m => ['reservation','seed_reservation'].includes(m.ref_type??'')).map(m => m.ref_id).filter(Boolean) as string[];

  const [saleRes, rsvRes] = await Promise.all([
    saleIds.length ? s.from('sale_orders').select('id, order_number, member_id, members:member_id(id, full_name, phone)').in('id', saleIds) : Promise.resolve({ data: [] }),
    rsvIds.length  ? s.from('seed_reservations').select('id, reservation_no, member_id, members:member_id(id, full_name, phone)').in('id', rsvIds) : Promise.resolve({ data: [] }),
  ]);

  type RefRow = { id:string; order_number?:string; reservation_no?:string; member_id:string; members?:{ id:string; full_name:string; phone:string|null }|null };
  const refMap = new Map<string, RefRow>();
  [...(saleRes.data??[]), ...(rsvRes.data??[])].forEach((r: unknown) => {
    const row = r as RefRow;
    if (row.id) refMap.set(row.id, row);
  });

  // รวม member ids
  const memberIds = new Set<string>();
  movements.forEach(m => {
    const ref = m.ref_id ? refMap.get(m.ref_id) : null;
    if (ref?.member_id) memberIds.add(ref.member_id);
  });

  if (!memberIds.size) return NextResponse.json({ items: [] });

  // ดึง plots + cycles
  const [plotsRes, cyclesRes] = await Promise.all([
    s.from('plots').select('id, member_id, name, area_rai').in('member_id', [...memberIds]).is('deleted_at', null),
    s.from('planting_cycles').select('id, member_id, crop_name, planted_at, status, quota_kg, season_year').in('member_id', [...memberIds]).not('status', 'eq', 'cancelled'),
  ]);
  const plots  = plotsRes.data  ?? [];
  const cycles = cyclesRes.data ?? [];

  // build per-member map
  type BillRow = { bill_id:string; bill_no:string; variety_name:string; qty:number; bag_weight_kg:number; quota_kg:number; days_to_harvest:number|null; product_id:string|null; created_at:string };
  type CycleRow = { id:string; crop_name:string; planted_at:string|null; status:string; season_year:number|null };
  type MemberRow = { member_id:string; member_name:string; member_phone:string|null; plot_count:number; total_rai:number; bill_count:number; bills:BillRow[]; has_cycle:boolean; cycles:CycleRow[] };

  const memberMap = new Map<string, MemberRow>();
  function getOrCreate(mid: string, memberInfo: { full_name:string; phone:string|null }): MemberRow {
    if (!memberMap.has(mid)) {
      const mPlots  = plots.filter(p => p.member_id === mid);
      const mCycles = cycles.filter(c => c.member_id === mid);
      memberMap.set(mid, {
        member_id:   mid,
        member_name: memberInfo.full_name,
        member_phone:memberInfo.phone,
        plot_count:  mPlots.length,
        total_rai:   mPlots.reduce((s,p) => s+Number(p.area_rai), 0),
        bill_count:  0, bills: [],
        has_cycle:   mCycles.length > 0,
        cycles:      mCycles.map(c => ({ id:c.id, crop_name:c.crop_name, planted_at:c.planted_at, status:c.status, season_year:c.season_year })),
      });
    }
    return memberMap.get(mid)!;
  }

  for (const m of movements) {
    const ref    = m.ref_id ? refMap.get(m.ref_id) : null;
    if (!ref?.member_id) continue;
    const member = ref.members as { id:string; full_name:string; phone:string|null }|null|undefined;
    if (!member) continue;
    const row    = getOrCreate(ref.member_id, { full_name:member.full_name, phone:member.phone??null });
    const p      = m.product as unknown as { id:string; name:string; bag_weight_kg:number|null; days_to_harvest:number|null; yield_ratio_kg:number|null }|null;
    const bagKg  = p?.bag_weight_kg ?? 10;
    const ratio  = p?.yield_ratio_kg ?? 600;
    row.bills.push({
      bill_id:        m.id,
      bill_no:        (ref as RefRow & {order_number?:string})?.order_number ?? (ref as RefRow & {reservation_no?:string})?.reservation_no ?? m.movement_no,
      variety_name:   p?.name ?? '—',
      qty:            m.qty,
      bag_weight_kg:  bagKg,
      quota_kg:       m.qty * bagKg * ratio,
      days_to_harvest:p?.days_to_harvest ?? null,
      product_id:     p?.id ?? null,
      created_at:     m.created_at,
    });
    row.bill_count++;
  }

  return NextResponse.json({ items: [...memberMap.values()] });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    member_id:string; crop_name:string; plot_id?:string;
    product_id?:string; planted_at:string; expected_harvest_at?:string;
    area_planted_rai?:number; season_year?:number; quota_kg?:number; member_note?:string;
  };

  const s = createServerSupabaseClient();
  const { data, error } = await s.from('planting_cycles').insert({
    member_id:           body.member_id,
    crop_name:           body.crop_name,
    plot_id:             body.plot_id || null,
    product_id:          body.product_id || null,
    planted_at:          body.planted_at,
    expected_harvest_at: body.expected_harvest_at || null,
    area_planted_rai:    body.area_planted_rai ?? null,
    season_year:         body.season_year ?? (new Date().getFullYear()+543),
    quota_kg:            body.quota_kg ?? null,
    status:              'growing',
    source:              'admin_entry',
    created_by:          body.member_id,
    role_used:           'admin',
    member_note:         body.member_note ?? 'บันทึกโดย admin',
    confirmed_at:        new Date().toISOString(),
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true, id:(data as {id:string}).id });
}

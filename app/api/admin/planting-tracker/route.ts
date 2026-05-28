import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdmin } from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

/* ── GET — ดึงรายการซื้อเมล็ดที่ completed/received (ไม่นับ pending/จอง) ── */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = createServerSupabaseClient();

  // 1. บิลขาย seed ที่ชำระแล้ว (sale_orders completed + order_items seed)
  const { data: orderItems } = await s
    .from('order_items')
    .select(`
      id, qty, unit_price, product_id, product_name,
      sale_orders!inner(id, order_number, status, created_at, member_id),
      products(id, name, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type, product_type, seed_variety)
    `)
    .eq('products.product_type', 'seed')
    .in('sale_orders.status', ['completed','confirmed'])
    .order('sale_orders.created_at', { ascending: false });

  // 2. seed_reservations ที่ซื้อแล้ว (confirmed = รับเงินแล้ว/ยืนยันแล้ว)
  const { data: seedRecs } = await s
    .from('seed_reservations')
    .select(`
      id, member_id, reservation_no, variety_name, qty_reserved, created_at, status,
      members:member_id(id, full_name, phone, status),
      products:product_id(id, name, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type)
    `)
    .in('status', ['confirmed','received','completed'])
    .order('created_at', { ascending: false });

  // รวม member ids จากทั้งสอง source
  const memberIds = new Set<string>();
  (orderItems ?? []).forEach(r => {
    const o = r.sale_orders as unknown as Record<string,unknown>;
    if (o?.member_id) memberIds.add(o.member_id as string);
  });
  (seedRecs ?? []).forEach(r => { if (r.member_id) memberIds.add(r.member_id); });

  if (!memberIds.size) return NextResponse.json({ items: [] });

  // 3. ข้อมูล members + plots + cycles
  const [membersRes, plotsRes, cyclesRes] = await Promise.all([
    s.from('members')
      .select('id, full_name, phone, status')
      .in('id', [...memberIds]),
    s.from('plots')
      .select('id, member_id, name, area_rai')
      .in('member_id', [...memberIds])
      .is('deleted_at', null),
    s.from('planting_cycles')
      .select('id, member_id, crop_name, planted_at, status, quota_kg, product_id, season_year')
      .in('member_id', [...memberIds])
      .not('status', 'eq', 'cancelled'),
  ]);

  const members  = membersRes.data ?? [];
  const plots    = plotsRes.data    ?? [];
  const cycles   = cyclesRes.data   ?? [];

  // build per-member map
  type MemberRow = {
    member_id:string; member_name:string; member_phone:string|null; member_status:string;
    plot_count:number; total_rai:number;
    bill_count:number; bills:BillRow[];
    has_cycle:boolean; cycles:CycleRow[];
  };
  type BillRow = {
    bill_id:string; bill_no:string; variety_name:string;
    qty:number; bag_weight_kg:number; quota_kg:number;
    days_to_harvest:number|null; product_id:string|null; created_at:string;
  };
  type CycleRow = { id:string; crop_name:string; planted_at:string|null; status:string; season_year:number|null };

  const memberMap = new Map<string, MemberRow>();

  function getOrCreate(mid: string): MemberRow {
    if (!memberMap.has(mid)) {
      const m = members.find(x => x.id === mid);
      const mPlots = plots.filter(p => p.member_id === mid);
      const mCycles = cycles.filter(c => c.member_id === mid);
      memberMap.set(mid, {
        member_id:     mid,
        member_name:   m?.full_name  ?? '—',
        member_phone:  m?.phone      ?? null,
        member_status: m?.status     ?? '',
        plot_count:    mPlots.length,
        total_rai:     mPlots.reduce((s, p) => s + Number(p.area_rai), 0),
        bill_count:    0,
        bills:         [],
        has_cycle:     mCycles.length > 0,
        cycles:        mCycles.map(c => ({
          id:c.id, crop_name:c.crop_name, planted_at:c.planted_at,
          status:c.status, season_year:c.season_year,
        })),
      });
    }
    return memberMap.get(mid)!;
  }

  // map order_items
  for (const r of orderItems ?? []) {
    const o = r.sale_orders as unknown as Record<string,unknown>;
    const p = r.products    as unknown as Record<string,unknown> | null;
    const mid = o?.member_id as string;
    if (!mid) continue;
    const row = getOrCreate(mid);
    const bagKg = (p?.bag_weight_kg as number) ?? 10;
    const ratio = (p?.yield_ratio_kg as number) ?? 600;
    row.bills.push({
      bill_id:        r.id as string,
      bill_no:        o?.order_number as string ?? '—',
      variety_name:   r.product_name ?? (p?.name as string) ?? '—',
      qty:            r.qty as number,
      bag_weight_kg:  bagKg,
      quota_kg:       (r.qty as number) * bagKg * ratio,
      days_to_harvest:(p?.days_to_harvest as number) ?? null,
      product_id:     r.product_id as string ?? null,
      created_at:     o?.created_at as string ?? '',
    });
    row.bill_count++;
  }

  // map seed_reservations
  for (const r of seedRecs ?? []) {
    const p = r.products as unknown as Record<string,unknown> | null;
    const row = getOrCreate(r.member_id);
    const bagKg = (p?.bag_weight_kg as number) ?? 10;
    const ratio = (p?.yield_ratio_kg as number) ?? 600;
    row.bills.push({
      bill_id:        r.id,
      bill_no:        r.reservation_no,
      variety_name:   r.variety_name ?? (p?.name as string) ?? '—',
      qty:            r.qty_reserved,
      bag_weight_kg:  bagKg,
      quota_kg:       r.qty_reserved * bagKg * ratio,
      days_to_harvest:(p?.days_to_harvest as number) ?? null,
      product_id:     p?.id as string ?? null,
      created_at:     r.created_at,
    });
    row.bill_count++;
  }

  return NextResponse.json({ items: [...memberMap.values()] });
}

/* ── POST — admin สร้างรอบปลูกแทน farmer ── */
export async function POST(request: Request) {
  const admin2 = await requireAdmin();
  if (!admin2) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    member_id:string; crop_name:string; plot_id?:string;
    product_id?:string; planted_at:string;
    expected_harvest_at?:string; area_planted_rai?:number;
    season_year?:number; quota_kg?:number; member_note?:string;
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
    season_year:         body.season_year ?? (new Date().getFullYear() + 543),
    quota_kg:            body.quota_kg ?? null,
    status:              'planted',
    source:              'admin_entry',
    created_by:          body.member_id,
    member_note:         body.member_note ?? 'บันทึกโดย admin',
    confirmed_at:        new Date().toISOString(),
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true, id:(data as {id:string}).id });
}

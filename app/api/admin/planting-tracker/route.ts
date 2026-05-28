import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdmin }               from '../members/_admin-auth';
import { isCornSeedProduct, isSeedProductMatchingCrop } from '@/lib/products/corn-seed';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = createServerSupabaseClient();

  // Source of truth: completed sale_orders(order_type='sale') + order_items
  const { data: saleOrders } = await s
    .from('sale_orders')
    .select('id,order_number,member_id,created_at,members:member_id(id, full_name, phone)')
    .eq('order_type', 'sale')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  if (!saleOrders?.length) return NextResponse.json({ items: [] });

  const saleOrderIds = saleOrders.map((o) => o.id).filter(Boolean);
  const { data: orderItems } = await s
    .from('order_items')
    .select(`
      id, order_id, qty, product_unit, created_at,
      product:product_id(id, name, category, product_type, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type)
    `)
    .in('order_id', saleOrderIds)
    .order('created_at', { ascending: false });

  if (!orderItems?.length) return NextResponse.json({ items: [] });
  type SaleOrderRow = { id:string; order_number:string|null; member_id:string|null; created_at:string; members?:{ id:string; full_name:string; phone:string|null }|null };
  const orderMap = new Map<string, SaleOrderRow>();
  (saleOrders as unknown as SaleOrderRow[]).forEach((o) => {
    orderMap.set(o.id, o);
  });

  // รวม member ids
  const memberIds = new Set<string>();
  orderItems.forEach((item) => {
    const order = item.order_id ? orderMap.get(item.order_id) : null;
    if (order?.member_id) memberIds.add(order.member_id);
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

  for (const item of orderItems) {
    const order  = item.order_id ? orderMap.get(item.order_id) : null;
    if (!order?.member_id) continue;
    const member = order.members as { id:string; full_name:string; phone:string|null }|null|undefined;
    if (!member) continue;
    const p      = item.product as unknown as { id:string; name:string; category:string|null; product_type:string|null; bag_weight_kg:number|null; days_to_harvest:number|null; yield_ratio_kg:number|null; crop_type:string|null }|null;
    if (!isSeedProductMatchingCrop({ category:p?.category, product_type:p?.product_type, crop_type:p?.crop_type, name:p?.name }, 'ข้าวโพด')) continue;
    const row    = getOrCreate(order.member_id, { full_name:member.full_name, phone:member.phone??null });
    const bagKg  = p?.bag_weight_kg ?? 10;
    const ratio  = p?.yield_ratio_kg ?? 600;
    row.bills.push({
      bill_id:        item.id,
      bill_no:        order.order_number ?? `SALE-${order.id.slice(0, 8)}`,
      variety_name:   p?.name ?? '—',
      qty:            item.qty,
      bag_weight_kg:  bagKg,
      quota_kg:       item.qty * bagKg * ratio,
      days_to_harvest:p?.days_to_harvest ?? null,
      product_id:     p?.id ?? null,
      created_at:     order.created_at || item.created_at,
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

  if (!body.crop_name) return NextResponse.json({ error: 'กรุณาเลือกชนิดพืช' }, { status: 400 });
  if (!body.expected_harvest_at) return NextResponse.json({ error: 'กรุณาระบุวันที่คาดว่าจะเก็บเกี่ยว' }, { status: 400 });

  const usesBillFlow = isCornSeedProduct({ category:'seed', product_type:'seed', crop_type:body.crop_name, name:body.crop_name });

  const s = createServerSupabaseClient();
  const { data, error } = await s.from('planting_cycles').insert({
    member_id:           body.member_id,
    crop_name:           body.crop_name,
    plot_id:             body.plot_id || null,
    product_id:          usesBillFlow ? (body.product_id || null) : null,
    planted_at:          body.planted_at,
    expected_harvest_at: body.expected_harvest_at || null,
    area_planted_rai:    body.area_planted_rai ?? null,
    season_year:         body.season_year ?? (new Date().getFullYear()+543),
    quota_kg:            usesBillFlow ? (body.quota_kg ?? null) : null,
    status:              'growing',
    source:              'manual',
    created_by:          body.member_id,
    role_used:           'admin',
    member_note:         body.member_note ?? 'บันทึกโดย admin',
    confirmed_at:        new Date().toISOString(),
  }).select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true, id:(data as {id:string}).id });
}

import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdmin }               from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

// GET — ดึงรายชื่อ member ที่ซื้อเมล็ดแล้ว พร้อม status รอบปลูก
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = createServerSupabaseClient();

  // ดึง seed reservations ทั้งหมดที่ confirmed/completed
  const { data: seeds } = await s
    .from('seed_reservations')
    .select(`
      id, member_id, reservation_no, variety_name, qty_reserved,
      created_at, status,
      member:member_id(id, full_name, phone, status),
      products:product_id(id, name, bag_weight_kg, days_to_harvest, yield_ratio_kg, crop_type)
    `)
    .in('status', ['confirmed','completed','received'])
    .order('created_at', { ascending: false });

  if (!seeds?.length) return NextResponse.json({ items: [] });

  // ดึงรอบปลูกที่มีอยู่
  const memberIds = [...new Set(seeds.map(s => s.member_id))];
  const { data: cycles } = await s
    .from('planting_cycles')
    .select('id, member_id, crop_name, planted_at, status, quota_kg, product_id')
    .in('member_id', memberIds)
    .not('status', 'eq', 'cancelled');

  // map รวมข้อมูล
  const items = seeds.map(seed => {
    const product = seed.products as unknown as Record<string,unknown> | null;
    const member  = seed.member as unknown as Record<string,unknown> | null;
    const bagKg   = (product?.bag_weight_kg as number) ?? 10;
    const ratio   = (product?.yield_ratio_kg as number) ?? 600;
    const quota   = seed.qty_reserved * bagKg * ratio;

    // หารอบปลูกที่ตรงกับ member + product
    const cycle = (cycles ?? []).find(c =>
      c.member_id === seed.member_id &&
      (c.product_id === (product?.id) || c.crop_name?.includes('ข้าวโพด'))
    );

    return {
      seed_id:        seed.id,
      reservation_no: seed.reservation_no,
      member_id:      seed.member_id,
      member_name:    (member?.full_name as string) ?? '—',
      member_phone:   (member?.phone as string) ?? null,
      member_status:  (member?.status as string) ?? '',
      variety_name:   seed.variety_name,
      qty_reserved:   seed.qty_reserved,
      bag_weight_kg:  bagKg,
      days_to_harvest:(product?.days_to_harvest as number) ?? null,
      quota_kg:       quota,
      product_id:     product?.id as string ?? null,
      created_at:     seed.created_at,
      has_cycle:      !!cycle,
      cycle_id:       cycle?.id ?? null,
      cycle_status:   cycle?.status ?? null,
      cycle_planted:  cycle?.planted_at ?? null,
    };
  });

  return NextResponse.json({ items });
}

// POST — admin สร้างรอบปลูกแทน farmer
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as {
    member_id:string; crop_name:string; plot_id?:string;
    product_id?:string; planted_at:string;
    expected_harvest_at?:string; area_planted_rai?:number;
    season_year?:number; quota_kg?:number; member_note?:string;
  };

  const s = createServerSupabaseClient();
  const { data, error } = await s
    .from('planting_cycles')
    .insert({
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
      member_note:         body.member_note ?? `บันทึกโดย admin (${admin.email})`,
      confirmed_at:        new Date().toISOString(),
    })
    .select('id').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true, id:(data as {id:string}).id });
}

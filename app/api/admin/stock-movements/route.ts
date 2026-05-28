import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export async function GET(request: Request) {
  const _ar_get = await requireAdminPermission('seed.read');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouse_id');
  const productId   = searchParams.get('product_id');
  const type        = searchParams.get('type');
  const dateFrom    = searchParams.get('date_from');
  const dateTo      = searchParams.get('date_to');
  const limit       = Number(searchParams.get('limit') ?? 100);

  const s = createServerSupabaseClient();
  let q = s.from('stock_movements')
    .select(`
      *,
      warehouses!warehouse_id(name),
      dest_wh:warehouses!dest_warehouse_id(name),
      product:product_id(name, bag_weight_kg, seed_varieties(seed_suppliers(supplier_name))),
      creator:created_by(id, full_name, phone)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  // Keep the warehouse history focused on real stock moves. Reservation holds and
  // reservation cancellations are stock calculations, but they should not appear here.
  q = q.neq('movement_type', 'reservation').neq('movement_type', 'cancel_res');

  if (warehouseId) q = q.eq('warehouse_id', warehouseId);
  if (productId)   q = q.eq('product_id', productId);
  if (type)        q = q.eq('movement_type', type);
  if (dateFrom)    q = q.gte('created_at', dateFrom);
  if (dateTo)      q = q.lte('created_at', dateTo + 'T23:59:59');

  const { data: movements, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // ดึง member info จาก ref_id สำหรับ sale_orders และ seed_reservations
  const saleRefIds  = (movements ?? []).filter(m => m.ref_type === 'sale_order' || m.ref_type === 'sale').map(m => m.ref_id).filter(Boolean);
  const seedRefIds  = (movements ?? []).filter(m => m.ref_type === 'reservation' || m.ref_type === 'seed_reservation').map(m => m.ref_id).filter(Boolean);

  const [saleRes, seedRes] = await Promise.all([
    saleRefIds.length
      ? s.from('sale_orders').select('id, order_number, member_id, members:member_id(id, full_name, phone)').in('id', saleRefIds)
      : Promise.resolve({ data: [] }),
    seedRefIds.length
      ? s.from('seed_reservations').select('id, reservation_no, member_id, members:member_id(id, full_name, phone)').in('id', seedRefIds)
      : Promise.resolve({ data: [] }),
  ]);

  type RefRow = { id:string; order_number?:string; reservation_no?:string; member_id:string; members?: { id:string; full_name:string; phone:string|null }|null };
  const refMap = new Map<string, RefRow>();
  [...(saleRes.data ?? []), ...(seedRes.data ?? [])].forEach((r: unknown) => {
    const row = r as RefRow;
    if (row.id) refMap.set(row.id, row);
  });

  function firstRow<T>(value: T | T[] | null | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
  }

  function sellerNameFromProduct(product: unknown): string | null {
    const p = product as { seed_varieties?: unknown } | null;
    const variety = firstRow(p?.seed_varieties as { seed_suppliers?: unknown } | { seed_suppliers?: unknown }[] | null | undefined);
    const supplier = firstRow(variety?.seed_suppliers as { supplier_name?: string | null } | { supplier_name?: string | null }[] | null | undefined);
    return supplier?.supplier_name ?? null;
  }

  // รวมข้อมูล
  const enriched = (movements ?? []).map(m => {
    const ref = m.ref_id ? refMap.get(m.ref_id) : null;
    const member = ref?.members as { id:string; full_name:string; phone:string|null }|null|undefined;
    return {
      ...m,
      ref_order_number: (ref as RefRow & {order_number?:string})?.order_number ?? (ref as RefRow & {reservation_no?:string})?.reservation_no ?? null,
      buyer_name:    member?.full_name ?? null,
      buyer_phone:   member?.phone    ?? null,
      buyer_id:      member?.id       ?? null,
      seller_name:   ['receive', 'in'].includes(m.movement_type) ? sellerNameFromProduct(m.product) : null,
    };
  });

  return NextResponse.json({ movements: enriched });
}

export async function POST(request: Request) {
  try {
    const _ar_post = await requireAdminPermission('seed.write');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as {
      movement_type:     string;
      warehouse_id:      string;
      dest_warehouse_id?: string;
      product_id?:       string;
      variety_id?:       string;
      product_name:      string;
      unit:              string;
      qty:               number;
      unit_cost?:        number;
      unit_price?:       number;
      ref_type?:         string;
      ref_id?:           string;
      ref_no?:           string;
      note?:             string;
      created_by?:       string;
    };

    const s = createServerSupabaseClient();
    const { data, error } = await s.rpc('create_stock_movement', {
      p_type:               body.movement_type,
      p_warehouse_id:       body.warehouse_id,
      p_dest_warehouse_id:  body.dest_warehouse_id ?? null,
      p_product_id:         body.product_id  ?? null,
      p_variety_id:         body.variety_id  ?? null,
      p_product_name:       body.product_name,
      p_unit:               body.unit,
      p_qty:                body.qty,
      p_unit_cost:          body.unit_cost   ?? null,
      p_unit_price:         body.unit_price  ?? null,
      p_ref_type:           body.ref_type    ?? null,
      p_ref_id:             body.ref_id      ?? null,
      p_ref_no:             body.ref_no      ?? null,
      p_note:               body.note        ?? null,
      p_created_by:         body.created_by  ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, movement_id: data });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  try {
    const _ar_patch = await requireAdminPermission('seed.write');
    if (isForbidden(_ar_patch)) return _ar_patch.forbidden;

    const body = (await request.json()) as {
      movement_id: string;
      qty?: number;
      unit_cost?: number | null;
      note?: string | null;
    };

    if (!body.movement_id) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const { data: mv, error: mvErr } = await s
      .from('stock_movements')
      .select('id,movement_no,movement_type,warehouse_id,product_id,variety_id,product_name,unit,qty,unit_cost,note,is_locked')
      .eq('id', body.movement_id)
      .maybeSingle();
    if (mvErr) return NextResponse.json({ error: mvErr.message }, { status: 500 });
    if (!mv) return NextResponse.json({ error: 'movement not found' }, { status: 404 });
    if (mv.movement_type !== 'receive') {
      return NextResponse.json({ error: 'แก้ไขได้เฉพาะรายการรับเข้า' }, { status: 400 });
    }
    if (mv.is_locked) return NextResponse.json({ error: 'รายการถูกปิดงวดแล้ว' }, { status: 400 });

    const oldQty = Number(mv.qty);
    const newQty = body.qty == null ? oldQty : Number(body.qty);
    if (!newQty || newQty <= 0) {
      return NextResponse.json({ error: 'จำนวนต้องมากกว่า 0' }, { status: 400 });
    }
    const diff = Number((newQty - oldQty).toFixed(2));
    const oldNote = mv.note ?? '';
    const newNote = body.note ?? '';
    const noteChanged = oldNote !== newNote;

    if (diff === 0 && noteChanged) {
      const { error: upErr } = await s.from('stock_movements').update({
        note: body.note ?? null,
      }).eq('id', mv.id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, diff: 0, mode: 'note_only' });
    }

    if (diff === 0 && !noteChanged) {
      return NextResponse.json({ ok: true, diff: 0, mode: 'no_change' });
    }

    const adjType = diff > 0 ? 'adjust_add' : 'adjust_sub';
    const { error: adjErr } = await s.rpc('create_stock_movement', {
      p_type: adjType,
      p_warehouse_id: mv.warehouse_id,
      p_dest_warehouse_id: null,
      p_product_id: mv.product_id,
      p_variety_id: mv.variety_id,
      p_product_name: mv.product_name,
      p_unit: mv.unit,
      p_qty: Math.abs(diff),
      p_unit_cost: body.unit_cost ?? mv.unit_cost ?? null,
      p_unit_price: null,
      p_ref_type: 'receive_correction',
      p_ref_id: mv.id,
      p_ref_no: mv.movement_no,
      p_note: `Correction from ${oldQty} to ${newQty}${body.note ? ` | ${body.note}` : ''}`,
      p_created_by: null,
    });
    if (adjErr) return NextResponse.json({ error: adjErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, diff, mode: 'movement_correction' });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

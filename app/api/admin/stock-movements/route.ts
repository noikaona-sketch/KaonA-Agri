import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const warehouseId = searchParams.get('warehouse_id');
  const type        = searchParams.get('type');
  const dateFrom    = searchParams.get('date_from');
  const dateTo      = searchParams.get('date_to');
  const limit       = Number(searchParams.get('limit') ?? 100);

  const s = createServerSupabaseClient();
  let q = s.from('stock_movements')
    .select('*, warehouses!warehouse_id(name), dest_wh:warehouses!dest_warehouse_id(name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (warehouseId) q = q.eq('warehouse_id', warehouseId);
  if (type)        q = q.eq('movement_type', type);
  if (dateFrom)    q = q.gte('created_at', dateFrom);
  if (dateTo)      q = q.lte('created_at', dateTo + 'T23:59:59');

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ movements: data ?? [] });
}

export async function POST(request: Request) {
  try {
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
    const body = (await request.json()) as {
      movement_id: string;
      qty: number;
      unit_cost?: number | null;
      note?: string | null;
    };

    if (!body.movement_id || !body.qty || body.qty <= 0) {
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
    const newQty = Number(body.qty);
    const diff = Number((newQty - oldQty).toFixed(2));

    const { error: upErr } = await s.from('stock_movements').update({
      qty: newQty,
      unit_cost: body.unit_cost ?? null,
      total_amount: body.unit_cost ? Number((newQty * Number(body.unit_cost)).toFixed(2)) : null,
      note: body.note ?? null,
    }).eq('id', mv.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    if (diff !== 0) {
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
    }

    return NextResponse.json({ ok: true, diff });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

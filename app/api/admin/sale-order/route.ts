import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

type OrderItem = {
  product_id?: string;
  unit?: string;
  product_name: string; qty: number; unit_price: number;
};

export async function POST(request: Request) {
  try {
    const _ar_post = await requireAdminPermission('service.write');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;

    const body = (await request.json()) as {
      member_id:       string;
      order_type:      'sale' | 'reservation';
      warehouse_id?:   string;
      pickup_slot_id?: string;
      items:           OrderItem[];
      payment_method:  string;
      paid_amount:     number;
      discount:        number;
      note?:           string;
      source_type?:    'walk_in' | 'reservation';
      reservation_id?: string | null;
    };

    const s      = createServerSupabaseClient();
    const total  = Math.max(0, body.items.reduce((sum, i) => sum + i.qty * i.unit_price, 0) - (body.discount ?? 0));
    const year   = new Date().getFullYear() + 543;
    const seq    = Date.now() % 100000;
    const order_number = `SO-${year}-${String(seq).padStart(5, '0')}`;

    // สร้าง order header
    const { data: order, error: orderErr } = await s.from('sale_orders').insert({
      order_number,
      member_id:       body.member_id,
      order_type:      body.order_type,
      warehouse_id:    body.warehouse_id    ?? null,
      pickup_slot_id:  body.pickup_slot_id  ?? null,
      status:          body.order_type === 'sale' ? 'completed' : 'pending',
      payment_method:  body.payment_method,
      paid_amount:     body.paid_amount,
      subtotal:        body.items.reduce((sum, i) => sum + i.qty * i.unit_price, 0),
      discount:        body.discount ?? 0,
      total:           total,
      note:            body.note ?? null,
      source_type:     body.source_type ?? (body.order_type === 'reservation' ? 'reservation' : 'walk_in'),
      reservation_id:  body.reservation_id ?? null,
    }).select('id').single();

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    // สร้าง order items
    const itemRows = body.items.map((item) => ({
      order_id:     order!.id,
      product_id:   item.product_id  ?? null,
      product_name_snapshot: item.product_name,
      product_name: item.product_name,
      product_unit: item.unit ?? 'ชิ้น',
      qty:          item.qty,
      unit_price:   item.unit_price,
      // subtotal is GENERATED ALWAYS (qty * unit_price) — do not insert
    }));

    const { error: itemErr } = await s.from('order_items').insert(itemRows);
    if (itemErr) {
      // rollback order ถ้า items insert ไม่ได้
      await s.from('sale_orders').delete().eq('id', order!.id);
      return NextResponse.json({ error: itemErr.message }, { status: 500 });
    }

    // ถ้าจอง + มี pickup_slot → อัปเดต booked_qty
    if (body.order_type === 'reservation' && body.pickup_slot_id) {
      const totalQty = body.items.reduce((s, i) => s + i.qty, 0);
      await s.from('pickup_slots').update({
        booked_qty: s.from('pickup_slots').select('booked_qty'),
      }).eq('id', body.pickup_slot_id);
      // อัปเดต booked_qty แบบ safe
      try {
        await s.rpc('increment_pickup_booked', {
          p_slot_id: body.pickup_slot_id,
          p_qty:     totalQty,
        }).maybeSingle();
      } catch { /* RPC ไม่มีก็ไม่เป็นไร */ }
    }

    // อัปเดตสถานะการจองหลังขายสำเร็จ
    if (body.source_type === 'reservation' && body.reservation_id) {
      // sale_orders reservation → completed
      await s.from('sale_orders')
        .update({ status: 'completed', updated_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', body.reservation_id)
        .eq('order_type', 'reservation');

      // seed_reservations (legacy path) → converted
      await s.from('seed_reservations')
        .update({ status: 'converted' })
        .eq('id', body.reservation_id);
    }

    return NextResponse.json({ ok: true, order_number, total });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

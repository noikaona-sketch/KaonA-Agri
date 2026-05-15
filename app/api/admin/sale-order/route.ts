import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

type OrderItem = {
  product_id?: string; variety_id?: string;
  lot_id?: string; lot_no?: string;
  product_name: string; qty: number; unit_price: number;
};

export async function POST(request: Request) {
  try {
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
      total_amount:    total,
      discount:        body.discount ?? 0,
      note:            body.note ?? null,
    }).select('id').single();

    if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

    // สร้าง order items
    const itemRows = body.items.map((item) => ({
      order_id:     order!.id,
      product_id:   item.product_id  ?? null,
      variety_id:   item.variety_id  ?? null,
      product_name: item.product_name,
      lot_no:       item.lot_no      ?? null,
      qty:          item.qty,
      unit_price:   item.unit_price,
      total_price:  item.qty * item.unit_price,
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
      await s.rpc('increment_pickup_booked', {
        p_slot_id: body.pickup_slot_id,
        p_qty:     totalQty,
      }).maybeSingle().catch(() => null);
    }

    return NextResponse.json({ ok: true, order_number, total });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      member_id: string; order_type: string;
      items: { product_id: string; qty: number; unit_price: number }[];
      payment_method: string; paid_amount: number; discount: number;
      pickup_date?: string;
    };
    const s = createServerSupabaseClient();
    const { data, error } = await s.rpc('create_sale_order', {
      p_member_id:      body.member_id,
      p_order_type:     body.order_type,
      p_items:          body.items,
      p_payment_method: body.payment_method,
      p_paid_amount:    body.paid_amount,
      p_discount:       body.discount,
      p_pickup_date:    body.pickup_date ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, ...(data as object) });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

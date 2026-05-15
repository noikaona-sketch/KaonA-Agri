import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      member_id: string;
      product_id?: string;
      variety_id?: string;
      variety_name: string;
      supplier_name?: string;
      qty_reserved: number;
      price_per_bag: number;
      bag_weight_kg: number;
      pickup_date?: string;
      pickup_slot_id?: string;
      note?: string;
    };

    const productId = body.product_id ?? body.variety_id;
    if (!body.member_id || !productId || !body.qty_reserved) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบ' }, { status: 400 });
    }

    // DEV BYPASS — mock member ไม่บันทึกจริง
    if (body.member_id === 'dev-mock-member-id') {
      const year = new Date().getFullYear() + 543;
      return NextResponse.json({ ok: true, reservation_no: `RV-${year}-99999`, total_amount: body.qty_reserved * body.price_per_bag });
    }

    const s = createServerSupabaseClient();
    const { data: product, error: productError } = await s
      .from('products')
      .select('id,name,seed_variety,brand,price_per_unit,bag_weight_kg,product_type,is_active,deleted_at')
      .eq('id', productId)
      .maybeSingle();

    if (productError) return NextResponse.json({ error: productError.message }, { status: 500 });
    if (!product || product.deleted_at || !product.is_active || product.product_type !== 'seed') {
      return NextResponse.json({ error: 'ไม่พบสินค้าเมล็ดพันธุ์ใน Product Master' }, { status: 400 });
    }

    // อัปเดต booked_qty ใน slot
    if (body.pickup_slot_id) {
      const { data: slot } = await s.from('pickup_slots')
        .select('booked_qty,capacity_qty,status').eq('id', body.pickup_slot_id).single();
      if (slot) {
        const next = (slot.booked_qty ?? 0) + body.qty_reserved;
        await s.from('pickup_slots').update({
          booked_qty: next,
          status: next >= (slot.capacity_qty ?? 999) ? 'full' : slot.status,
        }).eq('id', body.pickup_slot_id);
      }
    }

    // สร้าง reservation_no
    const year = new Date().getFullYear() + 543;
    const seq  = Date.now() % 100000;
    const reservation_no = `RV-${year}-${String(seq).padStart(5, '0')}`;

    const varietyName = product.seed_variety ?? body.variety_name ?? product.name;
    const supplierName = body.supplier_name ?? product.brand ?? null;
    const pricePerBag = Number(product.price_per_unit ?? body.price_per_bag ?? 0);
    const totalAmount = body.qty_reserved * pricePerBag;

    const { error } = await s.from('seed_reservations').insert({
      reservation_no,
      member_id:       body.member_id,
      product_id:      product.id,
      variety_id:      null,
      variety_name:    varietyName,
      supplier_name:   supplierName,
      lot_id:          null,
      lot_no:          null,
      qty_reserved:    body.qty_reserved,
      price_per_bag:   pricePerBag,
      pickup_date:     body.pickup_date ?? null,
      pickup_slot_id:  body.pickup_slot_id ?? null,
      note:            body.note ?? null,
      status:          'pending',
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reservation_no, total_amount: totalAmount });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const memberId = searchParams.get('member_id');
  if (!memberId) return NextResponse.json({ reservations: [] });

  const s = createServerSupabaseClient();
  const { data } = await s.from('seed_reservations')
    .select('id,reservation_no,status,variety_name,lot_no,supplier_name,qty_reserved,price_per_bag,total_amount,pickup_date,note,created_at,seed_stock_lots(bag_weight_kg)')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(50);

  return NextResponse.json({ reservations: data ?? [] });
}

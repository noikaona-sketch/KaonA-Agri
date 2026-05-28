import { NextResponse } from 'next/server';
import { createServerSupabaseClient, getLineChannelId } from '../../auth/line/line-auth-helpers';
import { isCornSeedProduct } from '@/lib/products/corn-seed';

type OrderItem = { product_id: string; qty: number; unit_price: number };

async function getMemberFromRequest(request: Request) {
  const auth = request.headers.get('authorization') ?? '';
  // ลอง idToken จาก header
  if (auth.startsWith('Bearer ')) {
    const idToken = auth.slice(7);
    const channelId = getLineChannelId();
    if (channelId && idToken) {
      const res = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { sub?: string };
        if (data.sub) {
          const s = createServerSupabaseClient();
          const { data: member } = await s.from('members').select('id').eq('line_user_id', data.sub).maybeSingle();
          return member?.id ?? null;
        }
      }
    }
  }
  // fallback: Supabase session
  const s = createServerSupabaseClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) return null;
  const { data: member } = await s.from('members').select('id').eq('auth_user_id', user.id).maybeSingle();
  return member?.id ?? null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      items?: OrderItem[];
      payment_method?: string;
      note?: string;
      create_planting_cycles?: boolean;
    };

    if (!body.items?.length) return NextResponse.json({ error: 'ไม่มีสินค้า' }, { status: 400 });

    const memberId = await getMemberFromRequest(request);
    if (!memberId) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบ' }, { status: 401 });

    const s = createServerSupabaseClient();

    // คำนวณยอด
    const subtotal = body.items.reduce((sum, i) => sum + i.qty * i.unit_price, 0);

    // สร้าง order
    const orderNo = 'SO-' + new Date().getFullYear() + '-' + Date.now().toString().slice(-5);
    const { data: order, error: orderErr } = await s.from('sale_orders').insert({
      order_number: orderNo,
      member_id: memberId,
      order_type: 'sale',
      status: body.payment_method === 'debit_account' ? 'confirmed' : 'pending',
      subtotal,
      discount: 0,
      total: subtotal,
      payment_method: body.payment_method ?? 'debit_account',
      payment_status: body.payment_method === 'debit_account' ? 'unpaid' : 'unpaid',
      paid_amount: 0,
      note: body.note ?? null,
      created_by: memberId,
    }).select('id').single();

    if (orderErr || !order) return NextResponse.json({ error: orderErr?.message ?? 'สร้างคำสั่งไม่สำเร็จ' }, { status: 500 });

    // order items + adjust stock
    for (const item of body.items) {
      await s.from('order_items').insert({
        order_id: order.id,
        product_id: item.product_id,
        qty: item.qty,
        unit_price: item.unit_price,
        product_name: '',
        product_unit: '',
      });
      // หัก stock
      await s.rpc('adjust_product_stock', {
        p_product_id: item.product_id,
        p_delta: -item.qty,
        p_movement_type: 'out',
        p_ref_type: 'sale_order',
        p_ref_id: order.id,
      }).then(() => {});
    }

    // บันทึก credit transaction (debit_account)
    if (body.payment_method === 'debit_account') {
      await s.rpc('process_order_credit', {
        p_member_id: memberId,
        p_amount: subtotal,
        p_order_id: order.id,
        p_payment_method: 'debit_account',
      }).then(() => {});
    }

    // สร้าง planting cycles สำหรับเมล็ดพันธุ์ข้าวโพดเท่านั้น
    if (body.create_planting_cycles) {
      for (const item of body.items) {
        const { data: product } = await s
          .from('products')
          .select('category, product_type, crop_type, name')
          .eq('id', item.product_id)
          .single();
        if (isCornSeedProduct(product)) {
          await s.rpc('create_planting_cycle_from_order', {
            p_order_id: order.id,
            p_member_id: memberId,
            p_product_id: item.product_id,
            p_seed_qty_kg: item.qty,
          }).then(() => {});
        }
      }
    }

    // notification
    await s.from('notifications').insert({
      member_id: memberId,
      title: '🛒 คำสั่งซื้อสำเร็จ',
      body: `${orderNo} ยอด ${subtotal.toLocaleString()} บาท — ${body.payment_method === 'debit_account' ? 'ติดต่อ admin เพื่อชำระ' : 'รอการยืนยัน'}`,
      related_resource_type: 'sale_order',
      related_resource_id: order.id,
    });

    return NextResponse.json({ ok: true, order_id: order.id, order_number: orderNo, total: subtotal });
  } catch (error) {
    console.error('[MEMBER_ORDER]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

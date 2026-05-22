import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const _ar = await requireAdminPermission('market_prices.read');
  if (isForbidden(_ar)) return _ar.forbidden;
  const { data, error } = await createServerSupabaseClient()
    .from('campaign_announcements')
    .select('id,title,promo_type,promo_bonus_per_kg,moisture_threshold,start_date,end_date,is_active')
    .not('promo_type', 'is', null)
    .order('start_date', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ promos: data ?? [] });
}

export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('market_prices.write');
    if (isForbidden(_ar)) return _ar.forbidden;
    const body = (await request.json()) as {
      title: string; promo_type: 'flat' | 'moisture_below';
      promo_bonus_per_kg: number; moisture_threshold?: number | null;
      start_date: string; end_date: string;
    };
    if (!body.title || !body.promo_type || !body.promo_bonus_per_kg)
      return NextResponse.json({ error: 'title, promo_type, promo_bonus_per_kg จำเป็น' }, { status: 400 });
    const { error } = await createServerSupabaseClient()
      .from('campaign_announcements')
      .insert({
        title:              body.title,
        body:               body.title,
        type:               'price_notice',
        promo_type:         body.promo_type,
        promo_bonus_per_kg: body.promo_bonus_per_kg,
        moisture_threshold: body.moisture_threshold ?? null,
        start_date:         body.start_date,
        end_date:           body.end_date,
        is_active:          true,
      });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  const _ar = await requireAdminPermission('market_prices.write');
  if (isForbidden(_ar)) return _ar.forbidden;
  const { id } = (await request.json()) as { id: string };
  if (!id) return NextResponse.json({ error: 'id จำเป็น' }, { status: 400 });
  const { error } = await createServerSupabaseClient()
    .from('campaign_announcements').update({ is_active: false }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

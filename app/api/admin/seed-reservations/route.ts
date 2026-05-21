import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';
import { queryReservations } from './_query';
import { confirmReservation, cancelReservation, closeReservation } from './_actions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const _ar = await requireAdminPermission('seed.read');
    if (isForbidden(_ar)) return _ar.forbidden;
    const url      = new URL(request.url);
    const status   = url.searchParams.get('status')    ?? '';
    const memberId = url.searchParams.get('member_id') ?? '';
    const items    = await queryReservations(createServerSupabaseClient(), status, memberId);
    return NextResponse.json({ items });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const _ar = await requireAdminPermission('seed.write');
    if (isForbidden(_ar)) return _ar.forbidden;

    const body = (await request.json()) as {
      action:          'confirm' | 'cancel' | 'close_partial' | 'close_full';
      reservation_id:  string;
      source:          'seed_reservation' | 'sale_order';
      reason?:         string;
      qty_sold?:       number;
      qty_remaining?:  number;
      sale_order_id?:  string;
      source_channel?: string;
      attachment_url?: string;
      attachment_path?: string;
    };

    if (!body.action || !body.reservation_id)
      return NextResponse.json({ error: 'action and reservation_id required' }, { status: 400 });

    const s   = createServerSupabaseClient();
    const now = new Date().toISOString();

    if (body.action === 'confirm') {
      await confirmReservation(s, body, now);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'cancel') {
      await cancelReservation(s, body, now);
      return NextResponse.json({ ok: true });
    }
    if (body.action === 'close_partial' || body.action === 'close_full') {
      await closeReservation(s, { ...body, action: body.action }, now);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  } catch (e) { return NextResponse.json({ error: String(e) }, { status: 500 }); }
}

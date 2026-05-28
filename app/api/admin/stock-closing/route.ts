import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../members/_admin-auth';

type MovementRow = {
  warehouse_id: string;
  product_id: string | null;
  variety_id: string | null;
  product_name: string;
  unit: string;
  movement_type: string;
  qty: number | string;
};

type StockRow = {
  warehouse_id: string;
  product_id: string | null;
  variety_id: string | null;
  qty_on_hand: number | string;
  unit: string;
  warehouses?: { id: string; code: string; name: string } | null;
  products?: { id: string; name: string; category: string | null; unit: string | null } | null;
  seed_varieties?: { id: string; variety_name: string; crop_type: string | null } | null;
};

type ClosingLine = {
  warehouse_id: string;
  warehouse_name: string;
  product_id: string | null;
  variety_id: string | null;
  product_name: string;
  unit: string;
  opening_qty: number;
  receive_qty: number;
  out_qty: number;
  transfer_in_qty: number;
  transfer_out_qty: number;
  adjustment_qty: number;
  reserved_qty: number;
  ending_qty: number;
  system_qty_on_hand: number | null;
  variance_qty: number | null;
  movement_count: number;
};

function periodBounds(month: string | null) {
  const safeMonth = /^\d{4}-\d{2}$/.test(month ?? '') ? month as string : new Date().toISOString().slice(0, 7);
  const [year, monthNo] = safeMonth.split('-').map(Number);
  const start = `${safeMonth}-01`;
  const end = new Date(Date.UTC(year, monthNo, 0)).toISOString().slice(0, 10);
  return { year, month: monthNo, start, end, monthKey: safeMonth };
}

function lineKey(warehouseId: string, productId: string | null, varietyId: string | null) {
  return `${warehouseId}:${productId ?? `v:${varietyId}`}`;
}

function roundQty(value: number) {
  return Math.round(value * 100) / 100;
}

function emptyLine(stock: StockRow): ClosingLine {
  const productName = stock.products?.name ?? stock.seed_varieties?.variety_name ?? '—';
  return {
    warehouse_id: stock.warehouse_id,
    warehouse_name: stock.warehouses?.name ?? '—',
    product_id: stock.product_id,
    variety_id: stock.variety_id,
    product_name: productName,
    unit: stock.unit ?? stock.products?.unit ?? 'ชิ้น',
    opening_qty: 0,
    receive_qty: 0,
    out_qty: 0,
    transfer_in_qty: 0,
    transfer_out_qty: 0,
    adjustment_qty: 0,
    reserved_qty: 0,
    ending_qty: 0,
    system_qty_on_hand: Number(stock.qty_on_hand ?? 0),
    variance_qty: null,
    movement_count: 0,
  };
}

async function calculateSnapshot(s: ReturnType<typeof createServerSupabaseClient>, monthParam: string | null, warehouseId: string | null) {
  const period = periodBounds(monthParam);
  const scope = warehouseId ? 'warehouse' : 'all';

  let stockQuery = s.from('product_stock').select(`
    warehouse_id, product_id, variety_id, qty_on_hand, unit,
    warehouses(id, code, name),
    products(id, name, category, unit),
    seed_varieties(id, variety_name, crop_type)
  `);
  if (warehouseId) stockQuery = stockQuery.eq('warehouse_id', warehouseId);

  let movementQuery = s.from('stock_movements')
    .select('warehouse_id,product_id,variety_id,product_name,unit,movement_type,qty')
    .gte('created_at', period.start)
    .lte('created_at', `${period.end}T23:59:59`);
  if (warehouseId) movementQuery = movementQuery.eq('warehouse_id', warehouseId);

  let previousHeaderQuery = s.from('stock_closing_snapshots')
    .select('id, closing_no, period_end, closed_at')
    .eq('status', 'closed')
    .lt('period_end', period.start)
    .order('period_end', { ascending: false })
    .limit(1);
  if (warehouseId) previousHeaderQuery = previousHeaderQuery.eq('warehouse_id', warehouseId).eq('scope', 'warehouse');
  else previousHeaderQuery = previousHeaderQuery.eq('scope', 'all');

  const [stockRes, movementRes, previousHeaderRes, savedHeaderRes] = await Promise.all([
    stockQuery,
    movementQuery,
    previousHeaderQuery.maybeSingle(),
    s.from('stock_closing_snapshots')
      .select('*, warehouses(id, code, name)')
      .eq('period_year', period.year)
      .eq('period_month', period.month)
      .eq('scope', scope)
      .then((queryRes) => queryRes),
  ]);

  if (stockRes.error) throw new Error(stockRes.error.message);
  if (movementRes.error) throw new Error(movementRes.error.message);
  if (previousHeaderRes.error) throw new Error(previousHeaderRes.error.message);
  if (savedHeaderRes.error) throw new Error(savedHeaderRes.error.message);

  let savedHeaderRows = savedHeaderRes.data ?? [];
  if (warehouseId) savedHeaderRows = savedHeaderRows.filter((row) => row.warehouse_id === warehouseId);
  else savedHeaderRows = savedHeaderRows.filter((row) => row.warehouse_id === null);
  const savedSnapshot = savedHeaderRows[0] ?? null;

  const lines = new Map<string, ClosingLine>();
  for (const raw of (stockRes.data ?? []) as unknown as StockRow[]) {
    lines.set(lineKey(raw.warehouse_id, raw.product_id, raw.variety_id), emptyLine(raw));
  }

  const previousHeader = previousHeaderRes.data as { id: string; closing_no: string; period_end: string; closed_at: string | null } | null;
  if (previousHeader) {
    const { data: previousLines, error: prevLineErr } = await s.from('stock_closing_lines')
      .select('warehouse_id,product_id,variety_id,product_name,unit,ending_qty')
      .eq('snapshot_id', previousHeader.id);
    if (prevLineErr) throw new Error(prevLineErr.message);
    for (const prev of previousLines ?? []) {
      const key = lineKey(prev.warehouse_id, prev.product_id, prev.variety_id);
      const line = lines.get(key) ?? {
        warehouse_id: prev.warehouse_id,
        warehouse_name: '—',
        product_id: prev.product_id,
        variety_id: prev.variety_id,
        product_name: prev.product_name,
        unit: prev.unit,
        opening_qty: 0,
        receive_qty: 0,
        out_qty: 0,
        transfer_in_qty: 0,
        transfer_out_qty: 0,
        adjustment_qty: 0,
        reserved_qty: 0,
        ending_qty: 0,
        system_qty_on_hand: null,
        variance_qty: null,
        movement_count: 0,
      };
      line.opening_qty = Number(prev.ending_qty ?? 0);
      lines.set(key, line);
    }
  }

  for (const movement of (movementRes.data ?? []) as unknown as MovementRow[]) {
    const key = lineKey(movement.warehouse_id, movement.product_id, movement.variety_id);
    const line = lines.get(key) ?? {
      warehouse_id: movement.warehouse_id,
      warehouse_name: '—',
      product_id: movement.product_id,
      variety_id: movement.variety_id,
      product_name: movement.product_name,
      unit: movement.unit,
      opening_qty: 0,
      receive_qty: 0,
      out_qty: 0,
      transfer_in_qty: 0,
      transfer_out_qty: 0,
      adjustment_qty: 0,
      reserved_qty: 0,
      ending_qty: 0,
      system_qty_on_hand: null,
      variance_qty: null,
      movement_count: 0,
    };
    const qty = Number(movement.qty ?? 0);
    if (['receive', 'return'].includes(movement.movement_type)) line.receive_qty += qty;
    else if (['sale'].includes(movement.movement_type)) line.out_qty += qty;
    else if (movement.movement_type === 'transfer_in') line.transfer_in_qty += qty;
    else if (movement.movement_type === 'transfer_out') line.transfer_out_qty += qty;
    else if (movement.movement_type === 'adjust_add') line.adjustment_qty += qty;
    else if (movement.movement_type === 'adjust_sub') line.adjustment_qty -= qty;
    else if (movement.movement_type === 'reservation') line.reserved_qty += qty;
    else if (movement.movement_type === 'cancel_res') line.reserved_qty -= qty;
    line.movement_count += 1;
    lines.set(key, line);
  }

  const orderedLines = Array.from(lines.values()).map((line) => {
    const ending = line.opening_qty + line.receive_qty - line.out_qty + line.transfer_in_qty - line.transfer_out_qty + line.adjustment_qty;
    return {
      ...line,
      opening_qty: roundQty(line.opening_qty),
      receive_qty: roundQty(line.receive_qty),
      out_qty: roundQty(line.out_qty),
      transfer_in_qty: roundQty(line.transfer_in_qty),
      transfer_out_qty: roundQty(line.transfer_out_qty),
      adjustment_qty: roundQty(line.adjustment_qty),
      reserved_qty: roundQty(line.reserved_qty),
      ending_qty: roundQty(ending),
      variance_qty: line.system_qty_on_hand == null ? null : roundQty(Number(line.system_qty_on_hand) - ending),
    };
  }).sort((a, b) => `${a.warehouse_name}${a.product_name}`.localeCompare(`${b.warehouse_name}${b.product_name}`, 'th'));

  const totals = orderedLines.reduce((acc, line) => ({
    line_count: acc.line_count + 1,
    total_opening_qty: acc.total_opening_qty + line.opening_qty,
    total_receive_qty: acc.total_receive_qty + line.receive_qty,
    total_out_qty: acc.total_out_qty + line.out_qty,
    total_transfer_in_qty: acc.total_transfer_in_qty + line.transfer_in_qty,
    total_transfer_out_qty: acc.total_transfer_out_qty + line.transfer_out_qty,
    total_reserved_qty: acc.total_reserved_qty + line.reserved_qty,
    total_ending_qty: acc.total_ending_qty + line.ending_qty,
  }), { line_count: 0, total_opening_qty: 0, total_receive_qty: 0, total_out_qty: 0, total_transfer_in_qty: 0, total_transfer_out_qty: 0, total_reserved_qty: 0, total_ending_qty: 0 });

  return { period, scope, warehouse_id: warehouseId, previous_snapshot: previousHeader, saved_snapshot: savedSnapshot, lines: orderedLines, totals };
}

export async function GET(request: Request) {
  try {
    const _ar_get = await requireAdminPermission('seed.read');
    if (isForbidden(_ar_get)) return _ar_get.forbidden;
    const { searchParams } = new URL(request.url);
    const s = createServerSupabaseClient();
    const payload = await calculateSnapshot(s, searchParams.get('month'), searchParams.get('warehouse_id'));
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const _ar_post = await requireAdminPermission('seed.write');
    if (isForbidden(_ar_post)) return _ar_post.forbidden;
    const body = await request.json() as { month?: string; warehouse_id?: string | null; action?: 'save_review' | 'close'; note?: string | null; reviewed_by?: string | null; closed_by?: string | null };
    const s = createServerSupabaseClient();
    const snapshot = await calculateSnapshot(s, body.month ?? null, body.warehouse_id ?? null);
    const closingNo = `SC-${snapshot.period.year}${String(snapshot.period.month).padStart(2, '0')}-${snapshot.scope === 'all' ? 'ALL' : snapshot.warehouse_id?.slice(0, 8)?.toUpperCase()}`;
    const header = {
      closing_no: closingNo,
      period_year: snapshot.period.year,
      period_month: snapshot.period.month,
      period_start: snapshot.period.start,
      period_end: snapshot.period.end,
      warehouse_id: snapshot.warehouse_id,
      scope: snapshot.scope,
      status: body.action === 'close' ? 'closed' : 'review',
      ...snapshot.totals,
      reviewed_by: body.reviewed_by ?? null,
      reviewed_at: new Date().toISOString(),
      closed_by: body.action === 'close' ? body.closed_by ?? null : null,
      closed_at: body.action === 'close' ? new Date().toISOString() : null,
      note: body.note ?? null,
    };

    const { data: existingRows, error: existingErr } = await s.from('stock_closing_snapshots')
      .select('id,status,warehouse_id')
      .eq('period_year', snapshot.period.year)
      .eq('period_month', snapshot.period.month)
      .eq('scope', snapshot.scope);
    if (existingErr) throw new Error(existingErr.message);
    const existing = (existingRows ?? []).find((row) => snapshot.warehouse_id ? row.warehouse_id === snapshot.warehouse_id : row.warehouse_id === null);
    if (existing?.status === 'closed' && body.action !== 'close') {
      return NextResponse.json({ error: 'งวดนี้ปิดแล้ว ไม่สามารถบันทึกทบทวนซ้ำ' }, { status: 400 });
    }
    if (body.action === 'close' && existing?.status !== 'review' && existing?.status !== 'closed') {
      return NextResponse.json({ error: 'ต้องบันทึก snapshot เพื่อให้ Admin review ก่อนปิดงวด' }, { status: 400 });
    }

    const headerResult = existing
      ? await s.from('stock_closing_snapshots').update(header).eq('id', existing.id).select('id').single()
      : await s.from('stock_closing_snapshots').insert(header).select('id').single();
    if (headerResult.error) throw new Error(headerResult.error.message);
    const snapshotId = headerResult.data.id as string;

    const { error: deleteErr } = await s.from('stock_closing_lines').delete().eq('snapshot_id', snapshotId);
    if (deleteErr) throw new Error(deleteErr.message);

    if (snapshot.lines.length > 0) {
      const { error: insertErr } = await s.from('stock_closing_lines').insert(snapshot.lines.map((line) => ({
        snapshot_id: snapshotId,
        warehouse_id: line.warehouse_id,
        product_id: line.product_id,
        variety_id: line.variety_id,
        product_name: line.product_name,
        unit: line.unit,
        opening_qty: line.opening_qty,
        receive_qty: line.receive_qty,
        out_qty: line.out_qty,
        transfer_in_qty: line.transfer_in_qty,
        transfer_out_qty: line.transfer_out_qty,
        adjustment_qty: line.adjustment_qty,
        reserved_qty: line.reserved_qty,
        ending_qty: line.ending_qty,
        system_qty_on_hand: line.system_qty_on_hand,
        variance_qty: line.variance_qty,
        movement_count: line.movement_count,
      })));
      if (insertErr) throw new Error(insertErr.message);
    }

    return NextResponse.json({ ok: true, snapshot_id: snapshotId, status: header.status, ...snapshot });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

import { NextResponse }               from 'next/server';
import { createServerSupabaseClient } from '../../../auth/line/line-auth-helpers';
import { requireAdminPermission, isForbidden } from '../../members/_admin-auth';

export const dynamic = 'force-dynamic';

type StockSnapshotRow = {
  warehouse_id: string;
  product_id: string | null;
  variety_id: string | null;
  qty_on_hand: number | string | null;
  qty_reserved: number | string | null;
  unit: string | null;
  warehouses?: { id: string; code: string | null; name: string | null } | null;
  products?: { id: string; name: string | null; category: string | null; unit: string | null } | null;
  seed_varieties?: { id: string; variety_name: string | null; crop_type: string | null; bag_weight_kg?: number | string | null } | null;
};

type MovementRow = {
  warehouse_id: string;
  product_id: string | null;
  variety_id: string | null;
  product_name: string | null;
  movement_type: string;
  qty: number | string | null;
  unit: string | null;
  created_at: string;
  warehouses?: { id: string; code: string | null; name: string | null } | null;
  products?: { id: string; name: string | null; category: string | null; unit: string | null } | null;
  seed_varieties?: { id: string; variety_name: string | null; crop_type: string | null; bag_weight_kg?: number | string | null } | null;
};

type DailyRow = {
  date: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  product_key: string;
  product_id: string | null;
  variety_id: string | null;
  product_name: string;
  category: string;
  unit: string;
  opening_balance: number;
  received_qty: number;
  transfer_in_qty: number;
  transfer_out_qty: number;
  sold_out_qty: number;
  reserved_qty: number;
  ending_balance: number;
};

type Totals = Pick<DailyRow, 'opening_balance' | 'received_qty' | 'transfer_in_qty' | 'transfer_out_qty' | 'sold_out_qty' | 'reserved_qty' | 'ending_balance'>;

const dayMs = 86_400_000;

function asNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

function firstRow<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseDateParam(value: string | null): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function addDays(date: string, days: number): string {
  const time = new Date(`${date}T00:00:00.000Z`).getTime();
  return new Date(time + days * dayMs).toISOString().slice(0, 10);
}

function dateRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
}

function productKey(productId: string | null, varietyId: string | null): string {
  return productId ? `product:${productId}` : `variety:${varietyId ?? 'unknown'}`;
}

function comboKey(warehouseId: string, productId: string | null, varietyId: string | null): string {
  return `${warehouseId}__${productKey(productId, varietyId)}`;
}

function dayKey(date: string, warehouseId: string, productId: string | null, varietyId: string | null): string {
  return `${date}__${comboKey(warehouseId, productId, varietyId)}`;
}

function movementDelta(type: string, qty: number): number {
  if (['receive', 'transfer_in', 'adjust_add', 'return', 'cancel_res'].includes(type)) return qty;
  if (['sale', 'transfer_out', 'adjust_sub', 'reservation'].includes(type)) return -qty;
  return 0;
}

function emptyTotals(): Totals {
  return {
    opening_balance: 0,
    received_qty: 0,
    transfer_in_qty: 0,
    transfer_out_qty: 0,
    sold_out_qty: 0,
    reserved_qty: 0,
    ending_balance: 0,
  };
}

function movementBucket(type: string, qty: number): Partial<Totals> {
  if (type === 'receive') return { received_qty: qty };
  if (type === 'transfer_in') return { transfer_in_qty: qty };
  if (type === 'transfer_out') return { transfer_out_qty: qty };
  if (type === 'reservation') return { reserved_qty: qty };
  if (['sale', 'adjust_sub'].includes(type)) return { sold_out_qty: qty };
  if (['adjust_add', 'return', 'cancel_res'].includes(type)) return { received_qty: qty };
  return {};
}

// GET /api/admin/reports/stock-daily-movement?from=YYYY-MM-DD&to=YYYY-MM-DD&warehouse_id=&product_id=&q=
export async function GET(request: Request) {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const url = new URL(request.url);
  const to = parseDateParam(url.searchParams.get('to')) ?? new Date().toISOString().slice(0, 10);
  const from = parseDateParam(url.searchParams.get('from')) ?? new Date(new Date(`${to}T00:00:00.000Z`).getTime() - 29 * dayMs).toISOString().slice(0, 10);
  const warehouseId = url.searchParams.get('warehouse_id') || null;
  const productId = url.searchParams.get('product_id') || null;
  const search = (url.searchParams.get('q') ?? '').trim().toLowerCase();

  if (from > to) return NextResponse.json({ error: 'from must be before or equal to to' }, { status: 400 });

  const s = createServerSupabaseClient();

  let stockQuery = s.from('product_stock').select(`
    warehouse_id, product_id, variety_id, qty_on_hand, qty_reserved, unit,
    warehouses!product_stock_warehouse_id_fkey(id, code, name),
    products!product_stock_product_id_fkey(id, name, category, unit),
    seed_varieties!product_stock_variety_id_fkey(id, variety_name, crop_type, bag_weight_kg)
  `);
  if (warehouseId) stockQuery = stockQuery.eq('warehouse_id', warehouseId);
  if (productId) stockQuery = stockQuery.eq('product_id', productId);

  let movementQuery = s.from('stock_movements').select(`
    warehouse_id, product_id, variety_id, product_name, movement_type, qty, unit, created_at,
    warehouses!stock_movements_warehouse_id_fkey(id, code, name),
    products!stock_movements_product_id_fkey(id, name, category, unit),
    seed_varieties!stock_movements_variety_id_fkey(id, variety_name, crop_type, bag_weight_kg)
  `)
    .gte('created_at', `${from}T00:00:00.000Z`)
    .order('created_at', { ascending: true })
    .limit(10_000);
  if (warehouseId) movementQuery = movementQuery.eq('warehouse_id', warehouseId);
  if (productId) movementQuery = movementQuery.eq('product_id', productId);

  const [stockRes, movementRes] = await Promise.all([stockQuery, movementQuery]);
  if (stockRes.error) return NextResponse.json({ error: stockRes.error.message }, { status: 500 });
  if (movementRes.error) return NextResponse.json({ error: movementRes.error.message }, { status: 500 });

  const stockRows = (stockRes.data ?? []) as unknown as StockSnapshotRow[];
  const movementRows = (movementRes.data ?? []) as unknown as MovementRow[];
  const days = dateRange(from, to);

  const productMeta = new Map<string, { product_id: string | null; variety_id: string | null; product_name: string; category: string; unit: string }>();
  const warehouseMeta = new Map<string, { warehouse_code: string; warehouse_name: string }>();
  const currentBalance = new Map<string, number>();
  const currentReserved = new Map<string, number>();
  const dailyMovement = new Map<string, Totals>();
  const netSinceFrom = new Map<string, number>();

  function rememberMeta(row: StockSnapshotRow | MovementRow) {
    const p = firstRow(row.products);
    const v = firstRow(row.seed_varieties);
    const w = firstRow(row.warehouses);
    const key = productKey(row.product_id, row.variety_id);
    if (!productMeta.has(key)) {
      productMeta.set(key, {
        product_id: row.product_id,
        variety_id: row.variety_id,
        product_name: p?.name ?? v?.variety_name ?? ('product_name' in row ? row.product_name : null) ?? '—',
        category: p?.category ?? v?.crop_type ?? 'other',
        unit: row.unit ?? p?.unit ?? 'ถุง',
      });
    }
    if (!warehouseMeta.has(row.warehouse_id)) {
      warehouseMeta.set(row.warehouse_id, {
        warehouse_code: w?.code ?? '',
        warehouse_name: w?.name ?? '—',
      });
    }
  }

  stockRows.forEach((row) => {
    rememberMeta(row);
    const cKey = comboKey(row.warehouse_id, row.product_id, row.variety_id);
    currentBalance.set(cKey, asNumber(row.qty_on_hand));
    currentReserved.set(cKey, asNumber(row.qty_reserved));
  });

  movementRows.forEach((row) => {
    rememberMeta(row);
    const qty = asNumber(row.qty);
    const cKey = comboKey(row.warehouse_id, row.product_id, row.variety_id);
    const delta = movementDelta(row.movement_type, qty);
    netSinceFrom.set(cKey, (netSinceFrom.get(cKey) ?? 0) + delta);

    const date = row.created_at.slice(0, 10);
    if (date < from || date > to) return;
    const dKey = dayKey(date, row.warehouse_id, row.product_id, row.variety_id);
    const bucket = dailyMovement.get(dKey) ?? emptyTotals();
    const add = movementBucket(row.movement_type, qty);
    bucket.received_qty += add.received_qty ?? 0;
    bucket.transfer_in_qty += add.transfer_in_qty ?? 0;
    bucket.transfer_out_qty += add.transfer_out_qty ?? 0;
    bucket.sold_out_qty += add.sold_out_qty ?? 0;
    bucket.reserved_qty += add.reserved_qty ?? 0;
    dailyMovement.set(dKey, bucket);
  });

  const comboKeys = new Set<string>([...currentBalance.keys(), ...netSinceFrom.keys()]);
  const rows: DailyRow[] = [];

  comboKeys.forEach((cKey) => {
    const [whId, pKey] = cKey.split('__');
    const meta = productMeta.get(pKey);
    const wh = warehouseMeta.get(whId);
    if (!meta || !wh) return;
    if (search && !meta.product_name.toLowerCase().includes(search) && !meta.category.toLowerCase().includes(search)) return;

    // Current stock is a live balance. Roll it back through every movement from
    // `from` to now so the first row starts with the opening balance for the
    // requested period. This is read-only and does not create a closing period.
    let opening = (currentBalance.get(cKey) ?? 0) - (netSinceFrom.get(cKey) ?? 0);

    days.forEach((date) => {
      const movement = dailyMovement.get(`${date}__${cKey}`) ?? emptyTotals();
      const dayNet = movement.received_qty + movement.transfer_in_qty - movement.transfer_out_qty - movement.sold_out_qty - movement.reserved_qty;
      const ending = opening + dayNet;
      const includeRow = movement.received_qty || movement.transfer_in_qty || movement.transfer_out_qty || movement.sold_out_qty || movement.reserved_qty || opening || ending || currentReserved.get(cKey);
      if (includeRow) {
        rows.push({
          date,
          warehouse_id: whId,
          warehouse_code: wh.warehouse_code,
          warehouse_name: wh.warehouse_name,
          product_key: pKey,
          product_id: meta.product_id,
          variety_id: meta.variety_id,
          product_name: meta.product_name,
          category: meta.category,
          unit: meta.unit,
          opening_balance: opening,
          received_qty: movement.received_qty,
          transfer_in_qty: movement.transfer_in_qty,
          transfer_out_qty: movement.transfer_out_qty,
          sold_out_qty: movement.sold_out_qty,
          reserved_qty: movement.reserved_qty,
          ending_balance: ending,
        });
      }
      opening = ending;
    });
  });

  rows.sort((a, b) => b.date.localeCompare(a.date) || a.warehouse_name.localeCompare(b.warehouse_name) || a.product_name.localeCompare(b.product_name));

  const totals = rows.reduce<Totals>((sum, row) => ({
    opening_balance: sum.opening_balance + row.opening_balance,
    received_qty: sum.received_qty + row.received_qty,
    transfer_in_qty: sum.transfer_in_qty + row.transfer_in_qty,
    transfer_out_qty: sum.transfer_out_qty + row.transfer_out_qty,
    sold_out_qty: sum.sold_out_qty + row.sold_out_qty,
    reserved_qty: sum.reserved_qty + row.reserved_qty,
    ending_balance: sum.ending_balance + row.ending_balance,
  }), emptyTotals());

  return NextResponse.json({ from, to, warehouse_id: warehouseId, product_id: productId, rows, totals, as_of: new Date().toISOString() });
}

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
  id: string;
  movement_no: string;
  warehouse_id: string;
  product_id: string | null;
  variety_id: string | null;
  product_name: string | null;
  movement_type: string;
  qty: number | string | null;
  unit: string | null;
  unit_cost: number | string | null;
  unit_price: number | string | null;
  total_amount: number | string | null;
  ref_type: string | null;
  ref_id: string | null;
  ref_no: string | null;
  note: string | null;
  created_at: string;
  warehouses?: { id: string; code: string | null; name: string | null } | null;
  products?: {
    id: string;
    name: string | null;
    category: string | null;
    unit: string | null;
    seed_varieties?: { seed_suppliers?: { supplier_name: string | null } | { supplier_name: string | null }[] | null } | { seed_suppliers?: { supplier_name: string | null } | { supplier_name: string | null }[] | null }[] | null;
  } | null;
  seed_varieties?: { id: string; variety_name: string | null; crop_type: string | null; bag_weight_kg?: number | string | null } | null;
};

type RefRow = {
  id: string;
  order_number?: string | null;
  reservation_no?: string | null;
  member_id?: string | null;
  members?: { id: string; full_name: string | null; phone: string | null } | { id: string; full_name: string | null; phone: string | null }[] | null;
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

type DetailRow = {
  id: string;
  date: string;
  created_at: string;
  movement_no: string;
  movement_type: string;
  warehouse_id: string;
  warehouse_code: string;
  warehouse_name: string;
  product_id: string | null;
  variety_id: string | null;
  product_name: string;
  category: string;
  unit: string;
  qty: number;
  unit_cost: number | null;
  unit_price: number | null;
  total_amount: number | null;
  ref_type: string | null;
  ref_id: string | null;
  ref_no: string | null;
  note: string | null;
  seller_name: string | null;
  buyer_name: string | null;
  buyer_phone: string | null;
  ref_order_number: string | null;
};

type Totals = Pick<DailyRow, 'opening_balance' | 'received_qty' | 'transfer_in_qty' | 'transfer_out_qty' | 'sold_out_qty' | 'reserved_qty' | 'ending_balance'> & { row_count: number };

type ProductMeta = { product_id: string | null; variety_id: string | null; product_name: string; category: string; unit: string; seller_name: string | null };
type WarehouseMeta = { warehouse_code: string; warehouse_name: string };

const dayMs = 86_400_000;

function asNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0) || 0;
}

function nullableNumber(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
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
  if (['receive', 'transfer_in', 'adjust_add', 'return'].includes(type)) return qty;
  if (['sale', 'transfer_out', 'adjust_sub'].includes(type)) return -qty;
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
    row_count: 0,
  };
}

function movementBucket(type: string, qty: number): Partial<Totals> {
  if (type === 'receive') return { received_qty: qty };
  if (type === 'transfer_in') return { transfer_in_qty: qty };
  if (type === 'transfer_out') return { transfer_out_qty: qty };
  if (type === 'reservation') return { reserved_qty: qty };
  if (type === 'cancel_res') return { reserved_qty: -qty };
  if (['sale', 'adjust_sub'].includes(type)) return { sold_out_qty: qty };
  if (['adjust_add', 'return'].includes(type)) return { received_qty: qty };
  return {};
}

function matchesMovementFilter(type: string, filter: string | null): boolean {
  if (!filter) return true;
  if (filter === 'sale_out') return ['sale'].includes(type);
  if (filter === 'adjust') return ['adjust_add', 'adjust_sub'].includes(type);
  if (filter === 'reservation') return ['reservation', 'cancel_res'].includes(type);
  return type === filter;
}

function supplierNameFromProduct(product: MovementRow['products']): string | null {
  const variety = firstRow(product?.seed_varieties);
  const supplier = firstRow(variety?.seed_suppliers);
  return supplier?.supplier_name ?? null;
}

function searchableText(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ').toLowerCase();
}

// GET /api/admin/reports/stock-daily-movement?from=YYYY-MM-DD&to=YYYY-MM-DD&warehouse_id=&product_id=&movement_type=&mode=&q=
export async function GET(request: Request) {
  const _ar = await requireAdminPermission('reports.read');
  if (isForbidden(_ar)) return _ar.forbidden;

  const url = new URL(request.url);
  const to = parseDateParam(url.searchParams.get('to')) ?? new Date().toISOString().slice(0, 10);
  const from = parseDateParam(url.searchParams.get('from')) ?? new Date(new Date(`${to}T00:00:00.000Z`).getTime() - 29 * dayMs).toISOString().slice(0, 10);
  const warehouseId = url.searchParams.get('warehouse_id') || null;
  const productId = url.searchParams.get('product_id') || null;
  const movementType = url.searchParams.get('movement_type') || null;
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
    id, movement_no, warehouse_id, product_id, variety_id, product_name, movement_type, qty, unit, unit_cost, unit_price, total_amount, ref_type, ref_id, ref_no, note, created_at,
    warehouses!stock_movements_warehouse_id_fkey(id, code, name),
    products!stock_movements_product_id_fkey(id, name, category, unit, seed_varieties(seed_suppliers(supplier_name))),
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
  const saleRefIds = movementRows.filter((m) => (m.ref_type === 'sale_order' || m.ref_type === 'sale') && m.ref_id).map((m) => m.ref_id as string);
  const seedRefIds = movementRows.filter((m) => (m.ref_type === 'reservation' || m.ref_type === 'seed_reservation') && m.ref_id).map((m) => m.ref_id as string);

  const [saleRes, seedRes] = await Promise.all([
    saleRefIds.length ? s.from('sale_orders').select('id, order_number, member_id, members:member_id(id, full_name, phone)').in('id', saleRefIds) : Promise.resolve({ data: [] as RefRow[] }),
    seedRefIds.length ? s.from('seed_reservations').select('id, reservation_no, member_id, members:member_id(id, full_name, phone)').in('id', seedRefIds) : Promise.resolve({ data: [] as RefRow[] }),
  ]);

  const refMap = new Map<string, RefRow>();
  ([...(saleRes.data ?? []), ...(seedRes.data ?? [])] as unknown as RefRow[]).forEach((row) => {
    if (row.id) refMap.set(row.id, row);
  });

  const days = dateRange(from, to);
  const productMeta = new Map<string, ProductMeta>();
  const warehouseMeta = new Map<string, WarehouseMeta>();
  const currentBalance = new Map<string, number>();
  const currentReserved = new Map<string, number>();
  const dailyMovement = new Map<string, Totals>();
  const dailyNetMovement = new Map<string, number>();
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
        seller_name: 'movement_no' in row ? supplierNameFromProduct(p as MovementRow['products']) : null,
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
    dailyNetMovement.set(dKey, (dailyNetMovement.get(dKey) ?? 0) + delta);
    if (!matchesMovementFilter(row.movement_type, movementType)) return;
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
    if (search && !searchableText([meta.product_name, meta.category, wh.warehouse_code, wh.warehouse_name, meta.seller_name]).includes(search)) return;

    // Current stock is a live balance. Roll it back through every movement from
    // `from` to now so the first row starts with the opening balance for the
    // requested period. This is read-only and does not create a closing period.
    let opening = (currentBalance.get(cKey) ?? 0) - (netSinceFrom.get(cKey) ?? 0);

    days.forEach((date) => {
      const dKey = `${date}__${cKey}`;
      const movement = dailyMovement.get(dKey) ?? emptyTotals();
      const dayNet = dailyNetMovement.get(dKey) ?? 0;
      const ending = opening + dayNet;
      const hasFilteredMovement = Boolean(movement.received_qty || movement.transfer_in_qty || movement.transfer_out_qty || movement.sold_out_qty || movement.reserved_qty);
      const includeRow = movementType ? hasFilteredMovement : hasFilteredMovement || opening || ending || currentReserved.get(cKey);
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

  const detailRows = movementRows.reduce<DetailRow[]>((list, row) => {
    const date = row.created_at.slice(0, 10);
    if (date < from || date > to || !matchesMovementFilter(row.movement_type, movementType)) return list;
    const meta = productMeta.get(productKey(row.product_id, row.variety_id));
    const wh = warehouseMeta.get(row.warehouse_id);
    if (!meta || !wh) return list;
    const ref = row.ref_id ? refMap.get(row.ref_id) : null;
    const member = firstRow(ref?.members);
    const sellerName = row.movement_type === 'receive' ? supplierNameFromProduct(firstRow(row.products)) ?? meta.seller_name : null;
    const refOrderNumber = ref?.order_number ?? ref?.reservation_no ?? null;
    if (search && !searchableText([
      meta.product_name,
      meta.category,
      wh.warehouse_code,
      wh.warehouse_name,
      row.movement_no,
      row.ref_no,
      refOrderNumber,
      row.note,
      sellerName,
      member?.full_name,
      member?.phone,
    ]).includes(search)) return list;

    list.push({
      id: row.id,
      date,
      created_at: row.created_at,
      movement_no: row.movement_no,
      movement_type: row.movement_type,
      warehouse_id: row.warehouse_id,
      warehouse_code: wh.warehouse_code,
      warehouse_name: wh.warehouse_name,
      product_id: row.product_id,
      variety_id: row.variety_id,
      product_name: meta.product_name,
      category: meta.category,
      unit: meta.unit,
      qty: asNumber(row.qty),
      unit_cost: nullableNumber(row.unit_cost),
      unit_price: nullableNumber(row.unit_price),
      total_amount: nullableNumber(row.total_amount),
      ref_type: row.ref_type,
      ref_id: row.ref_id,
      ref_no: row.ref_no,
      note: row.note,
      seller_name: sellerName,
      buyer_name: member?.full_name ?? null,
      buyer_phone: member?.phone ?? null,
      ref_order_number: refOrderNumber,
    });
    return list;
  }, []);

  rows.sort((a, b) => b.date.localeCompare(a.date) || a.warehouse_name.localeCompare(b.warehouse_name) || a.product_name.localeCompare(b.product_name));
  detailRows.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const totals = rows.reduce<Totals>((sum, row) => ({
    opening_balance: sum.opening_balance + row.opening_balance,
    received_qty: sum.received_qty + row.received_qty,
    transfer_in_qty: sum.transfer_in_qty + row.transfer_in_qty,
    transfer_out_qty: sum.transfer_out_qty + row.transfer_out_qty,
    sold_out_qty: sum.sold_out_qty + row.sold_out_qty,
    reserved_qty: sum.reserved_qty + row.reserved_qty,
    ending_balance: sum.ending_balance + row.ending_balance,
    row_count: sum.row_count + 1,
  }), emptyTotals());

  const detailTotals = detailRows.reduce<Totals>((sum, row) => {
    const add = movementBucket(row.movement_type, row.qty);
    sum.received_qty += add.received_qty ?? 0;
    sum.transfer_in_qty += add.transfer_in_qty ?? 0;
    sum.transfer_out_qty += add.transfer_out_qty ?? 0;
    sum.sold_out_qty += add.sold_out_qty ?? 0;
    sum.reserved_qty += add.reserved_qty ?? 0;
    sum.row_count += 1;
    return sum;
  }, { ...emptyTotals(), ending_balance: totals.ending_balance });

  return NextResponse.json({
    from,
    to,
    warehouse_id: warehouseId,
    product_id: productId,
    movement_type: movementType,
    rows,
    detail_rows: detailRows,
    totals: url.searchParams.get('mode') === 'detail' ? detailTotals : totals,
    as_of: new Date().toISOString(),
  });
}

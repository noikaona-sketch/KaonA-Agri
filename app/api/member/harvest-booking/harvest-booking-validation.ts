import { NextResponse } from 'next/server';

export const VALID_DRYING          = ['required', 'optional', 'not_required', 'unknown'] as const;
export const VALID_DELIVERY        = ['fresh', 'field_dry', 'unknown'] as const;
export const VALID_MOISTURE_SOURCE = ['farmer_estimate', 'field_test', 'factory_measure'] as const;
export const HARVESTABLE_STATUSES  = ['planted', 'growing', 'flowering', 'maturing', 'fruiting', 'ready'] as const;

export type DryingPref     = typeof VALID_DRYING[number];
export type DeliveryType   = typeof VALID_DELIVERY[number];
export type MoistureSource = typeof VALID_MOISTURE_SOURCE[number];

export type HarvestBookingBody = {
  planting_cycle_id:      string;
  scheduled_date:         string;
  plot_id?:               string;
  note?:                  string;
  drying_preference?:     DryingPref;
  delivery_type?:         DeliveryType;
  estimated_moisture_pct?: number;
  moisture_source?:       MoistureSource;
  estimated_yield_kg?:    number;
};

export function validateEditableFields(
  body: Partial<HarvestBookingBody>,
): ReturnType<typeof NextResponse.json> | null {
  if (body.drying_preference && !(VALID_DRYING as readonly string[]).includes(body.drying_preference)) {
    return NextResponse.json({ error: 'drying_preference ไม่ถูกต้อง' }, { status: 400 });
  }
  if (body.delivery_type && !(VALID_DELIVERY as readonly string[]).includes(body.delivery_type)) {
    return NextResponse.json({ error: 'delivery_type ไม่ถูกต้อง' }, { status: 400 });
  }
  if (body.moisture_source && !(VALID_MOISTURE_SOURCE as readonly string[]).includes(body.moisture_source)) {
    return NextResponse.json({ error: 'moisture_source ไม่ถูกต้อง' }, { status: 400 });
  }
  return null;
}

export function validateBody(
  body: HarvestBookingBody,
): ReturnType<typeof NextResponse.json> | null {
  if (!body.planting_cycle_id || !body.scheduled_date) {
    return NextResponse.json({ error: 'กรุณาระบุรอบปลูกและวันที่คาดว่าจะเก็บเกี่ยว' }, { status: 400 });
  }
  return validateEditableFields(body);
}

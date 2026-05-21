import { NextResponse } from 'next/server';

export const HARVESTABLE_STATUSES  = ['planted', 'growing', 'flowering', 'maturing', 'fruiting', 'ready'] as const;

export type HarvestBookingBody = {
  planting_cycle_id:   string;
  expected_date_from:  string;
  expected_date_to:    string;
  estimated_tonnage?:  number;
  estimated_moisture?: number;
  requires_dryer?:     boolean;
  note?:               string;
};

export function validateEditableFields(
  body: Partial<HarvestBookingBody>,
): ReturnType<typeof NextResponse.json> | null {
  if (body.estimated_tonnage !== undefined && Number(body.estimated_tonnage) <= 0) {
    return NextResponse.json({ error: 'estimated_tonnage ต้องมากกว่า 0' }, { status: 400 });
  }
  if (body.estimated_moisture !== undefined) {
    const m = Number(body.estimated_moisture);
    if (!Number.isFinite(m) || m < 0 || m > 100) {
      return NextResponse.json({ error: 'estimated_moisture ต้องอยู่ระหว่าง 0-100' }, { status: 400 });
    }
  }
  if (body.expected_date_from && body.expected_date_to && body.expected_date_from > body.expected_date_to) {
    return NextResponse.json({ error: 'ช่วงวันที่ไม่ถูกต้อง' }, { status: 400 });
  }
  return null;
}

export function validateBody(
  body: HarvestBookingBody,
): ReturnType<typeof NextResponse.json> | null {
  if (!body.planting_cycle_id || !body.expected_date_from || !body.expected_date_to) {
    return NextResponse.json({ error: 'กรุณาระบุรอบปลูกและช่วงวันที่คาดว่าจะเก็บเกี่ยว' }, { status: 400 });
  }
  return validateEditableFields(body);
}

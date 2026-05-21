import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../../_admin-auth';

type ImportRow = {
  rowNumber: number;
  full_name: string;
  phone: string | null;
  citizen_id_masked: string | null;
  district: string | null;
  province: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  line_user_id: string | null;
};

function norm(v: string | null | undefined): string {
  return (v ?? '').trim();
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
    } else if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): { records: Record<string, string>[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { records: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const records = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = cols[idx]?.trim() ?? '';
    });
    return rec;
  });
  return { records };
}

function toMaskedCitizen(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return `${'*'.repeat(Math.max(0, digits.length - 1))}${digits.slice(-1)}`;
  return `${digits.slice(0, 1)}${'*'.repeat(Math.max(0, digits.length - 3))}${digits.slice(-2)}`;
}

function isSafeMaskedCitizen(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const hasMaskChar = /[*xX]/.test(v);
  if (!hasMaskChar) return false;
  const visibleDigits = (v.match(/\d/g) ?? []).length;
  return visibleDigits <= 4;
}

function buildRows(records: Record<string, string>[]) {
  const rows: ImportRow[] = [];
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const rowNo = i + 2;
    const rec = records[i];

    const full_name = norm(rec.full_name || rec.name);
    const phone = norm(rec.phone) || null;
    const district = norm(rec.district) || null;
    const province = norm(rec.province) || null;

    const citizenMaskedInput = norm(rec.citizen_id_masked);
    const citizenRawInput = norm(rec.citizen_id);
    let citizen_id_masked: string | null = null;
    if (citizenMaskedInput) {
      citizen_id_masked = isSafeMaskedCitizen(citizenMaskedInput) ? citizenMaskedInput : null;
    } else if (citizenRawInput) {
      citizen_id_masked = toMaskedCitizen(citizenRawInput);
    }

    const bank_name = norm(rec.bank_name) || null;
    const bank_account_name = norm(rec.bank_account_name) || null;
    const bank_account_number = norm(rec.bank_account_number) || null;
    const line_user_id = norm(rec.line_user_id) || null;

    if (!full_name) errors.push(`แถว ${rowNo}: full_name จำเป็นต้องระบุ`);

    rows.push({
      rowNumber: rowNo,
      full_name,
      phone,
      citizen_id_masked,
      district,
      province,
      bank_name,
      bank_account_number,
      bank_account_name,
      line_user_id,
    });
  }

  return { rows, errors };
}

export async function POST(request: Request) {
  const permission = await requireAdminPermission('members.import');
  if (isForbidden(permission)) return permission.forbidden;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const overrideDuplicate = String(form.get('overrideDuplicate') ?? 'false') === 'true';

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, errors: ['กรุณาอัปโหลดไฟล์ผ่านฟิลด์ file'] }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.csv')) {
      return NextResponse.json({ ok: false, errors: ['confirm รองรับเฉพาะ .csv ใน PR นี้'] }, { status: 400 });
    }

    const text = await file.text();
    const parsed = parseCsv(text);
    const { rows, errors } = buildRows(parsed.records);

    if (errors.length > 0) {
      return NextResponse.json({ ok: false, errors, inserted: 0 }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const phones = Array.from(new Set(rows.map((r) => r.phone).filter((v): v is string => !!v)));
    const idsMasked = Array.from(new Set(rows.map((r) => r.citizen_id_masked).filter((v): v is string => !!v)));

    const existingByPhone = phones.length > 0
      ? await s.from('members').select('id,phone').in('phone', phones).limit(1000)
      : { data: [], error: null };
    const existingByMasked = idsMasked.length > 0
      ? await s.from('members').select('id,citizen_id_masked').in('citizen_id_masked', idsMasked).limit(1000)
      : { data: [], error: null };

    if (existingByPhone.error || existingByMasked.error) {
      return NextResponse.json({
        ok: false,
        errors: [existingByPhone.error?.message, existingByMasked.error?.message].filter((v): v is string => !!v),
      }, { status: 500 });
    }

    const duplicateRows = rows.filter((r) => {
      const phoneDup = r.phone ? (existingByPhone.data ?? []).some((e) => e.phone === r.phone) : false;
      const maskedDup = r.citizen_id_masked ? (existingByMasked.data ?? []).some((e) => e.citizen_id_masked === r.citizen_id_masked) : false;
      return phoneDup || maskedDup;
    });

    if (duplicateRows.length > 0 && !overrideDuplicate) {
      return NextResponse.json({
        ok: false,
        inserted: 0,
        blocked: true,
        duplicateCount: duplicateRows.length,
        errors: ['พบข้อมูลซ้ำ กรุณาตรวจสอบ preview หรือส่ง overrideDuplicate=true เพื่อยืนยัน'],
      }, { status: 409 });
    }

    const payload = rows.map((r) => ({
      full_name: r.full_name,
      phone: r.phone,
      citizen_id_masked: r.citizen_id_masked,
      district: r.district,
      province: r.province,
      bank_name: r.bank_name,
      bank_account_number: r.bank_account_number,
      bank_account_name: r.bank_account_name,
      line_user_id: r.line_user_id,
      status: 'pending',
      registration_type: 'admin_import',
    }));

    const insertedIds: string[] = [];
    for (const row of payload) {
      const { data, error } = await s.from('members').insert(row).select('id').single();
      if (error) {
        if (insertedIds.length > 0) {
          await s.from('members').delete().in('id', insertedIds);
        }
        return NextResponse.json({ ok: false, inserted: 0, errors: [`insert ล้มเหลวและ rollback แล้ว: ${error.message}`] }, { status: 500 });
      }
      insertedIds.push(data.id);
    }

    void s.from('admin_audit_logs').insert({
      action: 'members.import.confirm',
      resource: 'members',
      detail: {
        inserted: insertedIds.length,
        overrideDuplicate,
      },
    });

    return NextResponse.json({
      ok: true,
      inserted: insertedIds.length,
      status: 'pending',
      overrideDuplicate,
      message: 'นำเข้าสมาชิกสำเร็จ (สถานะ pending ทั้งหมด)',
    });
  } catch (e) {
    return NextResponse.json({ ok: false, errors: [String(e)] }, { status: 500 });
  }
}

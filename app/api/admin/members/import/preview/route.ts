import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../../_admin-auth';

type PreviewRow = {
  rowNumber: number;
  full_name: string;
  phone: string | null;
  citizen_id_masked: string | null;
  district: string | null;
  province: string | null;
  bank_name: string | null;
  bank_account_number_masked: string | null;
  bank_account_name: string | null;
  line_user_id: string | null;
};

type DuplicateCandidate = {
  rowNumber: number;
  reasons: string[];
  existing: Array<{
    id: string;
    full_name: string | null;
    phone: string | null;
    citizen_id_masked: string | null;
    district: string | null;
    province: string | null;
  }>;
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
  // Fail closed: if too many visible digits, treat as unsafe.
  return visibleDigits <= 4;
}

function maskBankAccount(raw: string): string {
  const digits = raw.replace(/\s+/g, '');
  if (!digits) return '';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

function parseCsv(text: string): { headers: string[]; records: Record<string, string>[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], records: [] };
  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const records = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const rec: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rec[h] = cols[idx]?.trim() ?? '';
    });
    return rec;
  });
  return { headers, records };
}

export async function POST(request: Request) {
  const permission = await requireAdminPermission('members.import');
  if (isForbidden(permission)) return permission.forbidden;

  try {
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, errors: ['กรุณาอัปโหลดไฟล์ผ่านฟิลด์ file'] }, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.xlsx')) {
      return NextResponse.json({
        ok: false,
        rows: [],
        errors: ['ยังไม่รองรับ .xlsx ใน PR นี้ (ไม่มี dependency parser ที่อนุมัติในโปรเจกต์)'],
        warnings: ['โปรดส่งไฟล์ .csv สำหรับ preview ใน PR นี้'],
        duplicateCandidates: [],
        summary: { totalRows: 0, validRows: 0, invalidRows: 0, duplicateRows: 0 },
      }, { status: 400 });
    }
    if (!lowerName.endsWith('.csv')) {
      return NextResponse.json({ ok: false, errors: ['รองรับเฉพาะ .csv ใน PR นี้'] }, { status: 400 });
    }

    const text = await file.text();
    const parsed = parseCsv(text);

    const rows: PreviewRow[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < parsed.records.length; i++) {
      const rowNo = i + 2;
      const rec = parsed.records[i];
      const full_name = norm(rec.full_name || rec.name);
      const phone = norm(rec.phone) || null;
      const district = norm(rec.district) || null;
      const province = norm(rec.province) || null;
      const citizenMaskedInput = norm(rec.citizen_id_masked);
      const citizenRawInput = norm(rec.citizen_id);
      let citizen_id_masked: string | null = null;
      if (citizenMaskedInput) {
        if (isSafeMaskedCitizen(citizenMaskedInput)) {
          citizen_id_masked = citizenMaskedInput;
        } else {
          warnings.push(`แถว ${rowNo}: citizen_id_masked ไม่ปลอดภัย จึงไม่แสดงค่าใน preview`);
        }
      } else if (citizenRawInput) {
        citizen_id_masked = toMaskedCitizen(citizenRawInput);
      }
      const bank_name = norm(rec.bank_name) || null;
      const bank_account_name = norm(rec.bank_account_name) || null;
      const bank_account_number_masked = norm(rec.bank_account_number) ? maskBankAccount(rec.bank_account_number) : null;
      const line_user_id = norm(rec.line_user_id) || null;

      if (!full_name) errors.push(`แถว ${rowNo}: full_name จำเป็นต้องระบุ`);
      if (!phone) warnings.push(`แถว ${rowNo}: แนะนำให้ระบุ phone`);
      if (!district || !province) warnings.push(`แถว ${rowNo}: แนะนำให้ระบุ district และ province`);

      const hasAnyBank = !!(bank_name || bank_account_name || bank_account_number_masked);
      const bankFieldsComplete = !!(bank_name && bank_account_name && bank_account_number_masked);
      if (hasAnyBank && !bankFieldsComplete) warnings.push(`แถว ${rowNo}: ข้อมูลธนาคารไม่ครบถ้วน`);

      rows.push({
        rowNumber: rowNo,
        full_name,
        phone,
        citizen_id_masked,
        district,
        province,
        bank_name,
        bank_account_name,
        bank_account_number_masked,
        line_user_id,
      });
    }

    const s = createServerSupabaseClient();
    const phones = Array.from(new Set(rows.map((r) => r.phone).filter((v): v is string => !!v)));
    const idsMasked = Array.from(new Set(rows.map((r) => r.citizen_id_masked).filter((v): v is string => !!v)));
    const fullNames = Array.from(new Set(rows.map((r) => r.full_name).filter((v) => v)));

    const existingByPhone = phones.length > 0
      ? await s.from('members').select('id,full_name,phone,citizen_id_masked,district,province').in('phone', phones).limit(500)
      : { data: [], error: null };
    const existingByMasked = idsMasked.length > 0
      ? await s.from('members').select('id,full_name,phone,citizen_id_masked,district,province').in('citizen_id_masked', idsMasked).limit(500)
      : { data: [], error: null };
    const existingByName = fullNames.length > 0
      ? await s.from('members').select('id,full_name,phone,citizen_id_masked,district,province').in('full_name', fullNames).limit(1000)
      : { data: [], error: null };

    const dupMap = new Map<number, DuplicateCandidate>();
    const addDup = (rowNumber: number, reason: string, existing: DuplicateCandidate['existing']) => {
      const curr = dupMap.get(rowNumber) ?? { rowNumber, reasons: [], existing: [] };
      if (!curr.reasons.includes(reason)) curr.reasons.push(reason);
      const existingIds = new Set(curr.existing.map((e) => e.id));
      existing.forEach((e) => { if (!existingIds.has(e.id)) curr.existing.push(e); });
      dupMap.set(rowNumber, curr);
    };

    const phoneRows = (existingByPhone.data ?? []) as DuplicateCandidate['existing'];
    const maskedRows = (existingByMasked.data ?? []) as DuplicateCandidate['existing'];

    rows.forEach((r) => {
      if (r.phone) {
        const matches = phoneRows.filter((e) => e.phone === r.phone);
        if (matches.length > 0) addDup(r.rowNumber, 'phone match', matches);
      }
      if (r.citizen_id_masked) {
        const matches = maskedRows.filter((e) => e.citizen_id_masked === r.citizen_id_masked);
        if (matches.length > 0) addDup(r.rowNumber, 'citizen_id_masked match', matches);
      }

      if (r.full_name && r.province && r.district) {
        const weakMatches = ((existingByName.data ?? []) as DuplicateCandidate['existing']).filter((e) =>
          e.full_name === r.full_name && e.province === r.province && e.district === r.district,
        );
        if (weakMatches.length > 0) {
          warnings.push(`แถว ${r.rowNumber}: อาจซ้ำจาก full_name + province/district (weak match)`);
          addDup(r.rowNumber, 'full_name + province/district (weak)', weakMatches);
        }
      }
    });

    const duplicateCandidates = Array.from(dupMap.values());

    if (existingByPhone.error) warnings.push(`ตรวจ duplicate phone ไม่สมบูรณ์: ${existingByPhone.error.message}`);
    if (existingByMasked.error) warnings.push(`ตรวจ duplicate citizen_id_masked ไม่สมบูรณ์: ${existingByMasked.error.message}`);
    if (existingByName.error) warnings.push(`ตรวจ duplicate weak match ไม่สมบูรณ์: ${existingByName.error.message}`);

    const invalidRowNumbers = new Set(errors.map((e) => Number((e.match(/แถว (\d+)/) ?? [])[1])).filter((n) => !Number.isNaN(n)));

    return NextResponse.json({
      ok: errors.length === 0,
      rows,
      errors,
      warnings,
      duplicateCandidates,
      summary: {
        totalRows: rows.length,
        validRows: rows.length - invalidRowNumbers.size,
        invalidRows: invalidRowNumbers.size,
        duplicateRows: duplicateCandidates.length,
      },
    });
  } catch (e) {
    return NextResponse.json({ ok: false, errors: [String(e)] }, { status: 500 });
  }
}

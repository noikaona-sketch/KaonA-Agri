import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '../../../../auth/line/line-auth-helpers';
import { isForbidden, requireAdminPermission } from '../../_admin-auth';

type ConfirmRow = {
  rowNumber?: number;
  full_name?: string;
  phone?: string | null;
  citizen_id_masked?: string | null;
  district?: string | null;
  province?: string | null;
  bank_name?: string | null;
  bank_account_number_masked?: string | null;
  bank_account_name?: string | null;
  line_user_id?: string | null;
};

type ConfirmPayload = {
  rows?: ConfirmRow[];
  overrideDuplicate?: boolean;
  importNote?: string;
};

function norm(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function isSafeMaskedCitizen(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (!/[*xX]/.test(v)) return false;
  return ((v.match(/\d/g) ?? []).length) <= 4;
}

export async function POST(request: Request) {
  const permission = await requireAdminPermission('members.import');
  if (isForbidden(permission)) return permission.forbidden;

  try {
    const body = (await request.json()) as ConfirmPayload;
    const rows = body.rows ?? [];
    const overrideDuplicate = body.overrideDuplicate === true;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ ok: false, errors: ['rows ต้องเป็น array และต้องไม่ว่าง'] }, { status: 400 });
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    const cleanRows = rows.map((row, idx) => {
      const rowNo = Number(row.rowNumber ?? idx + 1);
      const full_name = norm(row.full_name);
      const phone = norm(row.phone) || null;
      const citizen_id_masked = norm(row.citizen_id_masked) || null;
      const district = norm(row.district) || null;
      const province = norm(row.province) || null;
      const bank_name = norm(row.bank_name) || null;
      const bank_account_name = norm(row.bank_account_name) || null;
      const bank_account_number_masked = norm(row.bank_account_number_masked) || null;
      const line_user_id = norm(row.line_user_id) || null;

      if (!full_name) errors.push(`แถว ${rowNo}: full_name จำเป็นต้องระบุ`);
      if (!phone) warnings.push(`แถว ${rowNo}: แนะนำให้ระบุ phone`);
      if (!district || !province) warnings.push(`แถว ${rowNo}: แนะนำให้ระบุ district และ province`);

      if (citizen_id_masked && !isSafeMaskedCitizen(citizen_id_masked)) {
        errors.push(`แถว ${rowNo}: citizen_id_masked ไม่ปลอดภัย`);
      }

      const hasAnyBank = !!(bank_name || bank_account_name || bank_account_number_masked);
      const bankFieldsComplete = !!(bank_name && bank_account_name && bank_account_number_masked);
      if (hasAnyBank && !bankFieldsComplete) warnings.push(`แถว ${rowNo}: ข้อมูลธนาคารไม่ครบถ้วน`);

      return {
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
      };
    });

    if (errors.length > 0) {
      return NextResponse.json({
        ok: false,
        insertedCount: 0,
        blockedCount: cleanRows.length,
        duplicateBlockCount: 0,
        errors,
        warnings,
      }, { status: 400 });
    }

    const s = createServerSupabaseClient();
    const phones = Array.from(new Set(cleanRows.map((r) => r.phone).filter((v): v is string => !!v)));
    const idsMasked = Array.from(new Set(cleanRows.map((r) => r.citizen_id_masked).filter((v): v is string => !!v)));
    const fullNames = Array.from(new Set(cleanRows.map((r) => r.full_name).filter((v) => v)));

    const existingByPhone = phones.length > 0
      ? await s.from('members').select('id,full_name,phone,citizen_id_masked,district,province').in('phone', phones).limit(500)
      : { data: [], error: null };
    const existingByMasked = idsMasked.length > 0
      ? await s.from('members').select('id,full_name,phone,citizen_id_masked,district,province').in('citizen_id_masked', idsMasked).limit(500)
      : { data: [], error: null };
    const existingByName = fullNames.length > 0
      ? await s.from('members').select('id,full_name,phone,citizen_id_masked,district,province').in('full_name', fullNames).limit(1000)
      : { data: [], error: null };

    const duplicateCandidates: Array<{ rowNumber: number; reasons: string[]; existing: unknown[] }> = [];
    cleanRows.forEach((r) => {
      const reasons: string[] = [];
      const existing: Record<string, unknown>[] = [];
      if (r.phone) {
        const m = ((existingByPhone.data ?? []) as Record<string, unknown>[]).filter((e) => e.phone === r.phone);
        if (m.length) { reasons.push('phone match'); existing.push(...m); }
      }
      if (r.citizen_id_masked) {
        const m = ((existingByMasked.data ?? []) as Record<string, unknown>[]).filter((e) => e.citizen_id_masked === r.citizen_id_masked);
        if (m.length) { reasons.push('citizen_id_masked match'); existing.push(...m); }
      }
      if (r.full_name && r.province && r.district) {
        const m = ((existingByName.data ?? []) as Record<string, unknown>[]).filter((e) => e.full_name === r.full_name && e.province === r.province && e.district === r.district);
        if (m.length) { reasons.push('full_name + province/district (weak)'); existing.push(...m); }
      }
      if (reasons.length > 0) {
        duplicateCandidates.push({ rowNumber: r.rowNumber, reasons, existing });
      }
    });

    if ((existingByPhone.error || existingByMasked.error || existingByName.error)) {
      return NextResponse.json({ ok: false, errors: ['ตรวจ duplicate ไม่สำเร็จ'], warnings }, { status: 500 });
    }

    if (duplicateCandidates.length > 0 && !overrideDuplicate) {
      return NextResponse.json({
        ok: false,
        insertedCount: 0,
        blockedCount: cleanRows.length,
        duplicateBlockCount: duplicateCandidates.length,
        errors: ['พบ duplicateCandidates ต้องส่ง overrideDuplicate=true เพื่อยืนยันการ import'],
        warnings,
        duplicateCandidates,
      }, { status: 409 });
    }

    const insertedIds: string[] = [];
    const insertErrors: string[] = [];

    for (const row of cleanRows) {
      const payload: Record<string, unknown> = {
        full_name: row.full_name,
        phone: row.phone,
        citizen_id_masked: row.citizen_id_masked,
        district: row.district,
        province: row.province,
        bank_name: row.bank_name,
        bank_account_name: row.bank_account_name,
        bank_account_number: row.bank_account_number_masked,
        line_user_id: row.line_user_id,
        status: 'pending',
        registration_type: 'admin_created',
      };

      const { data, error } = await s.from('members').insert(payload).select('id').single();
      if (error || !data?.id) {
        insertErrors.push(`แถว ${row.rowNumber}: ${error?.message ?? 'insert failed'}`);
        break;
      }
      insertedIds.push(data.id as string);
    }

    if (insertErrors.length > 0) {
      if (insertedIds.length > 0) {
        const { error: rollbackError } = await s.from('members').delete().in('id', insertedIds);
        if (rollbackError) {
          insertErrors.push(`rollback ไม่สมบูรณ์: ${rollbackError.message}`);
        }
      }
      return NextResponse.json({
        ok: false,
        insertedCount: 0,
        blockedCount: cleanRows.length,
        duplicateBlockCount: duplicateCandidates.length,
        errors: insertErrors,
        warnings,
        duplicateCandidates,
        rolledBack: true,
      }, { status: 500 });
    }

    await s.from('audit_logs').insert({
      actor_member_id: null,
      actor_role: `admin:${permission.admin.adminRole}`,
      action: 'members.import.confirm',
      resource_type: 'member',
      resource_id: insertedIds[0] ?? null,
      new_data: {
        imported_count: insertedIds.length,
        override_duplicate: overrideDuplicate,
        duplicate_count: duplicateCandidates.length,
        import_note: norm(body.importNote) || null,
      },
    }).then(() => {
      // best-effort audit only
    });

    return NextResponse.json({
      ok: true,
      insertedCount: insertedIds.length,
      blockedCount: 0,
      duplicateBlockCount: duplicateCandidates.length,
      errors: [],
      warnings,
      duplicateCandidates,
      status: 'pending_approval_only',
      noAutoApprove: true,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, errors: [String(e)] }, { status: 500 });
  }
}

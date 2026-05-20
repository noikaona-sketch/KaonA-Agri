import { NextResponse } from 'next/server';
import { readFile }     from 'fs/promises';
import { join }         from 'path';
import { isForbidden, requireAdminPermission } from '../_admin-auth';

export async function GET() {
  const _ar_get = await requireAdminPermission('members.import');
  if (isForbidden(_ar_get)) return _ar_get.forbidden;

  try {
    const filePath = join(process.cwd(), 'public', 'templates', 'member_import_template.xlsx');
    const buffer   = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="kaona_member_import_template.xlsx"',
      },
    });
  } catch {
    return NextResponse.json({ error: 'ไม่พบไฟล์ template' }, { status: 500 });
  }
}

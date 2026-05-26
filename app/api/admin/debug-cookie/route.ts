import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = await cookies();
  const all   = store.getAll().map(c => ({ name: c.name, value: c.value.slice(0, 20) + '…' }));
  const admin = store.get('kaona_admin_web')?.value ?? null;
  return NextResponse.json({ cookies: all, kaona_admin_web: admin });
}

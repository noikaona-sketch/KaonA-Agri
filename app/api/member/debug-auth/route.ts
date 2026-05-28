import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAnonSupabaseClient } from '../../auth/line/line-auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'no token', tokenLength: 0 });

  // ลอง anon client
  try {
    const anon = createAnonSupabaseClient();
    const { data: { user }, error } = await anon.auth.getUser(token);
    
    // ลอง service role
    const svc = createServerSupabaseClient();
    const { data: { user: svcUser }, error: svcError } = await svc.auth.getUser(token);

    // หา member
    const { data: member } = await svc.from('members')
      .select('id, full_name, status, auth_user_id')
      .eq('auth_user_id', user?.id ?? 'none')
      .maybeSingle();

    return NextResponse.json({
      tokenLength:    token.length,
      tokenPrefix:    token.slice(0, 20),
      anonUser:       user ? { id: user.id, email: user.email } : null,
      anonError:      error?.message ?? null,
      svcUser:        svcUser ? { id: svcUser.id } : null,
      svcError:       svcError?.message ?? null,
      member:         member ?? null,
    });
  } catch (e) {
    return NextResponse.json({ caught: String(e) });
  }
}

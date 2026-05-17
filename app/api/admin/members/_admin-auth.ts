// Admin server-side validation helper
// ใช้ cookie kaona_admin_web (UUID หรือ env-super-admin) เหมือน middleware
import { cookies } from 'next/headers';
import { createServerSupabaseClient } from '../../auth/line/line-auth-helpers';

const VALID_ADMIN_COOKIE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$|^env-super-admin$/i;
const ADMIN_COOKIE_NAME  = 'kaona_admin_web';

export type AdminActor = { adminUserId: string; email: string | null };

export async function requireAdmin(): Promise<AdminActor | null> {
  try {
    const cookieStore = await cookies();
    const cookieVal   = cookieStore.get(ADMIN_COOKIE_NAME)?.value ?? '';

    if (!VALID_ADMIN_COOKIE.test(cookieVal)) return null;

    // env-super-admin (dev/test)
    if (cookieVal === 'env-super-admin') {
      return { adminUserId: 'env-super-admin', email: 'super@kaona.app' };
    }

    // UUID — lookup admin_users table
    const s = createServerSupabaseClient();
    const { data } = await s.from('admin_users')
      .select('id,email,status')
      .eq('id', cookieVal)
      .eq('status', 'approved')
      .maybeSingle();

    if (!data) return null;
    return { adminUserId: (data as { id: string; email: string }).id, email: (data as { id: string; email: string | null }).email };
  } catch {
    return null;
  }
}

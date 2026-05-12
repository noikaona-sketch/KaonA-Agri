import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

import type { SupabaseSession } from '@/shared/auth/auth-types';

export async function applySupabaseSession(session: SupabaseSession | undefined): Promise<void> {
  if (!session) return;
  const supabase = tryCreateSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
}

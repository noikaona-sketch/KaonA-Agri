import { createClient } from '@supabase/supabase-js';

import { getRequiredPublicEnv } from '@/lib/env/public-env';

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = getRequiredPublicEnv();

  return createClient(supabaseUrl, supabaseAnonKey);
}

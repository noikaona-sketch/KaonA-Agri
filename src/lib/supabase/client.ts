import { createClient } from '@supabase/supabase-js';

import { getPublicEnvIfConfigured, getRequiredPublicEnv } from '@/lib/env/public-env';

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseAnonKey } = getRequiredPublicEnv();

  return createClient(supabaseUrl, supabaseAnonKey);
}

export function tryCreateSupabaseBrowserClient() {
  const env = getPublicEnvIfConfigured();

  if (!env) {
    return null;
  }

  return createClient(env.supabaseUrl, env.supabaseAnonKey);
}

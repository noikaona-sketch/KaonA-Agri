const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;
const NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;
const NEXT_PUBLIC_LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID?.trim() || null;

function readSupabaseUrl(): string {
  if (!NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL. Check .env.example and deployment environment settings.');
  }

  return NEXT_PUBLIC_SUPABASE_URL;
}

function readSupabaseAnonKey(): string {
  if (!NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY. Check .env.example and deployment environment settings.');
  }

  return NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

export function getRequiredPublicEnv() {
  return {
    supabaseUrl: readSupabaseUrl(),
    supabaseAnonKey: readSupabaseAnonKey(),
  };
}

export function getPublicEnvIfConfigured() {
  if (!NEXT_PUBLIC_SUPABASE_URL || !NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }

  return {
    supabaseUrl: NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getOptionalPublicLiffId() {
  return NEXT_PUBLIC_LIFF_ID;
}

export function getPublicSupabaseEnvPresence() {
  return {
    supabaseUrlPresent: Boolean(NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKeyPresent: Boolean(NEXT_PUBLIC_SUPABASE_ANON_KEY),
  };
}

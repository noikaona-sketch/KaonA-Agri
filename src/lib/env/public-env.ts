const REQUIRED_PUBLIC_ENV_KEYS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

type PublicEnvKey = (typeof REQUIRED_PUBLIC_ENV_KEYS)[number];

function readEnv(key: PublicEnvKey): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}. Check .env.example and deployment environment settings.`);
  }

  return value;
}

export function getRequiredPublicEnv() {
  return {
    supabaseUrl: readEnv('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  };
}

export function getOptionalPublicLiffId() {
  return process.env.NEXT_PUBLIC_LIFF_ID?.trim() || null;
}

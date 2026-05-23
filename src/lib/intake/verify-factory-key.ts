// src/lib/intake/verify-factory-key.ts
// ตรวจสอบ Bearer token ของระบบโรงงาน
// Returns { location_id } หรือ throw error

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

// ใช้ SHA-256 hash เพราะ bcrypt ต้องการ package เพิ่ม
// โรงงานส่ง: Authorization: Bearer {raw_key}
// เราเก็บ:   key_hash = sha256(raw_key) ใน factory_api_keys

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

type VerifyResult = {
  location_id : string
  key_name    : string
};

export async function verifyFactoryKey(
  authHeader : string | null,
  supabase   : SupabaseClient,
): Promise<VerifyResult> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const rawKey  = authHeader.slice(7);
  const keyHash = hashKey(rawKey);

  const { data, error } = await supabase
    .from('factory_api_keys')
    .select('id,name,location_id,is_active')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) throw new Error('Invalid API key');

  // อัปเดต last_used_at (fire-and-forget)
  void supabase
    .from('factory_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return { location_id: data.location_id as string, key_name: data.name as string };
}

// ── สร้าง API key ใหม่ (ใช้ใน admin UI) ──────────────────────────────────────
export function generateApiKey(): { raw_key: string; key_hash: string } {
  const raw_key = `kaona_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  return { raw_key, key_hash: hashKey(raw_key) };
}

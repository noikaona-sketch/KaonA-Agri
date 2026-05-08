'use client';

import { useEffect, useState } from 'react';

import { initLiff } from '@/lib/liff/init-liff';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type ProviderResult = {
  attempted: boolean;
  success: boolean;
  tokenPresent: boolean;
  safeError: string | null;
  safeStatus: string;
};

type DebugState = {
  line: ProviderResult;
  customLine: ProviderResult;
};

type LiffTokenRuntime = {
  isLoggedIn: () => boolean;
  getIDToken: () => string | null;
};

const initialResult: ProviderResult = {
  attempted: false,
  success: false,
  tokenPresent: false,
  safeError: null,
  safeStatus: 'not_started',
};

const initialState: DebugState = {
  line: initialResult,
  customLine: initialResult,
};

function yesNo(value: boolean) {
  return value ? 'yes' : 'no';
}

function getSafeError(error: unknown) {
  if (!error || typeof error !== 'object') return 'unknown_error';

  const maybeError = error as { status?: number; code?: string; name?: string };

  if (maybeError.status === 400) return 'bad_request';
  if (maybeError.status === 401) return 'unauthorized';
  if (maybeError.status === 403) return 'forbidden';
  if (maybeError.status === 422) return 'unprocessable_token_or_provider';
  if (maybeError.code) return 'auth_error_code_present';
  if (maybeError.name) return 'auth_error_name_present';

  return 'session_exchange_failed';
}

async function getRuntimeIdToken(): Promise<string | null> {
  const liff = (await initLiff()) as LiffTokenRuntime | null;

  if (!liff || !liff.isLoggedIn()) return null;

  return liff.getIDToken();
}

async function testProvider(provider: 'line' | 'custom:line'): Promise<ProviderResult> {
  try {
    const client = tryCreateSupabaseBrowserClient();

    if (!client) {
      return {
        attempted: false,
        success: false,
        tokenPresent: false,
        safeError: 'Supabase client unavailable',
        safeStatus: 'client_unavailable',
      };
    }

    const token = await getRuntimeIdToken();

    if (!token) {
      return {
        attempted: false,
        success: false,
        tokenPresent: false,
        safeError: 'LIFF token unavailable',
        safeStatus: 'token_unavailable',
      };
    }

    const { error } = await client.auth.signInWithIdToken({
      provider,
      token,
    });

    return {
      attempted: true,
      success: !error,
      tokenPresent: true,
      safeError: error ? 'Session exchange failed' : null,
      safeStatus: error ? getSafeError(error) : 'success',
    };
  } catch (error: unknown) {
    return {
      attempted: true,
      success: false,
      tokenPresent: false,
      safeError: 'Provider exchange failed',
      safeStatus: getSafeError(error),
    };
  }
}

export default function DebugSupabaseLineProviderPage() {
  const [state, setState] = useState<DebugState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const [line, customLine] = await Promise.all([
        testProvider('line'),
        testProvider('custom:line'),
      ]);

      if (!cancelled) {
        setState({ line, customLine });
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = [
    ['provider: line token present', yesNo(state.line.tokenPresent)],
    ['provider: line attempted', yesNo(state.line.attempted)],
    ['provider: line success', yesNo(state.line.success)],
    ['provider: line safe status', state.line.safeStatus],
    ['provider: custom:line token present', yesNo(state.customLine.tokenPresent)],
    ['provider: custom:line attempted', yesNo(state.customLine.attempted)],
    ['provider: custom:line success', yesNo(state.customLine.success)],
    ['provider: custom:line safe status', state.customLine.safeStatus],
  ];

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ maxWidth: 720, margin: '0 auto', border: '1px solid #ddd', borderRadius: 16, padding: 24 }}>
        <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Safe diagnostics</p>
        <h1 style={{ marginTop: 8, marginBottom: 16, fontSize: 28 }}>Supabase LINE provider exchange</h1>
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map(([name, value]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
              <span>{name}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 20, color: '#666', fontSize: 13 }}>
          This page does not expose tokens, session data, provider responses, or secrets.
        </p>
      </section>
    </main>
  );
}

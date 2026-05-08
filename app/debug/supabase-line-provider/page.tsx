'use client';

import { useEffect, useState } from 'react';

import { ensureLiffIdToken } from '@/lib/liff/init-liff';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type ProviderResult = {
  attempted: boolean;
  success: boolean;
  safeError: string | null;
};

type DebugState = {
  line: ProviderResult;
  customLine: ProviderResult;
};

const initialResult: ProviderResult = {
  attempted: false,
  success: false,
  safeError: null,
};

const initialState: DebugState = {
  line: initialResult,
  customLine: initialResult,
};

function yesNo(value: boolean) {
  return value ? 'yes' : 'no';
}

async function testProvider(provider: 'line' | 'custom:line'): Promise<ProviderResult> {
  try {
    const client = tryCreateSupabaseBrowserClient();

    if (!client) {
      return {
        attempted: false,
        success: false,
        safeError: 'Supabase client unavailable',
      };
    }

    const token = await ensureLiffIdToken();

    if (!token) {
      return {
        attempted: false,
        success: false,
        safeError: 'LIFF token unavailable',
      };
    }

    const { error } = await client.auth.signInWithIdToken({
      provider,
      token,
    });

    return {
      attempted: true,
      success: !error,
      safeError: error ? 'Session exchange failed' : null,
    };
  } catch {
    return {
      attempted: true,
      success: false,
      safeError: 'Provider exchange failed',
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
    ['provider: line attempted', yesNo(state.line.attempted)],
    ['provider: line success', yesNo(state.line.success)],
    ['provider: line safe error', state.line.safeError ?? 'none'],
    ['provider: custom:line attempted', yesNo(state.customLine.attempted)],
    ['provider: custom:line success', yesNo(state.customLine.success)],
    ['provider: custom:line safe error', state.customLine.safeError ?? 'none'],
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

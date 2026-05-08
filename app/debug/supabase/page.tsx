'use client';

import { useEffect, useState } from 'react';

import { getPublicEnvIfConfigured } from '@/lib/env/public-env';
import { tryCreateSupabaseBrowserClient } from '@/lib/supabase/client';

type DebugState = {
  envConfigured: boolean;
  clientCreated: boolean;
  authApiPresent: boolean;
  getSessionAttempted: boolean;
  getSessionSuccess: boolean;
  safeError: string | null;
};

const initialState: DebugState = {
  envConfigured: false,
  clientCreated: false,
  authApiPresent: false,
  getSessionAttempted: false,
  getSessionSuccess: false,
  safeError: null,
};

function yesNo(value: boolean) {
  return value ? 'yes' : 'no';
}

export default function DebugSupabasePage() {
  const [state, setState] = useState<DebugState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function runDebug() {
      try {
        const env = getPublicEnvIfConfigured();
        const client = tryCreateSupabaseBrowserClient();

        const baseState: DebugState = {
          envConfigured: Boolean(env),
          clientCreated: Boolean(client),
          authApiPresent: Boolean(client?.auth),
          getSessionAttempted: Boolean(client?.auth),
          getSessionSuccess: false,
          safeError: null,
        };

        if (!client?.auth) {
          if (!cancelled) {
            setState({
              ...baseState,
              safeError: 'Supabase browser client is not available',
            });
          }
          return;
        }

        const { error } = await client.auth.getSession();

        if (!cancelled) {
          setState({
            ...baseState,
            getSessionSuccess: !error,
            safeError: error ? 'Supabase auth getSession failed' : null,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            ...initialState,
            safeError: 'Supabase client debug failed',
          });
        }
      }
    }

    void runDebug();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = [
    ['Public env configured', yesNo(state.envConfigured)],
    ['Supabase client created', yesNo(state.clientCreated)],
    ['Supabase auth API present', yesNo(state.authApiPresent)],
    ['getSession attempted', yesNo(state.getSessionAttempted)],
    ['getSession success', yesNo(state.getSessionSuccess)],
    ['Safe error', state.safeError ?? 'none'],
  ];

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ maxWidth: 640, margin: '0 auto', border: '1px solid #ddd', borderRadius: 16, padding: 24 }}>
        <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Safe diagnostics</p>
        <h1 style={{ marginTop: 8, marginBottom: 16, fontSize: 28 }}>Supabase browser client</h1>
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map(([name, value]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
              <span>{name}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 20, color: '#666', fontSize: 13 }}>
          This page shows safe booleans only. It does not expose URLs, keys, tokens, sessions, or secrets.
        </p>
      </section>
    </main>
  );
}

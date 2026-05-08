'use client';

import { useEffect, useState } from 'react';

import liff from '@line/liff';

import { initLiff } from '@/lib/liff/init-liff';

type TokenState = {
  initialized: boolean;
  loggedIn: boolean;
  idTokenPresent: boolean;
  accessTokenPresent: boolean;
  decodedIdTokenPresent: boolean;
  safeError: string | null;
};

const initialState: TokenState = {
  initialized: false,
  loggedIn: false,
  idTokenPresent: false,
  accessTokenPresent: false,
  decodedIdTokenPresent: false,
  safeError: null,
};

function yesNo(value: boolean) {
  return value ? 'yes' : 'no';
}

export default function DebugLiffTokenPage() {
  const [state, setState] = useState<TokenState>(initialState);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await initLiff();

        const loggedIn = liff.isLoggedIn();

        const idToken = liff.getIDToken();
        const accessToken = liff.getAccessToken();
        const decodedIdToken = liff.getDecodedIDToken();

        if (!cancelled) {
          setState({
            initialized: true,
            loggedIn,
            idTokenPresent: Boolean(idToken),
            accessTokenPresent: Boolean(accessToken),
            decodedIdTokenPresent: Boolean(decodedIdToken),
            safeError: null,
          });
        }
      } catch {
        if (!cancelled) {
          setState({
            ...initialState,
            safeError: 'LIFF token diagnostics failed',
          });
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, []);

  const rows = [
    ['LIFF initialized', yesNo(state.initialized)],
    ['LIFF logged in', yesNo(state.loggedIn)],
    ['ID token present', yesNo(state.idTokenPresent)],
    ['Access token present', yesNo(state.accessTokenPresent)],
    ['Decoded ID token present', yesNo(state.decodedIdTokenPresent)],
    ['Safe error', state.safeError ?? 'none'],
  ];

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ maxWidth: 720, margin: '0 auto', border: '1px solid #ddd', borderRadius: 16, padding: 24 }}>
        <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Safe diagnostics</p>
        <h1 style={{ marginTop: 8, marginBottom: 16, fontSize: 28 }}>LIFF token diagnostics</h1>
        <div style={{ display: 'grid', gap: 12 }}>
          {rows.map(([name, value]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #eee', paddingBottom: 8 }}>
              <span>{name}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 20, color: '#666', fontSize: 13 }}>
          This page does not expose token values, claims, user IDs, or secrets.
        </p>
      </section>
    </main>
  );
}

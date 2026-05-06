'use client';

import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  errorMessage: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient();

      void supabase.auth.getSession().then(({ data, error }) => {
        if (error) {
          setStatus('error');
          setErrorMessage(error.message);
          return;
        }

        const currentSession = data.session;
        setSession(currentSession);
        setStatus(currentSession ? 'authenticated' : 'unauthenticated');
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
        setSession(updatedSession);
        setErrorMessage(null);
        setStatus(updatedSession ? 'authenticated' : 'unauthenticated');
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (error: unknown) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to initialize auth session.');
    }

    return undefined;
  }, []);

  const value = useMemo(
    () => ({
      status,
      session,
      errorMessage,
    }),
    [status, session, errorMessage]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}

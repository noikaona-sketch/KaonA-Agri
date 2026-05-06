'use client';

import type { Session } from '@supabase/supabase-js';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AppRole, AuthBootstrapResult, AuthStatus } from '@/shared/auth/auth-types';

type AuthContextValue = {
  status: AuthStatus;
  session: Session | null;
  member: AuthBootstrapResult | null;
  errorMessage: string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AppProvidersProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AppProvidersProps) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<AuthBootstrapResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    async function bootstrapWithSession(currentSession: Session | null) {
      setSession(currentSession);
      setErrorMessage(null);

      if (!currentSession) {
        setMember(null);
        setStatus('unauthenticated');
        return;
      }

      const { data, error } = await supabase.rpc('bootstrap_auth_session');

      if (error) {
        setMember(null);
        setStatus('error');
        setErrorMessage(error.message);
        return;
      }

      const bootstrapRow = Array.isArray(data) ? data[0] : null;

      if (!bootstrapRow) {
        setMember(null);
        setStatus('no_member');
        return;
      }

      const bootstrapResult = bootstrapRow as AuthBootstrapResult;
      setMember(bootstrapResult);

      if (bootstrapResult.status === 'pending') {
        setStatus('pending_approval');
        return;
      }

      if (bootstrapResult.status === 'rejected') {
        setStatus('rejected');
        return;
      }

      if (bootstrapResult.status === 'suspended') {
        setStatus('suspended');
        return;
      }

      if (!bootstrapResult.is_approved) {
        setStatus('access_denied');
        return;
      }

      setStatus('approved');
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setStatus('error');
        setErrorMessage(error.message);
        return;
      }
      void bootstrapWithSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, updatedSession) => {
      void bootstrapWithSession(updatedSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ status, session, member, errorMessage }),
    [status, session, member, errorMessage]
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

export function useCurrentMember() {
  return useAuth().member;
}

export function useCurrentRoles() {
  return useAuth().member?.roles ?? [];
}

export function useEffectiveRole(): AppRole | null {
  return useAuth().member?.effective_role ?? null;
}

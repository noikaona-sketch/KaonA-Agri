'use client';

import type { ReactNode } from 'react';

import type { AppRole } from '@/shared/auth/auth-types';
import { ProtectedRoute } from '@/shared/components/protected-route';

type ProtectedRouteStateProps = {
  children: ReactNode;
  allowedRoles?: AppRole[];
};

export function ProtectedRouteState({ children, allowedRoles }: ProtectedRouteStateProps) {
  return <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>;
}

import type { ReactNode } from 'react';

type RoleBadgeProps = {
  children: ReactNode;
};

export function RoleBadge({ children }: RoleBadgeProps) {
  return <span className="role-badge">{children}</span>;
}

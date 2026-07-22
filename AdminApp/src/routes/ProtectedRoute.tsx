import type { ReactNode } from 'react';

import type { AdminSession } from '../types';

interface ProtectedRouteProps {
  session: AdminSession | null;
  loginPage: ReactNode;
  children: ReactNode;
}

export function ProtectedRoute({
  session,
  loginPage,
  children,
}: ProtectedRouteProps) {
  return session ? children : loginPage;
}

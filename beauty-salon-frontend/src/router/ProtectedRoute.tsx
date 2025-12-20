import type { ReactElement, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.ts';
import type { UserRole } from '@/types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps): ReactElement {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: 20 }}>Ładowanie…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    window.alert('Brak dostępu do tej sekcji.');
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

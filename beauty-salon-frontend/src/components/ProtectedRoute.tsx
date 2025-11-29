import type { FC, ReactElement, ReactNode } from 'react';
import { Navigate, useLocation, type Location } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}: ProtectedRouteProps): ReactElement | null => {
  const { user, loading, isAuthenticated } = useAuth();
  const location: Location = useLocation();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Ładowanie...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="access-denied">
        <h2>🚫 Brak dostępu</h2>
        <p>Nie masz uprawnień do tej strony.</p>
        <p>Twoja rola: {user.role_display}</p>
      </div>
    );
  }

  return <>{children}</>;
};

import React from 'react';
import type { ReactNode, ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('manager' | 'employee' | 'client')[];
}

/**
 * Komponent chroniący trasy przed nieautoryzowanym dostępem
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }: ProtectedRouteProps): ReactElement => {
  const { user, loading } = useAuth();

  // Czekaj na sprawdzenie statusu auth
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Ładowanie...</p>
      </div>
    );
  }

  // Nie zalogowany - przekieruj na login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Sprawdź role jeśli są określone
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="access-denied">
        <h2>Brak dostępu</h2>
        <p>Nie masz uprawnień do tej strony.</p>
        <p>Twoja rola: <strong>{user.role_display}</strong></p>
      </div>
    );
  }

  return <>{children}</>;
};
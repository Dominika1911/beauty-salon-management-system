// src/components/ProtectedRoute.tsx

import React, { ReactNode } from 'react'; // DODANY IMPORT Reacta
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('manager' | 'employee' | 'client')[];
}

/**
 * Komponent chroniący trasy przed nieautoryzowanym dostępem
 */
export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps): React.ReactElement => {
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
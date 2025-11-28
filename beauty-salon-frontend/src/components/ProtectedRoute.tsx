// src/components/ProtectedRoute.tsx

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('manager' | 'employee' | 'client')[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
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
        <h2>🚫 Brak dostępu</h2>
        <p>Nie masz uprawnień do tej strony.</p>
        <p>Twoja rola: {user.role_display}</p>
      </div>
    );
  }

  return <>{children}</>;
};
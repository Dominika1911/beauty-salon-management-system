import React, { useState, useEffect, type ReactElement } from 'react';
import { useNavigate, type NavigateFunction } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './LoginPage.css';

export const LoginPage: React.FC = (): ReactElement => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const { login, isAuthenticated } = useAuth();
  const navigate: NavigateFunction = useNavigate();

  // Jeśli już zalogowany, przekieruj na dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit: (e: React.FormEvent) => Promise<void> = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result: { success: boolean; error?: string } = await login({ email, password });

    if (result.success) {
      navigate('/dashboard');
    } else {
      // ✅ Obsługa zabezpieczenia przed logowaniem adminów
      if (result.error === 'superuser_login_not_allowed') {
        setError('Konta administracyjne logują się przez /admin/');
      } else if (result.error === 'Invalid credentials.') {
        setError('Nieprawidłowy email lub hasło');
      } else if (result.error === 'User account is disabled.') {
        setError('Konto zostało dezaktywowane');
      } else if (result.error?.includes('locked')) {
        setError('Konto tymczasowo zablokowane');
      } else {
        setError(result.error || 'Błąd logowania');
      }
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-page-decoration"></div>
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-logo"></div>
            <h1>Beauty Salon</h1>
            <p>System zarządzania salonem kosmetycznym</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                placeholder="klient1@example.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Hasło:</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="login-btn">
              {loading ? (
                <>
                  <span className="spinner-small"></span>
                  Logowanie...
                </>
              ) : (
                'Zaloguj się'
              )}
            </button>
          </form>

          <div className="login-footer">
            <a href="#">Zapomniałeś hasła?</a>
          </div>
        </div>
      </div>
    </div>
  );
};
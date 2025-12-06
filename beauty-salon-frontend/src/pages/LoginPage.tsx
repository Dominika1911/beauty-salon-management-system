// src/pages/LoginPage.tsx (POPRAWIONA WERSJA)

import React, { useState, useEffect, type ReactElement } from 'react'; // Dodano import typu ReactElement
import { useNavigate, type NavigateFunction } from 'react-router-dom'; // Import typu NavigateFunction
import { useAuth } from '../context/useAuth.ts';
import './LoginPage.css';

// 1. Jawne typowanie komponentu i zwracanego typu (naprawia 2 błędy)
export const LoginPage: React.FC = (): ReactElement => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState<boolean>(false); // Jawne typowanie stanu
  const [error, setError] = useState<string>(''); // Jawne typowanie stanu

  const { login, isAuthenticated } = useAuth();

  // 2. Jawne typowanie zmiennej 'navigate' (naprawia 1 błąd)
  const navigate: NavigateFunction = useNavigate();

  // Jeśli już zalogowany, przekieruj na dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  // 3. Jawne typowanie funkcji, argumentu 'e' i zwracanego typu (naprawia 3 błędy)
  const handleSubmit: (e: React.FormEvent) => Promise<void> = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 4. Jawne typowanie zmiennej 'result' (naprawia 1 błąd)
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
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1>💅 Beauty Salon</h1>
            <p>System zarządzania salonem kosmetycznym</p>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email:</label>
              <input
                id="email"
                type="email"
                value={email}
                // 5. Jawne typowanie argumentu 'e' w onChange (naprawia 1 błąd)
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
                // 6. Jawne typowanie argumentu 'e' w onChange (naprawia 1 błąd)
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
                {error}
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

          <div className="test-accounts">
            <p className="test-title">🧪 Konta testowe:</p>
            <div className="test-account">
              <strong>Klient:</strong>
              <span>klient1@example.com / client123</span>
            </div>
            <div className="test-account">
              <strong>Pracownik:</strong>
              <span>anna.stylist@salon.demo / test1234</span>
            </div>
            <div className="test-account">
              <strong>Manager:</strong>
              <span>manager@salon.demo / test1234</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
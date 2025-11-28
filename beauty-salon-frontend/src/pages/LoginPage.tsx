// src/pages/LoginPage.tsx

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Jeśli już zalogowany, przekieruj na dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login({ email, password });

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
                onChange={(e) => setEmail(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
              <span>→ Tylko przez <a href="http://localhost:8000/admin/" target="_blank">/admin/</a></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
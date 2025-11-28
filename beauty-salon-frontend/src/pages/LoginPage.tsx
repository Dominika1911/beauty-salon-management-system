// src/pages/LoginPage.tsx
import type { FormEvent } from 'react';            // 👈 type-only import
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AxiosError } from 'axios';           // 👈 tylko typ
import { login } from '../api/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      navigate('/dashboard');
    } catch (err: unknown) {                       // 👈 bez any
      console.error(err);

      const axiosError = err as AxiosError<{ detail?: string }>;
      const detail =
        axiosError.response?.data?.detail ??
        'Nie udało się zalogować. Sprawdź email i hasło.';

      setError(detail);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          border: '1px solid #ddd',
          borderRadius: 8,
          padding: '2rem',
          minWidth: 320,
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          background: 'white',
        }}
      >
        <h1 style={{ marginBottom: '1rem' }}>Logowanie</h1>

        {error && (
          <div style={{ marginBottom: '1rem', color: 'red' }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label>
            Email<br />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
              required
            />
          </label>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label>
            Hasło<br />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', padding: '0.5rem' }}
              required
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#e91e63',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {loading ? 'Logowanie...' : 'Zaloguj'}
        </button>
      </form>
    </div>
  );
}

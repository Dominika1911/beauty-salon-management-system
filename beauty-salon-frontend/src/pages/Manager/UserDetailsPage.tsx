import { useEffect, useState, type ReactElement } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usersAPI } from '../../api/users';
import type { User, UserAccountStatus } from '../../types';
import {
  beautyButtonDangerStyle,
  beautyButtonSecondaryStyle,
  beautyButtonStyle,
  beautyCardBodyStyle,
  beautyCardHeaderStyle,
  beautyCardStyle,
  beautyMutedTextStyle,
  beautyPageTitleStyle,
} from '../../utils/ui';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function UserDetailsPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // backend w detail może zwracać dodatkowe pola (np. account_status, last_login), więc typ rozszerzamy lokalnie
  type UserDetails = User & { account_status?: UserAccountStatus; last_login?: string | null };

  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const userId = Number(id);

  useEffect(() => {
    if (!Number.isInteger(userId)) {
      navigate('/users', { replace: true });
      return;
    }

    const fetchUser = async (): Promise<void> => {
      try {
        const res = await usersAPI.detail(userId);
        setUser(res.data);
      } catch {
        setMessage({ type: 'error', text: 'Nie udało się pobrać danych użytkownika.' });
      } finally {
        setLoading(false);
      }
    };

    void fetchUser();
  }, [userId, navigate]);

  const requestToggleActive = (): void => {
    setConfirmToggle(true);
    setMessage(null);
  };

  const cancelToggleActive = (): void => {
    setConfirmToggle(false);
  };

  const confirmToggleActiveNow = async (): Promise<void> => {
    if (!user) return;
    const next = !user.is_active;

    setConfirmToggle(false);
    try {
      await usersAPI.update(user.id, { is_active: next });
      setUser({ ...user, is_active: next });
      setMessage({
        type: 'success',
        text: `Status zmieniony na: ${next ? 'AKTYWNY' : 'NIEAKTYWNY'}`,
      });
    } catch {
      setMessage({ type: 'error', text: 'Nie udało się zmienić statusu użytkownika.' });
    }
  };

  if (loading) return <div style={{ padding: 20 }}>Ładowanie…</div>;
  if (!user) return <div style={{ padding: 20 }}>Brak danych użytkownika.</div>;

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <div style={beautyCardStyle}>
        <div style={beautyCardHeaderStyle}>
          <h1 style={beautyPageTitleStyle}>Użytkownik</h1>
          <p style={beautyMutedTextStyle}>{user.email}</p>
        </div>

        <div style={beautyCardBodyStyle}>
          {message ? (
            <div
              style={{
                marginBottom: 14,
                padding: 10,
                borderRadius: 10,
                border: '1px solid',
                borderColor: message.type === 'success' ? '#9ad5b3' : '#f2a6b3',
                backgroundColor: message.type === 'success' ? '#e9fff1' : '#fff1f3',
              }}
            >
              {message.text}
            </div>
          ) : null}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '200px 1fr',
              rowGap: 10,
              columnGap: 12,
            }}
          >
            <strong>ID</strong>
            <span>{user.id}</span>

            <strong>Email</strong>
            <span>{user.email}</span>

            <strong>Rola</strong>
            <span>{user.role_display ?? user.role}</span>

            <strong>Aktywny</strong>
            <span>{user.is_active ? 'TAK' : 'NIE'}</span>

            <strong>Status konta</strong>
            <span>{user.account_status ?? '—'}</span>

            <strong>Utworzono</strong>
            <span>{formatDateTime(user.created_at)}</span>

            <strong>Ostatnie logowanie</strong>
            <span>{formatDateTime(user.last_login ?? null)}</span>
          </div>

          <hr style={{ margin: '20px 0' }} />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button style={beautyButtonSecondaryStyle} onClick={requestToggleActive}>
              {user.is_active ? 'Dezaktywuj' : 'Aktywuj'}
            </button>

            <button style={beautyButtonStyle} onClick={() => navigate('/users')}>
              Powrót do listy
            </button>
          </div>

          {confirmToggle ? (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                border: '1px solid #f2a6b3',
                background: '#fff1f3',
              }}
            >
              <p style={{ marginTop: 0 }}>
                Potwierdź: {user.is_active ? 'DEZAKTYWUJ' : 'AKTYWUJ'} użytkownika <strong>{user.email}</strong>
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button style={beautyButtonDangerStyle} onClick={() => void confirmToggleActiveNow()}>
                  Potwierdź
                </button>
                <button style={beautyButtonSecondaryStyle} onClick={cancelToggleActive}>
                  Anuluj
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
